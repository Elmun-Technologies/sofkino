const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { db } = require('../server');

// The 7 daily greeting/marketing templates (one per day of week, 0=Sunday..
// 6=Saturday) sent by the bot's 10:00 progrev job. See src/jobs/progrevJob.js.

// Get all 7 day templates
router.get('/', authMiddleware, async (req, res) => {
    try {
        const messages = await db.prepare('SELECT * FROM daily_messages ORDER BY day_of_week ASC').all([]);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update one day's template
router.put('/:day', authMiddleware, async (req, res) => {
    try {
        const day = parseInt(req.params.day, 10);
        const { template } = req.body;

        if (isNaN(day) || day < 0 || day > 6) {
            return res.status(400).json({ error: 'day_of_week 0 dan 6 gacha bo\'lishi kerak' });
        }
        if (!template || !template.trim()) {
            return res.status(400).json({ error: 'Xabar matni bo\'sh bo\'lishi mumkin emas' });
        }

        const result = await db.prepare(`
            UPDATE daily_messages SET template = ?, updated_at = CURRENT_TIMESTAMP
            WHERE day_of_week = ?
        `).run([template, day]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Bu kun uchun yozuv topilmadi' });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
