<?php

namespace Database\Seeders;

use App\Models\Interaction;
use App\Models\Post;
use App\Models\User;
use App\Services\AuthenticityScorer;
use App\Services\EmbeddingService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $embeddings = app(EmbeddingService::class);
        $scorer = app(AuthenticityScorer::class);

        $maya = User::create([
            'name' => 'Maya Kapoor',
            'username' => 'maya_k',
            'email' => 'maya@guisedup.test',
            'password' => Hash::make('password'),
            'avatar_url' => null,
        ]);

        $dev = User::create([
            'name' => 'Dev Rahman',
            'username' => 'dev_r',
            'email' => 'dev@guisedup.test',
            'password' => Hash::make('password'),
            'avatar_url' => null,
        ]);

        $samples = [
            [$maya, 'Honestly today was messy but I laughed anyway. Small wins.'],
            [$maya, 'Travel tip nobody asked for: get lost on purpose once. Best stories happen that way.'],
            [$dev, 'Funny travel story — missed my train in Lisbon and ended up at a family dinner I wasn't invited to. Still think about the pasteis.'],
            [$dev, 'Not a highlight reel: spilled coffee, late to standup, fixed a bug at 11pm. Real dev day.'],
            [$maya, 'Sunset from the terrace. No filter, phone camera is enough sometimes.'],
            [$dev, 'Weekend hike. Legs hurt. Worth it.'],
            [$maya, 'Trying to post less polished stuff. This is me figuring it out.'],
            [$dev, 'Hot take: the best posts are the ones you almost didn\'t share.'],
        ];

        $posts = [];
        foreach ($samples as [$author, $text]) {
            $posts[] = Post::create([
                'user_id' => $author->id,
                'text' => $text,
                'image_url' => null,
                'authenticity_score' => $scorer->score($text, null),
                'embedding' => json_encode($embeddings->embed($text)),
            ]);
        }

        // dev views/reacted to maya's travel + sunset posts
        Interaction::create(['user_id' => $dev->id, 'post_id' => $posts[1]->id, 'type' => 'view', 'created_at' => now()->subHours(2)]);
        Interaction::create(['user_id' => $dev->id, 'post_id' => $posts[1]->id, 'type' => 'reaction', 'created_at' => now()->subHours(2)]);
        Interaction::create(['user_id' => $dev->id, 'post_id' => $posts[4]->id, 'type' => 'reply', 'created_at' => now()->subHours(5)]);
        Interaction::create(['user_id' => $dev->id, 'post_id' => $posts[0]->id, 'type' => 'view', 'created_at' => now()->subDay()]);

        // maya interacts with dev
        Interaction::create(['user_id' => $maya->id, 'post_id' => $posts[2]->id, 'type' => 'reaction', 'created_at' => now()->subHours(1)]);
        Interaction::create(['user_id' => $maya->id, 'post_id' => $posts[2]->id, 'type' => 'reply', 'created_at' => now()->subHours(1)]);
        Interaction::create(['user_id' => $maya->id, 'post_id' => $posts[3]->id, 'type' => 'view', 'created_at' => now()->subHours(8)]);
    }
}
