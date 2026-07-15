const cron = require('node-cron');
const { db } = require('../config/db');
const Movie = require('../models/Movie');
const DailyMessage = require('../models/DailyMessage');
const { sendToUsers } = require('../utils/broadcast');
const { PROGREV_CRON, TIMEZONE, TZ_OFFSET_SQL } = require('../config/gamification');

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Same display-name fallback used in profileController.js: custom nickname,
// then Telegram full name, then @username, then a generic fallback - so the
// greeting can always address someone by something.
function displayNameFor(user) {
    if (user.custom_name) return user.custom_name;
    if (user.full_name) return user.full_name;
    if (user.username) return `@${user.username}`;
    return 'Foydalanuvchi';
}

async function runProgrev(telegram) {
    const movie = Movie.getRandom({});
    const users = db.prepare('SELECT telegram_id, custom_name, full_name, username FROM users').all();

    if (!movie || users.length === 0) return { successCount: 0, failCount: 0 };

    // Personalized greeting + marketing tactic for today's day of week (editable
    // from the admin panel), merged with the movie recommendation into one
    // message rather than sending a separate notification.
    const todaysMessage = DailyMessage.getByDay(new Date().getDay());
    const greetingTemplate = todaysMessage?.template || "Assalomu alaykum, {name}! 🎬 Eng sara filmlarni mutlaqo reklamasiz tomosha qiling!";

    const movieBlock = `🎬 Bugungi tavsiya: <b>${escapeHtml(movie.title)}</b>${movie.description ? `\n${escapeHtml(movie.description)}` : ''}\n\n🎁 Bugungi tekin kinongizni "🎲 Tasodifiy kino" tugmasi orqali oling!`;

    const result = await sendToUsers(telegram, users, {
        type: 'text',
        text: (user) => {
            const greeting = greetingTemplate.replace(/\{name\}/g, escapeHtml(displayNameFor(user)));
            return `${greeting}\n\n${movieBlock}`;
        },
        options: { parse_mode: 'HTML' }
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
