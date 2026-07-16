const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { db } = require('../server');
const { Telegraf, Markup } = require('telegraf');
// Same throttled send loop the bot itself uses (src/jobs/progrevJob.js) - this
// route used to fire sends back-to-back with NO delay at all, which hits
// Telegram's ~30 msg/sec flood limit almost immediately once there are more
// than a couple hundred recipients. sendToUsers() has no dependencies beyond
// the telegram client + a plain user array, so it's safe to reuse across the
// two separate OS processes (bot vs admin panel).
const { sendToUsers } = require('../../../src/utils/broadcast');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Get broadcast history (news_posts)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const posts = await db.prepare('SELECT * FROM news_posts ORDER BY created_at DESC').all();
        res.json(posts);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
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

        const { successCount, failCount } = await sendToUsers(bot.telegram, users, {
            type,
            text,
            mediaId,
            options: { parse_mode: 'Markdown', ...Markup.inlineKeyboard(keyboard) }
        });

        res.json({ success: true, sent: successCount, failed: failCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
    }
});

module.exports = router;
