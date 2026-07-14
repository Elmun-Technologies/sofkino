const { db } = require('../config/db');
const Genre = require('./Genre');

// Best-effort extraction from a channel post caption like:
//   🎬 DACHA (2026)
//   🎭 Janr: Triller / Sleshr / Psixologik qo'rqinchli
//   🎬 Rejissyor: Sunnat Namozov
//   ⏱ Davomiyligi: 1:13:49
//   📦 Hajmi: 2.4 GB
//   @sofkinolarbot dan yuklandi
// Title comes from the first line, genre from the "Janr:" line, and the
// description is the rest of the caption minus the noisy attribution line.
function parseCaption(caption) {
    if (!caption) return { title: null, description: null, genreHint: null };

    const lines = caption.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return { title: null, description: null, genreHint: null };

    const title = lines[0].replace(/^[^\p{L}\p{N}]+/u, '').trim() || null;

    const genreLine = lines.find(l => /janr/i.test(l));
    const genreHint = genreLine && genreLine.includes(':')
        ? genreLine.split(':').slice(1).join(':').trim()
        : null;

    const description = lines
        .slice(1)
        .filter(l => !/dan yuklandi/i.test(l))
        .join('\n') || null;

    return { title, description, genreHint };
}

// Match the caption's free-text genre against the curated genre list -
// e.g. "Triller / Sleshr / Psixologik qo'rqinchli" matches "Qo'rqinchli".
// Returns null (left for the admin to assign) rather than guessing wrong.
function matchGenreId(genreHint) {
    if (!genreHint) return null;
    const hint = genreHint.toLowerCase();
    const genres = Genre.getAll();
    const found = genres.find(g => hint.includes(g.name.toLowerCase()));
    return found ? found.id : null;
}

class Movie {
    static findByCode(code) {
        const stmt = db.prepare("SELECT * FROM movies WHERE access_code = ? AND status = 'published'");
        return stmt.get(code);
    }

    static findById(id) {
        const stmt = db.prepare('SELECT * FROM movies WHERE id = ?');
        return stmt.get(id);
    }

    // Picks one random movie, optionally excluding ids (e.g. already seen today)
    // and premium-only titles (default excluded — used for the free daily pick).
    static getRandom({ excludeIds = [], includePremium = false } = {}) {
        const conditions = ["status = 'published'"];
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
        const stmt = db.prepare("SELECT * FROM movies WHERE genre_id = ? AND status = 'published'");
        return stmt.all(genreId);
    }

    static getTopByGenre(genreId, limit = 10) {
        const stmt = db.prepare("SELECT * FROM movies WHERE genre_id = ? AND status = 'published' ORDER BY views_count DESC, rating DESC LIMIT ?");
        return stmt.all(genreId, limit);
    }

    // Generate a unique 4-digit access code (falls back to a timestamp-based
    // code in the unlikely event 5 random tries all collide).
    static generateCode() {
        for (let i = 0; i < 5; i++) {
            const candidate = String(Math.floor(Math.random() * 9000) + 1000);
            if (!db.prepare('SELECT 1 FROM movies WHERE access_code = ?').get(candidate)) {
                return candidate;
            }
        }
        return String(Date.now()).slice(-6);
    }

    static createPending({ fileId, sourceChannelId, sourceMessageId, caption }) {
        const { title, description, genreHint } = parseCaption(caption);
        const genreId = matchGenreId(genreHint);
        // Assign the access code right away so it can be written into the
        // channel caption immediately. The movie still isn't reachable by
        // that code until an admin taps "Nashr qilish" (findByCode only
        // returns published rows), so the code is reserved, not yet live.
        const accessCode = Movie.generateCode();

        const stmt = db.prepare(`
            INSERT INTO movies (title, description, genre_id, access_code, file_id, source_channel_id, source_message_id, source_caption, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `);
        const result = stmt.run(title || '🎬 Nomsiz kino', description, genreId, accessCode, fileId, String(sourceChannelId), sourceMessageId, caption || null);

        return { ...result, title: title || null, genreId, accessCode };
    }

    static getPending() {
        return db.prepare(`
            SELECT m.*, g.name as genre_name
            FROM movies m
            LEFT JOIN genres g ON m.genre_id = g.id
            WHERE m.status = 'pending'
            ORDER BY m.id DESC
        `).all();
    }

    // One-click publish: keeps whatever title/genre/description were parsed
    // from the channel caption at ingest time. The code was already assigned
    // (and written into the channel) at ingest, so this just flips the movie
    // live - only regenerating a code in the legacy case where one is missing.
    static publishAuto(id) {
        const movie = db.prepare("SELECT * FROM movies WHERE id = ? AND status = 'pending'").get(id);
        if (!movie) return null;

        const accessCode = movie.access_code || Movie.generateCode();

        db.prepare("UPDATE movies SET access_code = ?, status = 'published' WHERE id = ?").run(accessCode, id);

        const genre = movie.genre_id ? Genre.findById(movie.genre_id) : null;
        return { id, title: movie.title, accessCode, genreName: genre ? genre.name : null };
    }

    static publish(id, movie) {
        const { title, description, genreId, accessCode, isPremiumOnly, rating, country, releaseYear, externalLink, telegramLink, externalLinkWeb } = movie;
        const stmt = db.prepare(`
            UPDATE movies
            SET title = ?, description = ?, genre_id = ?, access_code = ?, is_premium_only = ?, rating = ?,
                country = ?, release_year = ?, external_link = ?, telegram_link = ?, external_link_web = ?,
                status = 'published'
            WHERE id = ? AND status = 'pending'
        `);
        return stmt.run(title, description, genreId, accessCode, isPremiumOnly ? 1 : 0, rating || 0, country, releaseYear, externalLink, telegramLink, externalLinkWeb, id);
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
        const stmt = db.prepare("SELECT * FROM movies WHERE rating > 0 AND status = 'published' ORDER BY rating DESC, views_count DESC LIMIT ?");
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
