const cron = require('node-cron');
const { db } = require('../config/db');
const Movie = require('../models/Movie');
const { sendToUsers } = require('../utils/broadcast');
const { PROGREV_CRON, TIMEZONE, TZ_OFFSET_SQL } = require('../config/gamification');

async function runProgrev(telegram) {
    const movie = Movie.getRandom({});
    const users = db.prepare('SELECT telegram_id FROM users').all();

    if (!movie || users.length === 0) return { successCount: 0, failCount: 0 };

    const text = `🎬 Bugungi tavsiya: **${movie.title}**\n\n${movie.description}\n\n🎁 Bugungi tekin kinongizni "🎲 Tasodifiy kino" tugmasi orqali oling!`;

    const result = await sendToUsers(telegram, users, {
        type: 'text',
        text,
        options: { parse_mode: 'Markdown' }
    });

    // Nudge users who are about to lose their streak (haven't logged in today)
    const lapsingUsers = db.prepare(`
        SELECT telegram_id FROM users
        WHERE streak_count > 0 AND (last_streak_date IS NULL OR last_streak_date != date('now', ?))
    `).all(TZ_OFFSET_SQL);

    if (lapsingUsers.length > 0) {
        await sendToUsers(telegram, lapsingUsers, {
            type: 'text',
            text: '🔥 Seriyangizni yo\'qotmang! Bugun botga kirib, kunlik seriyangizni davom ettiring.',
            options: {}
        });
    }

    return result;
}

function start(telegram) {
    cron.schedule(PROGREV_CRON, () => {
        runProgrev(telegram).catch(err => console.error('Progrev job failed:', err));
    }, { timezone: TIMEZONE });
    console.log(`✅ Daily progrev job scheduled (${PROGREV_CRON}, ${TIMEZONE})`);
}

module.exports = { start, runProgrev };
