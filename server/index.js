import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'guisedup.sqlite'));
const app = express();
const PORT = 8000;
const JWT_SECRET = 'guisedup-dev-secret';

app.use(cors());
app.use(express.json());

function mockEmbed(text) {
  const hash = crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
  const vec = [];
  for (let i = 0; i < 384; i++) {
    const start = (i * 2) % hash.length;
    const chunk = hash.slice(start, start + 8);
    vec.push(parseInt(chunk, 16) / 0xffffffff * 2 - 1);
  }
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / mag);
}

function authScore(text, imageUrl) {
  let score = 0.55;
  const len = text.trim().length;
  if (len >= 40 && len <= 400) score += 0.2;
  else if (len < 15) score -= 0.25;
  if (/\b(i|me|my|honestly|today|felt|weird|lol|idk)\b/i.test(text)) score += 0.1;
  if (/\b(check out|link in bio|giveaway|#ad)\b/i.test(text)) score -= 0.3;
  if (imageUrl && /unsplash|pexels|stock/i.test(imageUrl)) score -= 0.15;
  else if (!imageUrl) score += 0.05;
  return Math.max(0, Math.min(1, Math.round(score * 1000) / 1000));
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function formatPost(row, userHasReacted = false) {
  return {
    id: row.id,
    text: row.text,
    image_url: row.image_url,
    authenticity_score: row.authenticity_score,
    author: {
      id: row.author_id,
      username: row.username,
      avatar_url: row.avatar_url,
    },
    created_at: new Date(row.created_at + 'Z').toISOString(),
    user_has_reacted: userHasReacted,
  };
}

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(422).json({ message: 'Invalid credentials', email: ['Invalid credentials.'] });
  }
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({
    token,
    user: { id: user.id, name: user.name, username: user.username, avatar_url: user.avatar_url },
  });
});

app.post('/api/posts', auth, (req, res) => {
  const { text, image_url = null } = req.body || {};
  if (!text) return res.status(422).json({ message: 'text required' });
  const embedding = JSON.stringify(mockEmbed(text));
  const score = authScore(text, image_url);
  const r = db.prepare('INSERT INTO posts (user_id, text, image_url, authenticity_score, embedding) VALUES (?, ?, ?, ?, ?)').run(req.user.id, text, image_url, score, embedding);
  const post = db.prepare(`
    SELECT p.*, u.id as author_id, u.username, u.avatar_url
    FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?
  `).get(r.lastInsertRowid);
  res.status(201).json(formatPost(post));
});

app.get('/api/feed', auth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const perPage = 20;
  const viewerId = req.user.id;

  const posts = db.prepare(`
    SELECT p.*, u.id as author_id, u.username, u.avatar_url
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.user_id != ? AND p.created_at >= datetime('now', '-90 days')
  `).all(viewerId);

  const relRows = db.prepare(`
    SELECT p.user_id as author_id, i.type, COUNT(*) as cnt
    FROM interactions i JOIN posts p ON p.id = i.post_id
    WHERE i.user_id = ? AND i.created_at >= datetime('now', '-60 days')
    GROUP BY p.user_id, i.type
  `).all(viewerId);

  const weights = { view: 1, reaction: 3, reply: 5 };
  const relMap = {};
  relRows.forEach(r => { relMap[r.author_id] = (relMap[r.author_id] || 0) + (weights[r.type] || 1) * r.cnt; });

  const strongIds = db.prepare(`
    SELECT post_id FROM interactions
    WHERE user_id = ? AND type IN ('reaction','reply') AND created_at >= datetime('now', '-60 days')
  `).all(viewerId).map(r => r.post_id);

  let interestVec = [];
  if (strongIds.length) {
    const embs = db.prepare(`SELECT embedding FROM posts WHERE id IN (${strongIds.map(() => '?').join(',')})`).all(...strongIds).map(r => JSON.parse(r.embedding));
    interestVec = averageVec(embs);
  }

  const reacted = new Set(db.prepare(`
    SELECT post_id FROM interactions WHERE user_id = ? AND type = 'reaction'
  `).all(viewerId).map(r => r.post_id));

  const scored = posts.map(p => {
    const rel = Math.min(1, Math.log(1 + (relMap[p.author_id] || 0)) / Math.log(50));
    const sem = cosine(JSON.parse(p.embedding), interestVec);
    const hours = (Date.now() - new Date(p.created_at + 'Z').getTime()) / 3600000;
    const decay = Math.exp(-hours / 168);
    const score = 0.25 * p.authenticity_score + 0.35 * rel + 0.30 * sem + 0.10 * decay;
    return { post: p, score, reacted: reacted.has(p.id) };
  }).sort((a, b) => b.score - a.score);

  const total = scored.length;
  const slice = scored.slice((page - 1) * perPage, page * perPage);

  res.json({
    data: slice.map(s => formatPost(s.post, s.reacted)),
    meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
  });
});

app.get('/api/search', auth, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ data: [], query: q });
  const qVec = mockEmbed(q);
  const posts = db.prepare(`
    SELECT p.*, u.id as author_id, u.username, u.avatar_url FROM posts p JOIN users u ON u.id = p.user_id
  `).all();

  const results = posts.map(p => {
    let score = cosine(qVec, JSON.parse(p.embedding));
    if (p.text.toLowerCase().includes(q.toLowerCase())) score += 0.15;
    return { post: p, score };
  }).sort((a, b) => b.score - a.score).slice(0, 10);

  res.json({ data: results.map(r => formatPost(r.post)), query: q });
});

app.post('/api/interactions', auth, (req, res) => {
  const { post_id, type } = req.body || {};
  if (!post_id || !['view', 'reply', 'reaction'].includes(type)) {
    return res.status(422).json({ message: 'Invalid interaction' });
  }
  if (type === 'reaction') {
    const exists = db.prepare('SELECT id FROM interactions WHERE user_id = ? AND post_id = ? AND type = ?').get(req.user.id, post_id, 'reaction');
    if (exists) return res.json({ message: 'Already reacted.', post_id, type: 'reaction' });
  }
  const r = db.prepare('INSERT INTO interactions (user_id, post_id, type) VALUES (?, ?, ?)').run(req.user.id, post_id, type);
  res.status(201).json({ id: r.lastInsertRowid, post_id, type, created_at: new Date().toISOString() });
});

function averageVec(list) {
  if (!list.length) return [];
  const dim = 384, sum = Array(dim).fill(0);
  list.forEach(v => v.forEach((n, i) => { sum[i] += n; }));
  const avg = sum.map(v => v / list.length);
  const mag = Math.sqrt(avg.reduce((s, v) => s + v * v, 0)) || 1;
  return avg.map(v => v / mag);
}

function cosine(a, b) {
  if (!a.length || !b.length) return 0;
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i]; ma += a[i] * a[i]; mb += b[i] * b[i];
  }
  const d = Math.sqrt(ma) * Math.sqrt(mb);
  return d > 0 ? Math.max(0, Math.min(1, dot / d)) : 0;
}

app.get('/up', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
