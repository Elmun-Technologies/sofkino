const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

// 5 attempts per 15 minutes per IP - login was previously unthrottled, making
// the admin password brute-forceable at any rate the attacker's connection
// allowed.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Juda ko\'p urinish. 15 daqiqadan keyin qayta urinib ko\'ring.' }
});

// Constant-time string comparison. Hashing both sides to a fixed-length
// digest first avoids crypto.timingSafeEqual's "different length" throw
// (which would otherwise itself leak length information) while comparing
// with `===` on the raw strings is timing-attackable character by character.
function safeCompare(a, b) {
    const hashA = crypto.createHash('sha256').update(String(a ?? '')).digest();
    const hashB = crypto.createHash('sha256').update(String(b ?? '')).digest();
    return crypto.timingSafeEqual(hashA, hashB);
}

// Login
router.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    // Simple hardcoded admin check (in production, use database)
    if (safeCompare(username, process.env.ADMIN_USERNAME) && safeCompare(password, process.env.ADMIN_PASSWORD)) {
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token });
    }

    res.status(401).json({ success: false, error: 'Invalid credentials' });
});

// Verify token
router.get('/verify', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ valid: false });
    }

    try {
        jwt.verify(token, process.env.JWT_SECRET);
        res.json({ valid: true });
    } catch (err) {
        res.status(401).json({ valid: false });
    }
});

module.exports = router;
