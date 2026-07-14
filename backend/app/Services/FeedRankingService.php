<?php

namespace App\Services;

use App\Models\Interaction;
use App\Models\Post;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class FeedRankingService
{
    private EmbeddingService $embeddings;

    public function __construct(EmbeddingService $embeddings)
    {
        $this->embeddings = $embeddings;
    }

    public function rankedPosts(User $viewer, int $page = 1, int $perPage = 20): array
    {
        $candidates = Post::with('author')
            ->where('user_id', '!=', $viewer->id)
            ->where('created_at', '>=', now()->subDays(90))
            ->get();

        if ($candidates->isEmpty()) {
            return [
                'items' => collect(),
                'total' => 0,
            ];
        }

        $relationshipScores = $this->relationshipScores($viewer);
        $interestVector = $this->interestVector($viewer);
        $reactedPostIds = $this->reactedPostIds($viewer, $candidates->pluck('id'));

        $scored = $candidates->map(function (Post $post) use ($relationshipScores, $interestVector, $reactedPostIds) {
            $rel = $this->normalizeRelationship($relationshipScores[$post->user_id] ?? 0);
            $sem = $this->cosineSimilarity(
                $this->parseEmbedding($post->embedding),
                $interestVector
            );
            $decay = $this->timeDecay($post->created_at);
            $auth = (float) $post->authenticity_score;

            $score = (0.25 * $auth) + (0.35 * $rel) + (0.30 * $sem) + (0.10 * $decay);

            return [
                'post' => $post,
                'score' => $score,
                'user_has_reacted' => $reactedPostIds->contains($post->id),
            ];
        })->sortByDesc('score')->values();

        $total = $scored->count();
        $offset = ($page - 1) * $perPage;
        $items = $scored->slice($offset, $perPage)->values();

        return [
            'items' => $items,
            'total' => $total,
        ];
    }

    private function relationshipScores(User $viewer): array
    {
        $rows = DB::table('interactions as i')
            ->join('posts as p', 'p.id', '=', 'i.post_id')
            ->where('i.user_id', $viewer->id)
            ->where('i.created_at', '>=', now()->subDays(60))
            ->select('p.user_id as author_id', 'i.type', DB::raw('count(*) as cnt'))
            ->groupBy('p.user_id', 'i.type')
            ->get();

        $scores = [];
        foreach ($rows as $row) {
            $weight = Interaction::WEIGHTS[$row->type] ?? 1;
            $scores[$row->author_id] = ($scores[$row->author_id] ?? 0) + ($weight * (int) $row->cnt);
        }

        return $scores;
    }

    private function normalizeRelationship(float $raw): float
    {
        // log scale so one super-active friend doesn't dominate
        return min(1.0, log(1 + $raw) / log(50));
    }

    private function interestVector(User $viewer): array
    {
        $strongPostIds = Interaction::where('user_id', $viewer->id)
            ->whereIn('type', [Interaction::TYPE_REACTION, Interaction::TYPE_REPLY])
            ->where('created_at', '>=', now()->subDays(60))
            ->pluck('post_id');

        $embeddings = Post::whereIn('id', $strongPostIds)
            ->pluck('embedding')
            ->map(fn ($e) => $this->parseEmbedding($e))
            ->filter(fn ($v) => array_sum($v) !== 0.0);

        if ($embeddings->isEmpty()) {
            $viewPostIds = Interaction::where('user_id', $viewer->id)
                ->where('type', Interaction::TYPE_VIEW)
                ->where('created_at', '>=', now()->subDays(30))
                ->limit(50)
                ->pluck('post_id');

            $embeddings = Post::whereIn('id', $viewPostIds)
                ->pluck('embedding')
                ->map(fn ($e) => $this->parseEmbedding($e))
                ->filter(fn ($v) => array_sum($v) !== 0.0);
        }

        if ($embeddings->isEmpty()) {
            return array_fill(0, 384, 0.0);
        }

        return $this->averageVectors($embeddings);
    }

    private function reactedPostIds(User $viewer, Collection $postIds): Collection
    {
        return Interaction::where('user_id', $viewer->id)
            ->whereIn('post_id', $postIds)
            ->where('type', Interaction::TYPE_REACTION)
            ->pluck('post_id');
    }

    private function timeDecay($createdAt): float
    {
        $created = $createdAt instanceof \DateTimeInterface
            ? $createdAt
            : new \DateTimeImmutable((string) $createdAt);
        $hours = max(0, (new \DateTimeImmutable())->getTimestamp() - $created->getTimestamp()) / 3600;
        return exp(-$hours / 168.0);
    }

    private function parseEmbedding(?string $raw): array
    {
        if (!$raw) {
            return array_fill(0, 384, 0.0);
        }

        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        // pgvector string like [0.1,0.2,...]
        $trimmed = trim($raw, "[]");
        if ($trimmed === '') {
            return array_fill(0, 384, 0.0);
        }

        return array_map('floatval', explode(',', $trimmed));
    }

    private function averageVectors(Collection $vectors): array
    {
        $dim = 384;
        $sum = array_fill(0, $dim, 0.0);
        $count = $vectors->count();

        foreach ($vectors as $vector) {
            for ($i = 0; $i < $dim; $i++) {
                $sum[$i] += $vector[$i] ?? 0.0;
            }
        }

        $avg = array_map(fn ($v) => $v / $count, $sum);
        $mag = sqrt(array_sum(array_map(fn ($v) => $v * $v, $avg))) ?: 1.0;

        return array_map(fn ($v) => $v / $mag, $avg);
    }

    private function cosineSimilarity(array $a, array $b): float
    {
        if (array_sum($a) === 0.0 || array_sum($b) === 0.0) {
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
        return $denom > 0 ? max(0.0, min(1.0, $dot / $denom)) : 0.0;
    }
}
