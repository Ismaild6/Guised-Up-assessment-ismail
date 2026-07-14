<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Interaction extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'post_id',
        'type',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public const TYPE_VIEW = 'view';
    public const TYPE_REPLY = 'reply';
    public const TYPE_REACTION = 'reaction';

    public const WEIGHTS = [
        self::TYPE_VIEW => 1,
        self::TYPE_REPLY => 5,
        self::TYPE_REACTION => 3,
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function post()
    {
        return $this->belongsTo(Post::class);
    }
}
