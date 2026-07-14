-- Guised Up SQL Challenge
-- Assumes PostgreSQL. Tables: users, posts, interactions (type: view, reply, reaction)

-- D1: Top 10 most active users in the last 7 days by total interactions
SELECT
    u.id,
    u.username,
    u.email,
    COUNT(i.id) AS total_interactions
FROM users u
JOIN interactions i ON i.user_id = u.id
WHERE i.created_at >= NOW() - INTERVAL '7 days'
GROUP BY u.id, u.username, u.email
ORDER BY total_interactions DESC
LIMIT 10;


-- D2: Posts from users a given user interacts with most (last 30 days)
-- Replace :user_id with the target user, e.g. 1
WITH author_frequency AS (
    SELECT
        p.user_id AS author_id,
        COUNT(i.id) AS interaction_count
    FROM interactions i
    JOIN posts p ON p.id = i.post_id
    WHERE i.user_id = :user_id
      AND i.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY p.user_id
)
SELECT
    posts.id,
    posts.user_id AS author_id,
    posts.text,
    posts.created_at,
    af.interaction_count
FROM posts
JOIN author_frequency af ON af.author_id = posts.user_id
WHERE posts.created_at >= NOW() - INTERVAL '30 days'
ORDER BY af.interaction_count DESC, posts.created_at DESC;


-- D3: Posts viewed 100+ times with zero reactions
SELECT
    p.id AS post_id,
    p.user_id AS author_id,
    COUNT(i.id) FILTER (WHERE i.type = 'view') AS view_count,
    p.created_at
FROM posts p
JOIN interactions i ON i.post_id = p.id
GROUP BY p.id, p.user_id, p.created_at
HAVING
    COUNT(i.id) FILTER (WHERE i.type = 'view') > 100
    AND COUNT(i.id) FILTER (WHERE i.type = 'reaction') = 0
ORDER BY view_count DESC;


-- D4: Potential spam — users with 20+ posts in the last 24 hours
SELECT
    u.id,
    u.email,
    u.username,
    COUNT(p.id) AS post_count
FROM users u
JOIN posts p ON p.user_id = u.id
WHERE p.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY u.id, u.email, u.username
HAVING COUNT(p.id) > 20
ORDER BY post_count DESC;
