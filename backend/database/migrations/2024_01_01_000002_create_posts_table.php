<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('text');
            $table->string('image_url')->nullable();
            $table->decimal('authenticity_score', 4, 3)->default(0.5);
            $table->text('embedding');
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index('created_at');
        });

        // pgvector column when extension is available
        try {
            DB::statement('CREATE EXTENSION IF NOT EXISTS vector');
            DB::statement('ALTER TABLE posts ADD COLUMN embedding_vec vector(384)');
            DB::statement("
                CREATE OR REPLACE FUNCTION sync_post_embedding_vec()
                RETURNS trigger AS $$
                BEGIN
                    IF NEW.embedding IS NOT NULL AND NEW.embedding <> '' THEN
                        NEW.embedding_vec = NEW.embedding::vector;
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            ");
            DB::statement('
                CREATE TRIGGER posts_embedding_vec_sync
                BEFORE INSERT OR UPDATE ON posts
                FOR EACH ROW EXECUTE FUNCTION sync_post_embedding_vec();
            ');
            DB::statement('
                CREATE INDEX posts_embedding_vec_idx
                ON posts USING ivfflat (embedding_vec vector_cosine_ops) WITH (lists = 50);
            ');
        } catch (\Throwable) {
            // sqlite / mysql dev — json embedding only
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
