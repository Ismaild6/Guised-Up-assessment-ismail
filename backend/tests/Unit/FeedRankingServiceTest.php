<?php

namespace Tests\Unit;

use App\Services\EmbeddingService;
use App\Services\FeedRankingService;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

class FeedRankingServiceTest extends TestCase
{
    public function test_time_decay_prefers_newer_posts(): void
    {
        $service = new FeedRankingService(new EmbeddingService());
        $ref = new ReflectionClass($service);
        $method = $ref->getMethod('timeDecay');
        $method->setAccessible(true);

        $fresh = $method->invoke($service, new DateTimeImmutable('-2 hours'));
        $old = $method->invoke($service, new DateTimeImmutable('-14 days'));

        $this->assertGreaterThan($old, $fresh);
    }

    public function test_cosine_similarity_for_identical_vectors_is_one(): void
    {
        $service = new FeedRankingService(new \App\Services\EmbeddingService());
        $ref = new ReflectionClass($service);
        $method = $ref->getMethod('cosineSimilarity');
        $method->setAccessible(true);

        $vector = array_fill(0, 384, 0.01);
        $score = $method->invoke($service, $vector, $vector);

        $this->assertEqualsWithDelta(1.0, $score, 0.001);
    }
}
