<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Services\AuthenticityScorer;
use App\Services\EmbeddingService;
use Illuminate\Http\Request;

class PostController extends Controller
{
    public function store(Request $request, EmbeddingService $embeddings, AuthenticityScorer $scorer)
    {
        $data = $request->validate([
            'text' => 'required|string|max:2000',
            'image_url' => 'nullable|url|max:500',
        ]);

        $vector = $embeddings->embed($data['text']);
        $authScore = $scorer->score($data['text'], $data['image_url'] ?? null);

        $post = Post::create([
            'user_id' => $request->user()->id,
            'text' => $data['text'],
            'image_url' => $data['image_url'] ?? null,
            'authenticity_score' => $authScore,
            'embedding' => json_encode($vector),
        ]);

        $post->load('author');

        return response()->json($this->formatPost($post), 201);
    }

    public static function formatPost(Post $post, bool $userHasReacted = false): array
    {
        return [
            'id' => $post->id,
            'text' => $post->text,
            'image_url' => $post->image_url,
            'authenticity_score' => $post->authenticity_score,
            'author' => [
                'id' => $post->author->id,
                'username' => $post->author->username,
                'avatar_url' => $post->author->avatar_url,
            ],
            'created_at' => $post->created_at->toIso8601String(),
            'user_has_reacted' => $userHasReacted,
        ];
    }
}
