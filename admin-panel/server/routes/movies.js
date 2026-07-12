const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { db } = require('../server');

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../../uploads'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB max
});

// Get all movies with advanced filters (Skvoznaya)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { country, age, search, interest } = req.query;
        let query = `
            SELECT DISTINCT m.*, g.name as genre_name
            FROM movies m
            LEFT JOIN genres g ON m.genre_id = g.id
            LEFT JOIN movie_views mv ON m.id = mv.movie_id
            LEFT JOIN users u ON mv.user_id = u.telegram_id
            WHERE 1=1
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

// Add movie
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        const { title, description, genreId, country, releaseYear, externalLink, telegramLink, externalLinkWeb, isPremiumOnly, rating, customCode } = req.body;

        // Use custom code if provided, otherwise generate random (1-10000)
        let accessCode = customCode;
        if (!accessCode || accessCode === '') {
            accessCode = Math.floor(Math.random() * 10000) + 1;
        }

        // File ID or external link
        const fileId = req.file ? req.file.filename : null;

        // Ensure access_code is unique (basic check or catch error)
        const stmt = db.prepare(`
            INSERT INTO movies (title, description, genre_id, file_id, access_code, is_premium_only, rating, country, release_year, external_link, telegram_link, external_link_web)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = await stmt.run([
            title,
            description,
            genreId,
            fileId,
            accessCode.toString(),
            isPremiumOnly === 'true' || isPremiumOnly === 1 || isPremiumOnly === '1' ? 1 : 0,
            parseFloat(rating) || 0,
            country || null,
            parseInt(releaseYear) || null,
            externalLink || null,
            telegramLink || null,
            externalLinkWeb || null
        ]);

        res.json({
            success: true,
            movieId: result.lastID,
            accessCode
        });
    } catch (err) {
        console.error('Error adding movie:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update movie
router.put('/:id', authMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, genreId, country, releaseYear, externalLink, telegramLink, externalLinkWeb, isPremiumOnly, rating } = req.body;

        const stmt = db.prepare(`
            UPDATE movies 
            SET title = ?, description = ?, genre_id = ?, country = ?, release_year = ?, external_link = ?, telegram_link = ?, external_link_web = ?, is_premium_only = ?, rating = ?
            WHERE id = ?
        `);

        stmt.run(title, description, genreId, country, releaseYear, externalLink, telegramLink, externalLinkWeb, isPremiumOnly === 'true' || isPremiumOnly === 1 || isPremiumOnly === '1' ? 1 : 0, rating || 0, id);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete movie
router.delete('/:id', authMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM movies WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
