<?php

namespace App\Http\Controllers;

use App\Models\Interaction;
use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InteractionController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'post_id' => 'required|exists:posts,id',
            'type' => ['required', Rule::in([
                Interaction::TYPE_VIEW,
                Interaction::TYPE_REPLY,
                Interaction::TYPE_REACTION,
            ])],
        ]);

        $post = Post::findOrFail($data['post_id']);

        // don't double-count reactions from same user
        if ($data['type'] === Interaction::TYPE_REACTION) {
            $exists = Interaction::where('user_id', $request->user()->id)
                ->where('post_id', $post->id)
                ->where('type', Interaction::TYPE_REACTION)
                ->exists();

            if ($exists) {
                return response()->json([
                    'message' => 'Already reacted.',
                    'post_id' => $post->id,
                    'type' => Interaction::TYPE_REACTION,
                ], 200);
            }
        }

        $interaction = Interaction::create([
            'user_id' => $request->user()->id,
            'post_id' => $post->id,
            'type' => $data['type'],
            'created_at' => now(),
        ]);

        return response()->json([
            'id' => $interaction->id,
            'post_id' => $interaction->post_id,
            'type' => $interaction->type,
            'created_at' => $interaction->created_at->toIso8601String(),
        ], 201);
    }
}
