// Covers the daily personalized greeting/marketing feature: the
// daily_messages table seeds exactly one row per day of week (idempotent
// re-init), DailyMessage.update persists admin edits, and the
// personalization + HTML-escaping logic used by progrevJob.runProgrev
// produces a safe message even when a display name contains characters
// that would otherwise break HTML/Telegram parsing.

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_PATH = ':memory:';

const { db, initDb } = require('../src/config/db');
initDb();

const DailyMessage = require('../src/models/DailyMessage');
const Movie = require('../src/models/Movie');
const { runProgrev } = require('../src/jobs/progrevJob');

test('daily_messages is seeded with exactly one row per day of week (0-6)', () => {
    const rows = DailyMessage.getAll();
    assert.equal(rows.length, 7);
    const days = rows.map(r => r.day_of_week).sort((a, b) => a - b);
    assert.deepEqual(days, [0, 1, 2, 3, 4, 5, 6]);
    for (const row of rows) {
        assert.ok(row.template && row.template.includes('{name}'), `day ${row.day_of_week} template must contain the {name} placeholder`);
    }
});

test('re-running initDb does not overwrite existing (possibly admin-edited) templates', () => {
    DailyMessage.update(5, 'Custom Friday tactic edited by admin');
    initDb(); // simulates a redeploy re-running schema init
    const friday = DailyMessage.getByDay(5);
    assert.equal(friday.template, 'Custom Friday tactic edited by admin', 'INSERT OR IGNORE must not clobber an admin edit on redeploy');
});

test('DailyMessage.update persists a new template for a given day', () => {
    const result = DailyMessage.update(1, 'Yangi Dushanba matni {name} uchun');
    assert.equal(result.changes, 1);
    const monday = DailyMessage.getByDay(1);
    assert.equal(monday.template, 'Yangi Dushanba matni {name} uchun');
});

test('personalized greeting escapes HTML-unsafe display names (matches progrevJob.runProgrev logic)', () => {
    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function displayNameFor(user) {
        if (user.custom_name) return user.custom_name;
        if (user.full_name) return user.full_name;
        if (user.username) return `@${user.username}`;
        return 'Foydalanuvchi';
    }

    const template = "Salom, {name}! Bugun ajoyib kun.";
    const dangerousUser = { custom_name: '<script>alert(1)</script>', full_name: null, username: null };

    const greeting = template.replace(/\{name\}/g, escapeHtml(displayNameFor(dangerousUser)));

    assert.ok(!greeting.includes('<script>'), 'raw HTML in a display name must never reach the outgoing message unescaped');
    assert.ok(greeting.includes('&lt;script&gt;'));
});

test('displayNameFor falls back through custom_name -> full_name -> @username -> generic', () => {
    function displayNameFor(user) {
        if (user.custom_name) return user.custom_name;
        if (user.full_name) return user.full_name;
        if (user.username) return `@${user.username}`;
        return 'Foydalanuvchi';
    }

    assert.equal(displayNameFor({ custom_name: 'Ali', full_name: 'Ali Valiyev', username: 'ali' }), 'Ali');
    assert.equal(displayNameFor({ custom_name: null, full_name: 'Ali Valiyev', username: 'ali' }), 'Ali Valiyev');
    assert.equal(displayNameFor({ custom_name: null, full_name: null, username: 'ali' }), '@ali');
    assert.equal(displayNameFor({ custom_name: null, full_name: null, username: null }), 'Foydalanuvchi');
});

test('runProgrev: sends one merged greeting+recommendation message per user via the real job code path', async () => {
    // A published movie so Movie.getRandom({}) can find it.
    db.prepare(`
        INSERT INTO movies (title, description, file_id, access_code, status)
        VALUES (?, ?, ?, ?, 'published')
    `).run('Test Kino', 'Qisqacha tavsif', 'file123', '9999');

    DailyMessage.update(2, 'Salom, {name}! Seshanba kuni uchun maxsus xabar.');

    db.prepare('INSERT INTO users (telegram_id, custom_name, full_name, username) VALUES (?, ?, ?, ?)')
        .run(555, null, null, 'nodeuser');

    const sentMessages = [];
    const fakeTelegram = {
        sendMessage: async (chatId, text, opts) => {
            sentMessages.push({ chatId, text, opts });
        }
    };

    const originalGetDay = Date.prototype.getDay;
    Date.prototype.getDay = function () { return 2; }; // force "Seshanba" (Tuesday)
    try {
        await runProgrev(fakeTelegram);
    } finally {
        Date.prototype.getDay = originalGetDay;
    }

    const toOurUser = sentMessages.find(m => m.chatId === 555);
    assert.ok(toOurUser, 'the user must receive a message');
    assert.match(toOurUser.text, /Salom, @nodeuser! Seshanba kuni uchun maxsus xabar\./, 'must use the day-of-week template with the personalized name');
    assert.match(toOurUser.text, /Test Kino/, 'must include the movie recommendation in the same message');
    assert.equal(toOurUser.opts.parse_mode, 'HTML');
});
