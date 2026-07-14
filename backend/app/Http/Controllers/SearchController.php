<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Services\EmbeddingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SearchController extends Controller
{
    public function search(Request $request, EmbeddingService $embeddings)
    {
        $query = trim((string) $request->query('q', ''));

        if ($query === '') {
            return response()->json([
                'data' => [],
                'query' => $query,
            ]);
        }

        $vector = $embeddings->embed($query);
        $pgVector = $embeddings->toPgVector($vector);

        // Works with pgvector; falls back to in-app similarity if column isn't vector type
        try {
            $ids = DB::select("
                SELECT id, (embedding_vec <=> ?::vector) AS distance
                FROM posts
                WHERE embedding_vec IS NOT NULL
                ORDER BY distance ASC
                LIMIT 10
            ", [$pgVector]);

            $postIds = collect($ids)->pluck('id');
            $posts = Post::with('author')->whereIn('id', $postIds)->get()
                ->sortBy(fn ($p) => array_search($p->id, $postIds->toArray()))
                ->values();
        } catch (\Throwable) {
            $posts = $this->fallbackSearch($query, $vector);
        }

        return response()->json([
            'data' => $posts->map(fn ($post) => PostController::formatPost($post))->values(),
            'query' => $query,
        ]);
    }

    private function fallbackSearch(string $query, array $queryVector)
    {
        $posts = Post::with('author')->latest()->limit(200)->get();

        return $posts->map(function (Post $post) use ($queryVector, $query) {
            $embedding = json_decode($post->embedding, true) ?? [];
            $score = $this->cosine($queryVector, $embedding);

            // tiny keyword boost so mock embeddings still feel ok
            if (stripos($post->text, $query) !== false) {
                $score += 0.15;
            }

            return ['post' => $post, 'score' => $score];
        })
            ->sortByDesc('score')
            ->take(10)
            ->pluck('post');
    }

    private function cosine(array $a, array $b): float
    {
        if (empty($a) || empty($b)) {
            return 0.0;
        }

        $dot = 0.0;
        $magA = 0.0;
        $magB = 0.0;
        $len = min(count($a), count($b));

        for ($i = 0; $i < $len; $i++) {
            $dot += $a[$i] * $b[$i];
            $magA += $a[$i] * $a[$i];
            $magB += $b[$i] * $b[$i];
        }

        $denom = sqrt($magA) * sqrt($magB);
        return $denom > 0 ? $dot / $denom : 0.0;
    }
}
