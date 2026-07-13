const { db } = require('../config/db');

class Movie {
    static create(movie) {
        const { title, description, genreId, fileId, accessCode, isPremiumOnly, rating, country, releaseYear, externalLink, telegramLink, externalLinkWeb } = movie;
        const stmt = db.prepare(`
            INSERT INTO movies (title, description, genre_id, file_id, access_code, is_premium_only, rating, country, release_year, external_link, telegram_link, external_link_web)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(title, description, genreId, fileId, accessCode, isPremiumOnly ? 1 : 0, rating || 0, country, releaseYear, externalLink, telegramLink, externalLinkWeb);
    }

    static findByCode(code) {
        const stmt = db.prepare('SELECT * FROM movies WHERE access_code = ?');
        return stmt.get(code);
    }

    static findById(id) {
        const stmt = db.prepare('SELECT * FROM movies WHERE id = ?');
        return stmt.get(id);
    }

    // Picks one random movie, optionally excluding ids (e.g. already seen today)
    // and premium-only titles (default excluded — used for the free daily pick).
    static getRandom({ excludeIds = [], includePremium = false } = {}) {
        const conditions = [];
        const params = [];

        if (!includePremium) {
            conditions.push('is_premium_only = 0');
        }
        if (excludeIds.length > 0) {
            conditions.push(`id NOT IN (${excludeIds.map(() => '?').join(',')})`);
            params.push(...excludeIds);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const stmt = db.prepare(`SELECT * FROM movies ${where} ORDER BY RANDOM() LIMIT 1`);
        return stmt.get(...params);
    }

    static findByGenre(genreId) {
        const stmt = db.prepare('SELECT * FROM movies WHERE genre_id = ?');
        return stmt.all(genreId);
    }

    static getTopByGenre(genreId, limit = 10) {
        const stmt = db.prepare('SELECT * FROM movies WHERE genre_id = ? ORDER BY views_count DESC, rating DESC LIMIT ?');
        return stmt.all(genreId, limit);
    }

    static getAll(limit = 50, offset = 0) {
        const stmt = db.prepare('SELECT * FROM movies LIMIT ? OFFSET ?');
        return stmt.all(limit, offset);
    }

    static incrementViews(id) {
        const stmt = db.prepare('UPDATE movies SET views_count = views_count + 1 WHERE id = ?');
        return stmt.run(id);
    }

    static count() {
        return db.prepare('SELECT COUNT(*) as count FROM movies').get().count;
    }

    static getTopRated(limit = 10) {
        const stmt = db.prepare('SELECT * FROM movies WHERE rating > 0 ORDER BY rating DESC, views_count DESC LIMIT ?');
        return stmt.all(limit);
    }

    static toggleLike(id, userId, isLike = 1) {
        // First, remove any existing reaction to prevent UNIQUE constraint violation
        db.prepare('DELETE FROM movie_likes WHERE movie_id = ? AND user_id = ?').run(id, userId);

        // Insert new reaction
        db.prepare('INSERT INTO movie_likes (movie_id, user_id, is_like) VALUES (?, ?, ?)').run(id, userId, isLike);

        // Update movie totals
        const likes = db.prepare('SELECT COUNT(*) as count FROM movie_likes WHERE movie_id = ? AND is_like = 1').get(id).count;
        const dislikes = db.prepare('SELECT COUNT(*) as count FROM movie_likes WHERE movie_id = ? AND is_like = 0').get(id).count;

        db.prepare('UPDATE movies SET likes_count = ?, dislikes_count = ? WHERE id = ?').run(likes, dislikes, id);
        return { likes, dislikes };
    }

    static addShare(id, userId, platform = 'telegram') {
        db.prepare('INSERT INTO movie_shares (movie_id, user_id, platform) VALUES (?, ?, ?)').run(id, userId, platform);
        db.prepare('UPDATE movies SET shares_count = shares_count + 1 WHERE id = ?').run(id);
    }

    static addWatchTime(id, seconds) {
        db.prepare('UPDATE movies SET total_watch_time = total_watch_time + ? WHERE id = ?').run(seconds, id);
    }

    static getDetailedStats(id) {
        const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(id);
        if (!movie) return null;

        const views = db.prepare(`
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT user_id) as unique_viewers
            FROM movie_views 
            WHERE movie_id = ?
        `).get(id);

        const demographics = db.prepare(`
            SELECT 
                u.country,
                CASE 
                    WHEN age < 18 THEN 'Under 18'
                    WHEN age BETWEEN 18 AND 25 THEN '18-25'
                    WHEN age BETWEEN 26 AND 35 THEN '26-35'
                    WHEN age BETWEEN 36 AND 50 THEN '36-50'
                    ELSE '50+'
                END as age_group,
                COUNT(*) as count
            FROM movie_views mv
            JOIN users u ON mv.user_id = u.telegram_id
            WHERE mv.movie_id = ?
            GROUP BY u.country, age_group
        `).all(id);

        return {
            ...movie,
            stats: {
                views,
                demographics
            }
        };
    }
}

module.exports = Movie;
