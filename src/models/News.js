const { db } = require('../config/db');

class News {
    static create(data) {
        const { title, content, type, mediaId, url } = data;
        const stmt = db.prepare(`
            INSERT INTO news_posts (title, content, type, media_id, url)
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(title, content, type || 'text', mediaId, url);
    }

    static getAll(limit = 10, offset = 0) {
        const stmt = db.prepare('SELECT * FROM news_posts ORDER BY created_at DESC LIMIT ? OFFSET ?');
        return stmt.all(limit, offset);
    }

    static getById(id) {
        return db.prepare('SELECT * FROM news_posts WHERE id = ?').get(id);
    }

    static addInteraction(postId, userId, type) {
        db.prepare('INSERT INTO news_interactions (post_id, user_id, type) VALUES (?, ?, ?)').run(postId, userId, type);

        // Update counters in news_posts
        if (type === 'view') {
            db.prepare('UPDATE news_posts SET views_count = views_count + 1 WHERE id = ?').run(postId);
        } else if (type === 'like') {
            db.prepare('UPDATE news_posts SET likes_count = likes_count + 1 WHERE id = ?').run(postId);
        } else if (type === 'share') {
            db.prepare('UPDATE news_posts SET shares_count = shares_count + 1 WHERE id = ?').run(postId);
        }
    }

    static removeLike(postId, userId) {
        const stmt = db.prepare('DELETE FROM news_interactions WHERE post_id = ? AND user_id = ? AND type = "like"');
        const result = stmt.run(postId, userId);
        if (result.changes > 0) {
            db.prepare('UPDATE news_posts SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(postId);
        }
    }

    static hasUserLiked(postId, userId) {
        const stmt = db.prepare('SELECT 1 FROM news_interactions WHERE post_id = ? AND user_id = ? AND type = "like"');
        return stmt.get(postId, userId) !== undefined;
    }
}

module.exports = News;
