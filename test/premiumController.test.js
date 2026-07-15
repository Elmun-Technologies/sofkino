// Regression tests for the "unknown subscription_type must not grant a
// fallback premium duration" bug: approvePayment used to grant a flat 30
// days whenever PLAN_MAP[payment.subscription_type] was missing, silently
// shortchanging (or outright breaking) 3-month/6-month/lifetime payments
// whose subscription_type didn't match a PLAN_MAP key.
//
// Uses a real in-memory better-sqlite3 database (via DB_PATH=':memory:')
// running the actual schema from src/config/db.js, so this exercises the
// real SQL, not a mock.

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_PATH = ':memory:';

const { db, initDb } = require('../src/config/db');
initDb();

const User = require('../src/models/User');
const premiumController = require('../src/controllers/premiumController');

function makeFakeCtx(overrides = {}) {
    const calls = { answerCbQuery: [], editMessageCaption: [], sendMessage: [] };
    const ctx = {
        answerCbQuery: async (text, opts) => { calls.answerCbQuery.push({ text, opts }); },
        editMessageCaption: async (text) => { calls.editMessageCaption.push(text); },
        telegram: {
            sendMessage: async (chatId, text, opts) => { calls.sendMessage.push({ chatId, text, opts }); }
        },
        ...overrides
    };
    return { ctx, calls };
}

function insertUser(telegramId) {
    db.prepare('INSERT INTO users (telegram_id, username, full_name) VALUES (?, ?, ?)').run(telegramId, 'u' + telegramId, 'User ' + telegramId);
}

function insertPendingPayment(userId, subscriptionType) {
    const result = db.prepare(`
        INSERT INTO payments (user_id, amount, payment_method, transaction_id, subscription_type, status)
        VALUES (?, ?, 'manual', ?, ?, 'pending')
    `).run(userId, 14990, `tx_${userId}_${Date.now()}_${Math.random()}`, subscriptionType);
    return result.lastInsertRowid;
}

test('approvePayment: unknown subscription_type does NOT grant premium and leaves the payment pending', async () => {
    const userId = 111;
    insertUser(userId);
    const paymentId = insertPendingPayment(userId, 'this_is_not_a_real_plan_key');

    const { ctx, calls } = makeFakeCtx();
    await premiumController.approvePayment(ctx, paymentId);

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
    assert.equal(payment.status, 'pending', 'payment must stay pending, not be silently approved');

    const user = User.findById(userId);
    assert.equal(user.is_premium, 0, 'user must NOT be granted premium for an unrecognized plan');

    // Admin must be alerted with a visible (show_alert) callback answer.
    assert.equal(calls.answerCbQuery.length, 1);
    assert.equal(calls.answerCbQuery[0].opts?.show_alert, true);
});

test('approvePayment: valid subscription_type grants exactly that plan\'s duration', async () => {
    const userId = 222;
    insertUser(userId);
    const paymentId = insertPendingPayment(userId, '3m'); // 90 days per PLAN_MAP

    const { ctx } = makeFakeCtx();
    await premiumController.approvePayment(ctx, paymentId);

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
    assert.equal(payment.status, 'approved');

    const user = User.findById(userId);
    assert.equal(user.is_premium, 1);

    const daysGranted = Math.round((new Date(user.premium_end) - new Date(user.premium_start)) / 86400000);
    assert.equal(daysGranted, 90, 'a 3-month payment must grant 90 days, never a flat 30-day fallback');
});

test('isPremiumUser correctly parses the ISO premium_end written by User.setPremium', () => {
    const { isAdminId } = require('../src/config/admins');
    function isPremiumUser(user, userId) {
        if (isAdminId(userId)) return true;
        return !!(user && user.is_premium && new Date(user.premium_end) > new Date());
    }

    const userId = 333;
    insertUser(userId);
    User.setPremium(userId, 90); // as approvePayment would for a '3m' plan
    const user = User.findById(userId);

    assert.match(user.premium_end, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'premium_end must be stored as ISO 8601');
    assert.equal(isPremiumUser(user, userId), true, 'an active ISO premium_end must be recognized as premium');

    // A user who never had premium set has premium_end = NULL.
    const neverPremiumId = 444;
    insertUser(neverPremiumId);
    const neverPremiumUser = User.findById(neverPremiumId);
    assert.equal(isPremiumUser(neverPremiumUser, neverPremiumId), false, 'NULL premium_end must not be treated as active premium');
});
