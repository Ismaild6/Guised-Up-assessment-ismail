import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'guisedup.sqlite');

if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar_url TEXT
  );

  CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    image_url TEXT,
    authenticity_score REAL DEFAULT 0.5,
    embedding TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

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

function cosine(a, b) {
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    ma += a[i] * a[i];
    mb += b[i] * b[i];
  }
  const d = Math.sqrt(ma) * Math.sqrt(mb);
  return d > 0 ? dot / d : 0;
}

const pass = bcrypt.hashSync('password', 10);

const maya = db.prepare('INSERT INTO users (name, username, email, password) VALUES (?, ?, ?, ?)').run('Maya Kapoor', 'maya_k', 'maya@guisedup.test', pass);
const dev = db.prepare('INSERT INTO users (name, username, email, password) VALUES (?, ?, ?, ?)').run('Dev Rahman', 'dev_r', 'dev@guisedup.test', pass);

const samples = [
  [maya.lastInsertRowid, 'Honestly today was messy but I laughed anyway. Small wins.'],
  [maya.lastInsertRowid, 'Travel tip nobody asked for: get lost on purpose once. Best stories happen that way.'],
  [dev.lastInsertRowid, 'Funny travel story — missed my train in Lisbon and ended up at a family dinner I wasn\'t invited to. Still think about the pasteis.'],
  [dev.lastInsertRowid, 'Not a highlight reel: spilled coffee, late to standup, fixed a bug at 11pm. Real dev day.'],
  [maya.lastInsertRowid, 'Sunset from the terrace. No filter, phone camera is enough sometimes.'],
  [dev.lastInsertRowid, 'Weekend hike. Legs hurt. Worth it.'],
  [maya.lastInsertRowid, 'Trying to post less polished stuff. This is me figuring it out.'],
  [dev.lastInsertRowid, 'Hot take: the best posts are the ones you almost didn\'t share.'],
];

const insertPost = db.prepare('INSERT INTO posts (user_id, text, authenticity_score, embedding, created_at) VALUES (?, ?, ?, ?, datetime(?, ?))');
const posts = [];
samples.forEach(([uid, text], i) => {
  const r = insertPost.run(uid, text, authScore(text, null), JSON.stringify(mockEmbed(text)), 'now', `-${i} hours`);
  posts.push(r.lastInsertRowid);
});

const insertIx = db.prepare('INSERT INTO interactions (user_id, post_id, type, created_at) VALUES (?, ?, ?, datetime(\'now\', ?))');
insertIx.run(dev.lastInsertRowid, posts[1], 'view', '-2 hours');
insertIx.run(dev.lastInsertRowid, posts[1], 'reaction', '-2 hours');
insertIx.run(dev.lastInsertRowid, posts[4], 'reply', '-5 hours');
insertIx.run(dev.lastInsertRowid, posts[0], 'view', '-1 day');
insertIx.run(maya.lastInsertRowid, posts[2], 'reaction', '-1 hours');
insertIx.run(maya.lastInsertRowid, posts[2], 'reply', '-1 hours');
insertIx.run(maya.lastInsertRowid, posts[3], 'view', '-8 hours');

console.log('Seeded SQLite DB with 2 users, 8 posts, 7 interactions');
db.close();
