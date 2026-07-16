require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.ADMIN_PORT || 3000;

// Database connection (shared with bot) — must resolve to the same file the
// bot uses (see src/config/db.js): the Fly.io volume at /data when present.
const fs = require('fs');
const dbPath = process.env.DB_PATH
    || (fs.existsSync('/data') ? path.join('/data', 'database.sqlite') : path.resolve(__dirname, '../../database.sqlite'));
const db = new sqlite3.Database(dbPath);

// Same reasoning as src/config/db.js's pragmas: WAL lets this connection and
// the bot's separate better-sqlite3 connection to the same file read/write
// concurrently instead of taking an exclusive lock per write, and
// busy_timeout makes a write that finds the file locked retry for up to 5s
// instead of failing immediately with SQLITE_BUSY (default busy_timeout is 0).
db.run('PRAGMA journal_mode = WAL', (err) => { if (err) console.error('Failed to set journal_mode=WAL:', err.message); });
db.run('PRAGMA busy_timeout = 5000', (err) => { if (err) console.error('Failed to set busy_timeout:', err.message); });

// Simple wrapper to make sqlite3 work like better-sqlite3
const dbWrapper = {
    prepare: (sql) => ({
        all: (params = []) => new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
        }),
        get: (params = []) => new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
        }),
        run: (params = []) => new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                err ? reject(err) : resolve({ lastID: this.lastID, changes: this.changes });
            });
        })
    })
};

// Export db early to avoid circular dependency
module.exports.db = dbWrapper;

// Middleware
// The admin panel is served from this same origin (app.get('*') below serves
// client/public), so the API never needs to be reachable from arbitrary
// third-party origins. ADMIN_PANEL_ORIGIN can override this for a separately
// hosted frontend; falling back to reflecting no origin restriction only
// when neither is set would defeat the purpose, so default to same-origin
// (no CORS headers needed) rather than the previous wildcard.
const corsOrigin = process.env.ADMIN_PANEL_ORIGIN || false;
app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../client/public')));

// Routes
const authRoutes = require('./routes/auth');
const analyticsRoutes = require('./routes/analytics');
const moviesRoutes = require('./routes/movies');
const usersRoutes = require('./routes/users');
const promocodesRoutes = require('./routes/promocodes');
const genresRoutes = require('./routes/genres');
const broadcastRoutes = require('./routes/broadcast');
const premiumRoutes = require('./routes/premium');
const channelsRoutes = require('./routes/channels');
const dailyMessagesRoutes = require('./routes/dailyMessages');

app.use('/api/auth', authRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/movies', moviesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/promocodes', promocodesRoutes);
app.use('/api/genres', genresRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/channels', channelsRoutes);
app.use('/api/daily-messages', dailyMessagesRoutes);

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Admin Panel running on http://localhost:${PORT}`);
});
