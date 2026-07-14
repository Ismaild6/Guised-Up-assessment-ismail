<?php

namespace App\Services;

use App\Models\Interaction;
use App\Models\Post;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class AuthenticityScorer
{
    /**
     * Heuristic authenticity score — higher means more "real", less polished.
     * Not perfect; good enough for v1 without image analysis.
     */
    public function score(string $text, ?string $imageUrl): float
    {
        $score = 0.55;
        $length = mb_strlen(trim($text));

        if ($length >= 40 && $length <= 400) {
            $score += 0.20;
        } elseif ($length < 15) {
            $score -= 0.25;
        }

        // conversational markers
        if (preg_match('/\b(i|me|my|honestly|today|felt|weird|lol|idk)\b/i', $text)) {
            $score += 0.10;
        }

        // overly polished / promo vibes
        if (preg_match('/\b(check out|link in bio|giveaway|#ad)\b/i', $text)) {
            $score -= 0.30;
        }

        if ($imageUrl) {
            // stock/unsplash urls often mean more curated content
            if (preg_match('/unsplash|pexels|stock/i', $imageUrl)) {
                $score -= 0.15;
            } else {
                $score += 0.05;
            }
        } else {
            $score += 0.05; // text-only feels more raw sometimes
        }

        return round(max(0.0, min(1.0, $score)), 3);
    }
}
