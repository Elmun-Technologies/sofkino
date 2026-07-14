const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { db } = require('../server');

// Get all promocodes with usage stats
router.get('/', authMiddleware, async (req, res) => {
    try {
        const promocodes = await db.prepare(`
            SELECT p.*, COUNT(pu.id) as actual_used
            FROM promocodes p
            LEFT JOIN promocode_usages pu ON p.id = pu.promocode_id
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `).all();
        res.json(promocodes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create promocode
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { code, name, usage_limit, expires_at } = req.body;
        const result = await db.prepare('INSERT INTO promocodes (code, name, usage_limit, expires_at) VALUES (?, ?, ?, ?)').run([code, name, usage_limit, expires_at]);
        res.json({ success: true, id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete promocode
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        await db.prepare('DELETE FROM promocodes WHERE id = ?').run([req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get detailed analytics for a promocode
router.get('/:id/analytics', authMiddleware, async (req, res) => {
    try {
        const usages = await db.prepare(`
            SELECT pu.*, u.username, u.full_name, u.joined_at as user_created_at
            FROM promocode_usages pu
            JOIN users u ON pu.user_id = u.telegram_id
            WHERE pu.promocode_id = ?
            ORDER BY pu.used_at DESC
        `).all([req.params.id]);
        res.json(usages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
