// Regression tests for "adminlarga limitlar chiqyapti" (admins are hitting
// limits meant only for regular users):
//
// 1. movieController.showRandomMovie's daily free-random-movie limit
//    (FREE_RANDOM_PER_DAY) never checked admin status at all - an admin
//    watching more than one random movie a day got the same "bugungi tekin
//    kinongiz tugadi" paywall message as everyone else.
// 2. bot.js's code-entry rate limiter (added in the security hardening
//    pass) throttled every user including admins after 5 attempts/minute -
//    admins testing the code-unlock flow would get "Juda ko'p urinish".
//
// Both are fixed by checking isAdminId() before applying the limit.

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_PATH = ':memory:';

const { db, initDb } = require('../src/config/db');
initDb();

const movieController = require('../src/controllers/movieController');

function insertPublishedMovie(title, accessCode) {
    db.prepare(`
        INSERT INTO movies (title, description, file_id, access_code, status)
        VALUES (?, ?, ?, ?, 'published')
    `).run(title, 'desc', `file_${accessCode}`, accessCode);
}

function ensureUser(telegramId) {
    db.prepare('INSERT OR IGNORE INTO users (telegram_id, username, full_name) VALUES (?, ?, ?)')
        .run(telegramId, 'u' + telegramId, 'User ' + telegramId);
}

function makeFakeCtx(userId) {
    const replies = [];
    const videos = [];
    return {
        from: { id: userId },
        reply: async (text, opts) => { replies.push({ text, opts }); },
        replyWithVideo: async (fileId, opts) => { videos.push({ fileId, opts }); },
        replies,
        videos
    };
}

test('showRandomMovie: a regular user hits the daily limit after FREE_RANDOM_PER_DAY movies', async () => {
    insertPublishedMovie('Kino A', '1001');
    insertPublishedMovie('Kino B', '1002');
    delete process.env.ADMIN_IDS;
    delete process.env.ADMIN_ID;

    const userId = 5001;
    ensureUser(userId);
    const ctx1 = makeFakeCtx(userId);
    await movieController.showRandomMovie(ctx1);
    assert.equal(ctx1.videos.length, 1, 'first free random movie today must be delivered');

    const ctx2 = makeFakeCtx(userId);
    await movieController.showRandomMovie(ctx2);
    assert.equal(ctx2.videos.length, 0, 'a second random movie the same day must NOT be delivered to a regular user');
    assert.match(ctx2.replies[0].text, /tugadi/, 'must show the daily-limit paywall message instead');
});

test('showRandomMovie: an admin is never subject to the daily limit', async () => {
    insertPublishedMovie('Kino C', '2001');
    insertPublishedMovie('Kino D', '2002');
    insertPublishedMovie('Kino E', '2003');

    const adminId = 5002;
    ensureUser(adminId);
    process.env.ADMIN_IDS = String(adminId);

    try {
        const ctx1 = makeFakeCtx(adminId);
        await movieController.showRandomMovie(ctx1);
        assert.equal(ctx1.videos.length, 1, 'admin gets a movie on the first call');

        const ctx2 = makeFakeCtx(adminId);
        await movieController.showRandomMovie(ctx2);
        assert.equal(ctx2.videos.length, 1, 'admin must still get a movie on the second call the same day (no daily limit)');
        assert.equal(ctx2.replies.length, 0, 'admin must not see the "tugadi" limit message at all');
    } finally {
        delete process.env.ADMIN_IDS;
    }
});

test('code-entry rate limiter: regular users are throttled after 5 attempts/minute, admins never are', () => {
    const { isAdminId } = require('../src/config/admins');

    // Mirrors src/bot.js's isCodeAttemptRateLimited() exactly, since bot.js
    // itself calls bot.launch() at module load and can't be require()'d in a
    // test without actually trying to connect to Telegram.
    const codeAttemptLog = {};
    const CODE_ATTEMPT_LIMIT = 5;
    const CODE_ATTEMPT_WINDOW_MS = 60 * 1000;

    function isCodeAttemptRateLimited(userId) {
        if (isAdminId(userId)) return false;
        const now = Date.now();
        const recent = (codeAttemptLog[userId] || []).filter(t => now - t < CODE_ATTEMPT_WINDOW_MS);
        recent.push(now);
        codeAttemptLog[userId] = recent;
        return recent.length > CODE_ATTEMPT_LIMIT;
    }

    delete process.env.ADMIN_IDS;
    const regularUserId = 6001;
    const results = [];
    for (let i = 0; i < 6; i++) {
        results.push(isCodeAttemptRateLimited(regularUserId));
    }
    assert.deepEqual(results, [false, false, false, false, false, true], 'the 6th attempt within a minute must be throttled for a regular user');

    process.env.ADMIN_IDS = '6002';
    try {
        const adminResults = [];
        for (let i = 0; i < 10; i++) {
            adminResults.push(isCodeAttemptRateLimited(6002));
        }
        assert.ok(adminResults.every(r => r === false), 'an admin must never be rate-limited on code entry, no matter how many attempts');
    } finally {
        delete process.env.ADMIN_IDS;
    }
});
