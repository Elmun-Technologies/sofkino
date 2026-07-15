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
app.use(cors());
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
