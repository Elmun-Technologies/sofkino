// Covers the "second admin never gets notified" investigation: getAdminIds()
// must read ADMIN_IDS (comma-separated) correctly, and a failed notification
// must be logged with Telegram's actual error code/description (e.g. 403 =
// blocked the bot / never pressed /start) instead of a bare message.

const test = require('node:test');
const assert = require('node:assert/strict');

test('getAdminIds parses ADMIN_IDS (comma-separated) and dedupes against legacy ADMIN_ID', () => {
    const originalIds = process.env.ADMIN_IDS;
    const originalId = process.env.ADMIN_ID;
    try {
        process.env.ADMIN_IDS = '7401982767, 6241083439, 7401982767';
        process.env.ADMIN_ID = '6241083439'; // legacy var duplicating one of the above

        // Re-require fresh so it's not cached from an earlier test file/run.
        delete require.cache[require.resolve('../src/config/admins')];
        const { getAdminIds } = require('../src/config/admins');

        const ids = getAdminIds();
        assert.deepEqual([...ids].sort(), [6241083439, 7401982767], 'both admins present exactly once, whitespace trimmed, dedup applied');
    } finally {
        if (originalIds === undefined) delete process.env.ADMIN_IDS; else process.env.ADMIN_IDS = originalIds;
        if (originalId === undefined) delete process.env.ADMIN_ID; else process.env.ADMIN_ID = originalId;
        delete require.cache[require.resolve('../src/config/admins')];
    }
});

test('logAdminNotifyFailure logs the Telegram error code and description, with a 403 hint', () => {
    const { logAdminNotifyFailure } = require('../src/config/admins');

    const originalError = console.error;
    const lines = [];
    console.error = (...args) => lines.push(args.join(' '));
    try {
        // Shape of Telegraf's TelegramError: .code / .description getters.
        const blockedErr = { code: 403, description: 'Forbidden: bot was blocked by the user' };
        logAdminNotifyFailure('handleScreenshot', 6241083439, blockedErr);

        assert.equal(lines.length, 1);
        assert.match(lines[0], /\[handleScreenshot\]/);
        assert.match(lines[0], /6241083439/);
        assert.match(lines[0], /code=403/);
        assert.match(lines[0], /Forbidden: bot was blocked by the user/);
        assert.match(lines[0], /403 = admin botni bloklagan/, 'must explain what a 403 means, not just print the code');
    } finally {
        console.error = originalError;
    }
});

test('logAdminNotifyFailure falls back to err.message when there is no Telegram error code', () => {
    const { logAdminNotifyFailure } = require('../src/config/admins');

    const originalError = console.error;
    const lines = [];
    console.error = (...args) => lines.push(args.join(' '));
    try {
        logAdminNotifyFailure('channel_post', 111, new Error('network timeout'));
        assert.equal(lines.length, 1);
        assert.match(lines[0], /code=noma'lum/);
        assert.match(lines[0], /network timeout/);
    } finally {
        console.error = originalError;
    }
});
