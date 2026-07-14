<?php

return [
    'embedding' => [
        'url' => env('EMBEDDING_SERVICE_URL', 'http://localhost:8001'),
        'use_mock' => env('EMBEDDING_USE_MOCK', true),
    ],
];
