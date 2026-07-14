<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Post extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'text',
        'image_url',
        'authenticity_score',
        'embedding',
    ];

    protected $casts = [
        'authenticity_score' => 'float',
    ];

    public function author()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function interactions()
    {
        return $this->hasMany(Interaction::class);
    }
}
