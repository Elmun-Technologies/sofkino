const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { db } = require('../server');

// Get all channels
router.get('/', authMiddleware, async (req, res) => {
    try {
        const channels = await db.prepare('SELECT * FROM channels ORDER BY created_at DESC').all();
        res.json(channels);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
    }
});

// Add channel
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { title, url, channel_id } = req.body;
        const result = await db.prepare('INSERT INTO channels (title, url, channel_id) VALUES (?, ?, ?)').run([title, url, channel_id]);
        res.json({ success: true, id: result.lastID });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
    }
});

// Update channel
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { title, url, channel_id, is_active } = req.body;
        await db.prepare('UPDATE channels SET title = ?, url = ?, channel_id = ?, is_active = ? WHERE id = ?').run([title, url, channel_id, is_active ? 1 : 0, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
    }
});

// Delete channel
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        await db.prepare('DELETE FROM channels WHERE id = ?').run([req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
    }
});

module.exports = router;
