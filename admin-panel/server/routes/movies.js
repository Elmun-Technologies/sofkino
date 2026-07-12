const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { db } = require('../server');

// Get all published movies with advanced filters (Skvoznaya)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { country, age, search, interest } = req.query;
        let query = `
            SELECT DISTINCT m.*, g.name as genre_name
            FROM movies m
            LEFT JOIN genres g ON m.genre_id = g.id
            LEFT JOIN movie_views mv ON m.id = mv.movie_id
            LEFT JOIN users u ON mv.user_id = u.telegram_id
            WHERE m.status = 'published'
        `;
        const params = [];

        if (country) {
            query += ` AND u.country = ?`;
            params.push(country);
        }

        if (age) {
            const [min, max] = age.includes('-') ? age.split('-') : (age.includes('+') ? [age.replace('+', ''), 150] : [0, 150]);
            query += ` AND u.age BETWEEN ? AND ?`;
            params.push(parseInt(min), parseInt(max));
        }

        if (interest) {
            query += ` AND u.interests LIKE ?`;
            params.push(`%${interest}%`);
        }

        if (search) {
            query += ` AND (m.title LIKE ? OR g.name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY m.id DESC`;

        const movies = await db.prepare(query).all(params);
        res.json(movies);
    } catch (err) {
        console.error('Fetch movies error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Movies captured from the storage channel that still need title/code/genre
router.get('/pending', authMiddleware, async (req, res) => {
    try {
        const pending = await db.prepare("SELECT id, created_at FROM movies WHERE status = 'pending' ORDER BY id DESC").all([]);
        res.json(pending);
    } catch (err) {
        console.error('Fetch pending movies error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Fill in a pending movie's metadata and publish it
router.put('/:id/publish', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, genreId, country, releaseYear, externalLink, telegramLink, externalLinkWeb, isPremiumOnly, rating, customCode } = req.body;

        // Use custom code if provided, otherwise generate random (1-10000)
        let accessCode = customCode;
        if (!accessCode || accessCode === '') {
            accessCode = Math.floor(Math.random() * 10000) + 1;
        }

        const result = await db.prepare(`
            UPDATE movies
            SET title = ?, description = ?, genre_id = ?, access_code = ?, is_premium_only = ?, rating = ?,
                country = ?, release_year = ?, external_link = ?, telegram_link = ?, external_link_web = ?,
                status = 'published'
            WHERE id = ? AND status = 'pending'
        `).run([
            title,
            description,
            genreId,
            accessCode.toString(),
            isPremiumOnly === 'true' || isPremiumOnly === 1 || isPremiumOnly === '1' ? 1 : 0,
            parseFloat(rating) || 0,
            country || null,
            parseInt(releaseYear) || null,
            externalLink || null,
            telegramLink || null,
            externalLinkWeb || null,
            id
        ]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Kutilayotgan video topilmadi yoki allaqachon nashr qilingan' });
        }

        res.json({ success: true, accessCode });
    } catch (err) {
        console.error('Error publishing movie:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update an already published movie
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, genreId, country, releaseYear, externalLink, telegramLink, externalLinkWeb, isPremiumOnly, rating } = req.body;

        await db.prepare(`
            UPDATE movies
            SET title = ?, description = ?, genre_id = ?, country = ?, release_year = ?, external_link = ?, telegram_link = ?, external_link_web = ?, is_premium_only = ?, rating = ?
            WHERE id = ?
        `).run([title, description, genreId, country, releaseYear, externalLink, telegramLink, externalLinkWeb, isPremiumOnly === 'true' || isPremiumOnly === 1 || isPremiumOnly === '1' ? 1 : 0, rating || 0, id]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete movie
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        await db.prepare('DELETE FROM movies WHERE id = ?').run([id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
