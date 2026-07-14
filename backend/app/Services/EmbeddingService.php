<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class EmbeddingService
{
    private const DIMENSIONS = 384;

    public function embed(string $text): array
    {
        $useMock = (bool) config('services.embedding.use_mock', true);
        $baseUrl = rtrim((string) config('services.embedding.url', 'http://localhost:8001'), '/');

        if (!$useMock) {
            try {
                $response = Http::timeout(10)
                    ->post("{$baseUrl}/embed", ['text' => $text]);

                if ($response->successful()) {
                    $embedding = $response->json('embedding');
                    if (is_array($embedding) && count($embedding) === self::DIMENSIONS) {
                        return $this->normalize($embedding);
                    }
                }
            } catch (\Throwable) {
                // fall through to mock
            }
        }

        return $this->mockEmbed($text);
    }

    public function toPgVector(array $embedding): string
    {
        $parts = array_map(fn ($v) => round((float) $v, 8), $embedding);
        return '[' . implode(',', $parts) . ']';
    }

    private function mockEmbed(string $text): array
    {
        $hash = hash('sha256', Str::lower(trim($text)));
        $vector = [];

        for ($i = 0; $i < self::DIMENSIONS; $i++) {
            $chunk = substr($hash, ($i * 2) % 60, 8);
            $vector[] = (hexdec($chunk) / 0xFFFFFFFF) * 2 - 1;
        }

        return $this->normalize($vector);
    }

    private function normalize(array $vector): array
    {
        $sumSquares = array_sum(array_map(fn ($v) => $v * $v, $vector));
        $magnitude = sqrt($sumSquares) ?: 1.0;

        return array_map(fn ($v) => $v / $magnitude, $vector);
    }
}
