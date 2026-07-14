<?php

namespace Tests\Unit;

use App\Services\EmbeddingService;
use PHPUnit\Framework\TestCase;

class EmbeddingServiceTest extends TestCase
{
    public function test_mock_embedding_is_deterministic(): void
    {
        $service = new EmbeddingService();

        $a = $service->embed('funny travel stories from last week');
        $b = $service->embed('funny travel stories from last week');

        $this->assertSame($a, $b);
        $this->assertCount(384, $a);
    }

    public function test_different_text_produces_different_vectors(): void
    {
        $service = new EmbeddingService();

        $travel = $service->embed('missed my train in Lisbon, best night ever');
        $coffee = $service->embed('spilled coffee on my keyboard again');

        $this->assertNotSame($travel, $coffee);
    }
}
