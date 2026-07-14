<?php

namespace Tests\Unit;

use App\Services\AuthenticityScorer;
use PHPUnit\Framework\TestCase;

class AuthenticityScorerTest extends TestCase
{
    public function test_genuine_text_scores_higher_than_promo(): void
    {
        $scorer = new AuthenticityScorer();

        $genuine = $scorer->score(
            'Honestly I felt weird today but talking to a friend helped me reset.',
            null
        );

        $promo = $scorer->score(
            'Check out my link in bio for a giveaway #ad',
            'https://images.unsplash.com/photo-123'
        );

        $this->assertGreaterThan($promo, $genuine);
    }

    public function test_score_stays_within_range(): void
    {
        $scorer = new AuthenticityScorer();
        $score = $scorer->score('ok', null);

        $this->assertGreaterThanOrEqual(0.0, $score);
        $this->assertLessThanOrEqual(1.0, $score);
    }
}
