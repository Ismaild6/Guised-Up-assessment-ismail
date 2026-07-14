# Real Connections Feed — Technical Solution Document

**Author:** Assessment submission  
**Feature:** Personalized RealConnections feed for Guised Up  
**Stack:** React Native (Expo) · Laravel 11 · Python/FastAPI · PostgreSQL + pgvector

---

## 1. System Architecture

```
┌─────────────────┐     HTTPS/JSON      ┌──────────────────────┐
│  React Native   │ ◄──────────────────► │   Laravel API        │
│  (Expo)         │   Bearer token       │   Sanctum auth       │
│  Feed Screen    │                      │   Feed ranking       │
└─────────────────┘                      └──────────┬───────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    │                             │                             │
                    ▼                             ▼                             ▼
           ┌────────────────┐           ┌─────────────────┐           ┌─────────────────┐
           │  PostgreSQL    │           │  Python service │           │  Redis (opt.)   │
           │  + pgvector    │           │  /embed         │           │  feed cache     │
           │  users, posts, │           │  sentence-      │           │  later if needed│
           │  interactions  │           │  transformers   │           └─────────────────┘
           └────────────────┘           └─────────────────┘
```

**Why this split:** Laravel handles auth, validation, pagination, and business rules — stuff it's good at. Python owns embedding generation because the ML ecosystem is better there. One Postgres instance with pgvector avoids running a separate vector DB for a take-home; in production at scale I'd consider Qdrant or Pinecone if we outgrow pgvector's recall/latency profile.

---

## 2. Database Schema

### Tables

**users**
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| name | varchar | display name |
| username | varchar unique | @handle |
| email | varchar unique | |
| password | varchar | bcrypt |
| avatar_url | varchar nullable | placeholder ok |
| created_at, updated_at | timestamps | |

**posts**
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| user_id | FK → users | author |
| text | text | post body |
| image_url | varchar nullable | optional |
| authenticity_score | decimal(4,3) | 0–1, computed on create |
| embedding | vector(384) | pgvector, all-MiniLM-L6-v2 |
| created_at, updated_at | timestamps | |

Indexes: `(user_id, created_at DESC)`, `(created_at DESC)`, IVFFlat or HNSW on `embedding` for ANN search.

**interactions**
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| user_id | FK → users | who interacted |
| post_id | FK → posts | target post |
| type | enum | view, reply, reaction |
| created_at | timestamp | no updated_at — append-only log |

Indexes: `(user_id, post_id, type)`, `(post_id, type)`, `(user_id, created_at DESC)` for analytics queries.

**personal_access_tokens** — Laravel Sanctum default.

### Relationships

- User hasMany Posts, hasMany Interactions
- Post belongsTo User, hasMany Interactions
- Interaction belongsTo User, belongsTo Post

---

## 3. Vector Embeddings & Vector DB Choice

**Model:** `sentence-transformers/all-MiniLM-L6-v2` (384 dims, fast, good enough for semantic search on short social text).

**Vector DB:** **pgvector** extension on PostgreSQL.

Reasons:
- Already need Postgres for relational data — one less service to deploy
- Cosine similarity via `<=>` operator works fine for ~100k posts
- Migrations stay reproducible (`CREATE EXTENSION vector`)
- If we hit millions of posts, I'd migrate embeddings to Qdrant and keep Postgres as source of truth

**Flow:**
1. User creates post → Laravel calls `POST http://embedding-service:8001/embed` with `{ "text": "..." }`
2. Python returns `{ "embedding": [384 floats] }`
3. Laravel stores post + vector, computes authenticity_score locally
4. Search: `ORDER BY embedding <=> query_vector LIMIT 10`

**Fallback:** If the Python service is down, Laravel uses a deterministic hash-based pseudo-embedding (see `EmbeddingService.php`) so the app still runs. Swap back to real embeddings in prod.

---

## 4. API Design

**Auth:** Laravel Sanctum personal access tokens. Login once, send `Authorization: Bearer {token}` on all protected routes.

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/login | no | `{ email, password }` → `{ token, user }` |
| POST | /api/posts | yes | Create post |
| GET | /api/feed?page=1 | yes | Paginated ranked feed (20/page) |
| GET | /api/search?q=... | yes | Top 10 semantic matches |
| POST | /api/interactions | yes | Log view/reply/reaction |

### Request/Response Shapes

**POST /api/posts**
```json
// request
{ "text": "rough day but the sunset helped", "image_url": null }

// response 201
{
  "id": 42,
  "text": "...",
  "authenticity_score": 0.82,
  "author": { "id": 1, "username": "maya_k", "avatar_url": null },
  "created_at": "2026-07-14T10:00:00Z"
}
```

**GET /api/feed**
```json
{
  "data": [
    {
      "id": 42,
      "text": "...",
      "image_url": null,
      "authenticity_score": 0.82,
      "author": { "id": 2, "username": "dev_r", "avatar_url": null },
      "created_at": "2026-07-14T09:30:00Z",
      "user_has_reacted": false
    }
  ],
  "meta": { "current_page": 1, "last_page": 3, "per_page": 20, "total": 45 }
}
```

**GET /api/search?q=funny+travel+stories**
```json
{
  "data": [ /* same post shape, max 10, ordered by similarity */ ],
  "query": "funny travel stories"
}
```

**POST /api/interactions**
```json
// request
{ "post_id": 42, "type": "reaction" }

// response 201
{ "id": 99, "post_id": 42, "type": "reaction", "created_at": "..." }
```

---

## 5. Feed Ranking Algorithm

### Plain English

For each candidate post (not authored by the viewer, created within last 90 days):

1. **Authenticity** — posts with genuine, unpolished text score higher. We penalize very short spam, reward moderate-length honest text, and slightly penalize posts with stock-looking image URLs.
2. **Relationship depth** — sum weighted interactions between viewer and post author in the last 60 days. Replies count most, reactions next, views least. People you actually talk to bubble up.
3. **Semantic fit** — cosine similarity between the post embedding and the viewer's interest vector (average embedding of posts they've replied to or reacted to; fallback to recent views).
4. **Freshness** — exponential decay so newer posts win ties, but a highly relevant week-old post can still beat a vague post from today.

Final score is a weighted blend. No likes/comments/shares in the formula — those are inputs to relationship depth only, never a popularity signal.

### Pseudocode

```
function rankFeed(viewer, page):
    candidates = Post.where('user_id', '!=', viewer.id)
                     .where('created_at', '>', now - 90 days)
    
    interestVector = avgEmbedding(
        posts viewer reacted/replied to in last 60 days
    ) ?? avgEmbedding(posts viewer viewed) ?? zeroVector

    relationshipMap = Interaction.weights(viewer)
        .groupBy(postAuthor)
        .sum(typeWeight)  // view=1, reaction=3, reply=5

    scored = []
    for post in candidates:
        auth = post.authenticity_score
        rel = normalize(relationshipMap[post.user_id] ?? 0)
        sem = cosineSimilarity(post.embedding, interestVector)
        decay = exp(-hoursSince(post.created_at) / 168)

        score = 0.25*auth + 0.35*rel + 0.30*sem + 0.10*decay
        scored.append((post, score))

    scored.sort(by score DESC)
    return paginate(scored, page, 20)
```

Weights (0.25 / 0.35 / 0.30 / 0.10) are tunable — I'd A/B test these once we have real usage data.

---

## 6. AI Agentic Tools Used

| Tool | How I used it |
|------|---------------|
| **Cursor (Claude)** | Scaffolded Laravel migrations, feed ranking service, React Native screen structure, and SQL challenge queries. Sped up boilerplate so I could focus on ranking logic and edge cases. |
| **Cursor Agent** | Ran file creation across backend/mobile/docs in parallel; caught missing index on interactions table. |

I used AI for speed on repetitive code (migrations, API resources, test stubs) and wrote the ranking weights, authenticity heuristics, and TSD trade-offs myself because those need product judgment.

---

## 7. Trade-offs & Assumptions

| Decision | Trade-off |
|----------|-----------|
| pgvector over Pinecone | Simpler ops; may need reindex tuning at scale |
| Hash fallback embeddings | Dev-friendly without GPU; semantic search quality drops — documented clearly |
| Authenticity score computed heuristically | No CV model for "filters" in v1 — would add image metadata analysis later |
| 90-day candidate window | Keeps feed query bounded; older posts only surface via search |
| No real-time feed push | Polling + pull-to-refresh on mobile is enough for v1 |
| Interest vector from interactions only | Cold-start users get recency + authenticity until they interact |

**Assumptions:**
- Single region deployment
- ~10k DAU initially — Postgres handles feed scoring in-app (precompute scores if latency grows)
- Test users seeded with varied interaction patterns to demo ranking

---

## 8. What I'd Do Next (Out of Scope)

- Cache per-user feed pages in Redis (5 min TTL)
- Background job to refresh interest vectors nightly
- Moderation queue wired to D4 spam query
- Push notifications for replies from high-relationship users
