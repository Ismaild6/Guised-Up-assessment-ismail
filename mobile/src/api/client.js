const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';

let authToken = null;

export function setToken(token) {
  authToken = token;
}

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.message || data.email?.[0] || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

export async function login(email, password) {
  return request('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchFeed(page = 1) {
  return request(`/feed?page=${page}`);
}

export async function searchPosts(query) {
  const q = encodeURIComponent(query.trim());
  return request(`/search?q=${q}`);
}

export async function reactToPost(postId) {
  return request('/interactions', {
    method: 'POST',
    body: JSON.stringify({ post_id: postId, type: 'reaction' }),
  });
}

export async function logView(postId) {
  return request('/interactions', {
    method: 'POST',
    body: JSON.stringify({ post_id: postId, type: 'view' }),
  });
}
