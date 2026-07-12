const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { db } = require('../server');

// Get all genres with movie count
router.get('/', authMiddleware, async (req, res) => {
    try {
        const genres = await db.prepare(`
            SELECT g.*, COUNT(m.id) as movie_count 
            FROM genres g 
            LEFT JOIN movies m ON g.id = m.genre_id 
            GROUP BY g.id 
            ORDER BY g.views_count DESC
        `).all();
        res.json(genres);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add genre
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name } = req.body;
        const result = await db.prepare('INSERT INTO genres (name) VALUES (?)').run([name]);
        res.json({ success: true, id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete genre
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        await db.prepare('DELETE FROM genres WHERE id = ?').run([req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get top 10 movies by genre
router.get('/:id/top-movies', authMiddleware, async (req, res) => {
    try {
        const movies = await db.prepare(`
            SELECT * FROM movies WHERE genre_id = ? ORDER BY views_count DESC LIMIT 10
        `).all([req.params.id]);
        res.json(movies);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
