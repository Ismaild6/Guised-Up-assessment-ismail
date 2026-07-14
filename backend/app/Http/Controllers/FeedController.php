<?php

namespace App\Http\Controllers;

use App\Services\FeedRankingService;
use Illuminate\Http\Request;

class FeedController extends Controller
{
    public function index(Request $request, FeedRankingService $ranker)
    {
        $page = max(1, (int) $request->query('page', 1));
        $perPage = 20;

        $result = $ranker->rankedPosts($request->user(), $page, $perPage);
        $lastPage = max(1, (int) ceil($result['total'] / $perPage));

        $data = $result['items']->map(function ($row) {
            return PostController::formatPost($row['post'], $row['user_has_reacted']);
        });

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $result['total'],
            ],
        ]);
    }
}
