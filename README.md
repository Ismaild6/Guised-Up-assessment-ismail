# Guised Up — Full-Stack Developer Assessment

Personalized **Real Connections** feed for Guised Up — ranked by authenticity, relationship depth, and semantic relevance (not likes or engagement metrics).

**Stack:** React Native (Expo) · Laravel 11 · Python · PostgreSQL + pgvector · SQLite (local runner)

---

## Repository contents

| Path | Description |
|------|-------------|
| [`docs/TSD.md`](docs/TSD.md) | **Technical Solution Document** — architecture, schema, vector DB choice, API design, ranking algorithm, AI tool usage, trade-offs |
| [`sql/queries.sql`](sql/queries.sql) | **SQL challenge** — D1 through D4 queries |
| [`backend/`](backend/) | Laravel API — Sanctum auth, feed ranking, vector search, migrations, seeders, unit tests |
| [`embedding-service/`](embedding-service/) | Python embedding service (stdlib HTTP server; optional sentence-transformers) |
| [`mobile/`](mobile/) | React Native feed screen — infinite scroll, search, reactions |
| [`server/`](server/) | Node.js + SQLite runner — same API endpoints, for quick local demo without PHP/Docker |
| [`.env.example`](.env.example) | Environment variable reference for all services |
| [`docker-compose.yml`](docker-compose.yml) | Postgres (pgvector) + embedding service |

### Technical Solution Document (TSD)

📄 **[docs/TSD.md](docs/TSD.md)**

Covers everything required in Part A:
- System architecture diagram
- Database schema (tables, relationships, indexes)
- Vector embeddings + pgvector rationale
- API endpoints with request/response shapes
- Feed ranking algorithm (plain English + pseudocode)
- AI agentic tools used (Cursor)
- Trade-offs and assumptions

### SQL queries

📄 **[sql/queries.sql](sql/queries.sql)**

| Query | Description |
|-------|-------------|
| **D1** | Top 10 most active users in the last 7 days (views + replies + reactions) |
| **D2** | Posts from users a given `user_id` interacts with most (last 30 days) |
| **D3** | Posts viewed 100+ times with zero reactions |
| **D4** | Spam detection — users with 20+ posts in the last 24 hours |

Run against PostgreSQL after `php artisan migrate --seed`, or inspect the queries directly.

---

## Prerequisites

| Tool | Version | Required for |
|------|---------|--------------|
| Node.js | 18+ | Mobile app + optional Node runner |
| PHP | 8.2+ | Laravel backend (production path) |
| Composer | latest | Laravel dependencies |
| Docker Desktop | latest | PostgreSQL + pgvector (recommended) |
| Python | 3.11+ | Embedding service (optional — mock mode works without it) |

---

## Environment setup

Copy the example env files before running:

```bash
# Root reference (see .env.example)
cp .env.example .env

# Laravel backend
cp backend/.env.example backend/.env

# Mobile app
cp mobile/.env.example mobile/.env
```

### `.env.example` (root)

```env
# Database (Docker Compose defaults)
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=guisedup
DB_USERNAME=guisedup
DB_PASSWORD=secret

# Laravel API
APP_URL=http://localhost:8000
EMBEDDING_SERVICE_URL=http://localhost:8001
EMBEDDING_USE_MOCK=true

# Mobile — use your LAN IP when testing on a physical device
EXPO_PUBLIC_API_URL=http://localhost:8000/api
```

See also:
- [`backend/.env.example`](backend/.env.example) — full Laravel config
- [`mobile/.env.example`](mobile/.env.example) — Expo API URL

---

## How to run

### Option A — Full stack (Laravel + Postgres) — recommended for submission

**1. Start database and embedding service**

```bash
docker compose up -d
```

Starts PostgreSQL with pgvector on port `5432`.

**2. Start embedding service** (separate terminal)

```bash
cd embedding-service
python main.py
```

Runs on `http://localhost:8001`. Set `EMBEDDING_USE_MOCK=false` in `backend/.env` to use it.

**3. Start Laravel API**

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

API available at `http://localhost:8000`.

**4. Start mobile app**

```bash
cd mobile
npm install
npx expo install react-dom react-native-web @expo/metro-runtime expo-asset expo-font expo-constants
npx expo start
```

- Press `w` for web browser (`http://localhost:8081`)
- Scan QR code with **Expo Go** on your phone
- On a physical device, update `mobile/.env`:
  ```
  EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:8000/api
  ```

**5. Run backend tests**

```bash
cd backend
composer test
```

6 unit tests cover authenticity scoring, embeddings, and feed ranking logic.

---

### Option B — Quick local demo (no PHP / Docker required)

If PHP or Docker isn't installed, use the Node.js runner with SQLite:

**Windows — double-click or run:**

```bash
start.bat
```

**Or manually:**

```bash
# Terminal 1 — embedding service
cd embedding-service
python main.py

# Terminal 2 — API (Node + SQLite)
cd server
npm install
node seed.js        # first time only
node index.js

# Terminal 3 — mobile
cd mobile
npm install
npx expo start --web
```

Open `http://localhost:8081` in your browser.

> The Node runner implements the same API contract as Laravel. Use Option A for the full assessment stack.

---

## API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/login` | No | `{ email, password }` → `{ token, user }` |
| `POST` | `/api/posts` | Yes | Create post with auto-generated embedding |
| `GET` | `/api/feed?page=1` | Yes | Personalized ranked feed (20 per page) |
| `GET` | `/api/search?q={query}` | Yes | Natural language semantic search (top 10) |
| `POST` | `/api/interactions` | Yes | `{ post_id, type: view\|reply\|reaction }` |

### Test users (seeded)

| Email | Password |
|-------|----------|
| `dev@guisedup.test` | `password` |
| `maya@guisedup.test` | `password` |

### Quick API test

```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@guisedup.test","password":"password"}'
```

---

## Mobile app features

- Paginated feed from `GET /api/feed`
- Post cards: avatar, username, text, time ago, reaction button
- Infinite scroll (loads next page at bottom)
- Search bar calling `GET /api/search` with inline results
- Loading, empty, and error states
- Pull-to-refresh

---

## Feed ranking (summary)

Posts are scored by:

1. **Authenticity** (25%) — genuine text, fewer polished/stock signals
2. **Relationship depth** (35%) — weighted interactions with the author (reply > reaction > view)
3. **Semantic similarity** (30%) — cosine similarity to user's interest vector
4. **Time decay** (10%) — newer content preferred, but not over relevance

No engagement metrics (likes, shares, follower count) in the ranking formula.

Full details: [`docs/TSD.md`](docs/TSD.md)

---

## Demo video checklist

Before submitting, record a walkthrough showing:

1. Login as `dev@guisedup.test`
2. Feed loads with ranked posts
3. Scroll / pull-to-refresh
4. Search: `funny travel stories`
5. Tap **react** on a post
6. Briefly explain ranking (not likes-based)

---

## Submission checklist

- [ ] Private GitHub repo: `GuisedUp-assessment-[yourname]`
- [ ] Full code pushed with this README
- [ ] TSD at [`docs/TSD.md`](docs/TSD.md)
- [ ] SQL queries at [`sql/queries.sql`](sql/queries.sql)
- [ ] `.env.example` files included (do not commit real `.env`)
- [ ] Demo video recorded and shared
- [ ] Repo link + TSD sent to founder via LinkedIn DM / email

**Subject line:** `[Guised Up Application] Your Name — Full-Stack Assessment`

---

## Notes

- Embeddings default to a deterministic hash mock — no API keys or GPU needed. Set `EMBEDDING_USE_MOCK=false` and optionally install `sentence-transformers` for real vectors.
- pgvector is configured in the posts migration. Search falls back to in-memory cosine similarity if the extension isn't available.
- AI tools used: **Cursor** (scaffolding, migrations, ranking logic, mobile UI, SQL queries). Documented in the TSD.

---

## Project structure

```
guisedup-assessment/
├── docs/
│   └── TSD.md                 # Technical Solution Document
├── sql/
│   └── queries.sql            # SQL challenge D1–D4
├── backend/                   # Laravel 11 API
│   ├── app/
│   ├── database/migrations/
│   ├── database/seeders/
│   ├── tests/
│   └── .env.example
├── embedding-service/         # Python embeddings
├── mobile/                    # React Native (Expo)
├── server/                    # Node.js quick runner (SQLite)
├── docker-compose.yml
├── .env.example
├── start.bat                  # One-click Windows launcher
└── README.md
```
