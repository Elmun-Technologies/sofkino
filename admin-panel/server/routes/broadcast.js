const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { db } = require('../server');
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Get broadcast history (news_posts)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const posts = await db.prepare('SELECT * FROM news_posts ORDER BY created_at DESC').all();
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send broadcast
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { type, text, mediaId, url, target, buttonText } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Xabar matni bo\'sh' });
        }

        // Create News Post
        const newsResult = await db.prepare(`
            INSERT INTO news_posts (title, content, type, media_id, url)
            VALUES (?, ?, ?, ?, ?)
        `).run([text.substring(0, 30) + '...', text, type || 'text', mediaId || null, url || null]);
        const postId = newsResult.lastID;

        // Get users
        let users = [];
        if (target === 'all') {
            users = await db.prepare('SELECT telegram_id FROM users').all([]);
        } else if (target === 'premium') {
            users = await db.prepare("SELECT telegram_id FROM users WHERE is_premium = 1 AND premium_end > datetime('now')").all([]);
        } else if (target === 'regular') {
            users = await db.prepare("SELECT telegram_id FROM users WHERE is_premium = 0 OR premium_end IS NULL OR premium_end < datetime('now')").all([]);
        } else {
            return res.status(400).json({ error: 'Invalid target' });
        }

        const keyboard = [
            [Markup.button.callback('🤍 Like', `like_news_${postId}`), Markup.button.callback('📤 Share', `share_news_${postId}`)]
        ];
        if (url) {
            const label = buttonText && buttonText.trim() ? buttonText.trim() : '🔗 Batafsil';
            keyboard.unshift([Markup.button.url(label, url)]);
        }

        let successCount = 0;
        let failCount = 0;

        for (const user of users) {
            try {
                const options = { parse_mode: 'Markdown', ...Markup.inlineKeyboard(keyboard) };
                if (type === 'image') {
                    await bot.telegram.sendPhoto(user.telegram_id, mediaId, { caption: text, ...options });
                } else if (type === 'video') {
                    await bot.telegram.sendVideo(user.telegram_id, mediaId, { caption: text, ...options });
                } else {
                    await bot.telegram.sendMessage(user.telegram_id, text, options);
                }
                successCount++;
            } catch (err) {
                failCount++;
                console.error('Failed to send to user', user.telegram_id, err.message);
            }
        }

        res.json({ success: true, sent: successCount, failed: failCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
