const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { db } = require('../server');

// Get all users with filters
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { search, country, region, minAge, maxAge } = req.query;

        let query = 'SELECT * FROM users WHERE 1=1';
        const params = [];

        if (search) {
            query += ' AND (full_name LIKE ? OR username LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (country) {
            query += ' AND country = ?';
            params.push(country);
        }

        // "city" doubles as the user's region/viloyat (picked from a fixed list
        // in the profile edit scene)
        if (region) {
            query += ' AND city = ?';
            params.push(region);
        }

        if (minAge) {
            query += ' AND age >= ?';
            params.push(minAge);
        }

        if (maxAge) {
            query += ' AND age <= ?';
            params.push(maxAge);
        }

        query += ' ORDER BY joined_at DESC LIMIT 100';

        const users = await db.prepare(query).all(params);
        res.json(users);
    } catch (err) {
        console.error('Fetch users error:', err);
        res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
    }
});

// Ban user
router.post('/:id/ban', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        await db.prepare('UPDATE users SET is_banned = 1 WHERE telegram_id = ?').run([id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
    }
});

// Unban user
router.post('/:id/unban', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        await db.prepare('UPDATE users SET is_banned = 0 WHERE telegram_id = ?').run([id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
    }
});

// Delete user
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        await db.prepare('DELETE FROM users WHERE telegram_id = ?').run([id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
    }
});

module.exports = router;
