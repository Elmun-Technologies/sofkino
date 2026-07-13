const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Persist the DB on the Fly.io volume (mounted at /data) so users/coins/streaks
// survive redeploys. Locally (no /data) fall back to the repo path.
// DB_PATH env var overrides everything (the Dockerfile sets it in production).
const dbPath = process.env.DB_PATH
    || (fs.existsSync('/data') ? path.join('/data', 'database.sqlite') : path.resolve(__dirname, '../../database.sqlite'));

// Make sure the target directory exists before opening the DB.
try { fs.mkdirSync(path.dirname(dbPath), { recursive: true }); } catch (e) { }

const db = new Database(dbPath); // verbose: console.log

// Initialize Database Schema
const initDb = () => {
    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            telegram_id INTEGER PRIMARY KEY,
            username TEXT,
            full_name TEXT,
            custom_name TEXT,
            phone_number TEXT,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_premium INTEGER DEFAULT 0,
            premium_start DATETIME,
            premium_end DATETIME,
            balance INTEGER DEFAULT 0,
            personality_updated_at DATETIME,
            age INTEGER,
            interests TEXT,
            country TEXT,
            city TEXT,
            last_ip TEXT
        )
    `);

    // "city" doubles as the user's viloyat/hudud, picked from a fixed list in
    // the profile edit scene (not free text) so it's filterable in the admin
    // panel. is_banned backs the admin panel's ban/unban action.
    try { db.exec('ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0'); } catch (e) { }

    // Genres table
    db.exec(`
        CREATE TABLE IF NOT EXISTS genres (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            views_count INTEGER DEFAULT 0
        )
    `);

    // Add views_count to genres if it doesn't exist (for existing databases)
    try { db.exec('ALTER TABLE genres ADD COLUMN views_count INTEGER DEFAULT 0'); } catch (e) { }

    // Movies table
    db.exec(`
        CREATE TABLE IF NOT EXISTS movies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            genre_id INTEGER,
            file_id TEXT,
            access_code TEXT UNIQUE,
            views_count INTEGER DEFAULT 0,
            is_premium_only INTEGER DEFAULT 0,
            rating REAL DEFAULT 0,
            country TEXT,
            release_year INTEGER,
            external_link TEXT,
            telegram_link TEXT,
            external_link_web TEXT,
            likes_count INTEGER DEFAULT 0,
            dislikes_count INTEGER DEFAULT 0,
            shares_count INTEGER DEFAULT 0,
            total_watch_time INTEGER DEFAULT 0,
            FOREIGN KEY (genre_id) REFERENCES genres(id)
        )
    `);

    // Migrations for movies captured from the storage channel
    try { db.exec("ALTER TABLE movies ADD COLUMN status TEXT DEFAULT 'published'"); } catch (e) { }
    try { db.exec('ALTER TABLE movies ADD COLUMN source_channel_id TEXT'); } catch (e) { }
    try { db.exec('ALTER TABLE movies ADD COLUMN source_message_id INTEGER'); } catch (e) { }
    try { db.exec('ALTER TABLE movies ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP'); } catch (e) { }
    // Raw channel post caption, kept so title/genre/description can be re-parsed later if needed
    try { db.exec('ALTER TABLE movies ADD COLUMN source_caption TEXT'); } catch (e) { }

    // Movie Likes
    db.exec(`
        CREATE TABLE IF NOT EXISTS movie_likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            movie_id INTEGER,
            is_like INTEGER DEFAULT 1, -- 1 for like, 0 for dislike
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, movie_id),
            FOREIGN KEY (user_id) REFERENCES users(telegram_id),
            FOREIGN KEY (movie_id) REFERENCES movies(id)
        )
    `);

    // Movie Shares
    db.exec(`
        CREATE TABLE IF NOT EXISTS movie_shares (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            movie_id INTEGER,
            platform TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(telegram_id),
            FOREIGN KEY (movie_id) REFERENCES movies(id)
        )
    `);

    // Codes table (Promocodes)
    db.exec(`
        CREATE TABLE IF NOT EXISTS codes (
            code TEXT PRIMARY KEY,
            type TEXT NOT NULL, -- 'subscription', 'balance', 'movie_unlock'
            value TEXT, -- e.g., '30_days', '1000_sum'
            uses_left INTEGER DEFAULT 1,
            expiry_date DATETIME
        )
    `);

    // Movie Views (Analytics)
    db.exec(`
        CREATE TABLE IF NOT EXISTS movie_views (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            movie_id INTEGER,
            viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(telegram_id),
            FOREIGN KEY (movie_id) REFERENCES movies(id)
        )
    `);

    // How the view was unlocked: 'genre' (browse), 'code' (kod kiritish),
    // 'random' (daily free random movie), 'paid' (bonus-unlock at a paywall)
    try { db.exec("ALTER TABLE movie_views ADD COLUMN source TEXT DEFAULT 'code'"); } catch (e) { }

    // Referrals: who invited whom, and whether the referrer has been rewarded
    db.exec(`
        CREATE TABLE IF NOT EXISTS referrals (
            invited_id INTEGER PRIMARY KEY,
            referrer_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            rewarded INTEGER DEFAULT 0,
            FOREIGN KEY (invited_id) REFERENCES users(telegram_id),
            FOREIGN KEY (referrer_id) REFERENCES users(telegram_id)
        )
    `);

    // Gamification columns on users: daily streak + referral tracking + bonus unlocks
    try { db.exec('ALTER TABLE users ADD COLUMN streak_count INTEGER DEFAULT 0'); } catch (e) { }
    try { db.exec('ALTER TABLE users ADD COLUMN last_streak_date TEXT'); } catch (e) { }
    try { db.exec('ALTER TABLE users ADD COLUMN referred_by INTEGER'); } catch (e) { }
    try { db.exec('ALTER TABLE users ADD COLUMN bonus_unlocks INTEGER DEFAULT 0'); } catch (e) { }

    // News Posts (Broadcasting)
    db.exec(`
        CREATE TABLE IF NOT EXISTS news_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            type TEXT DEFAULT 'text', -- 'text', 'image', 'video', 'link'
            media_id TEXT, -- telegram file_id
            url TEXT, -- for link type
            views_count INTEGER DEFAULT 0,
            likes_count INTEGER DEFAULT 0,
            shares_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Migrations for existing news_posts table
    try { db.exec('ALTER TABLE news_posts ADD COLUMN type TEXT DEFAULT "text"'); } catch (e) { }
    try { db.exec('ALTER TABLE news_posts ADD COLUMN media_id TEXT'); } catch (e) { }
    try { db.exec('ALTER TABLE news_posts ADD COLUMN url TEXT'); } catch (e) { }
    try { db.exec('ALTER TABLE news_posts ADD COLUMN views_count INTEGER DEFAULT 0'); } catch (e) { }
    try { db.exec('ALTER TABLE news_posts ADD COLUMN likes_count INTEGER DEFAULT 0'); } catch (e) { }
    try { db.exec('ALTER TABLE news_posts ADD COLUMN shares_count INTEGER DEFAULT 0'); } catch (e) { }

    // News Likes
    db.exec(`
        CREATE TABLE IF NOT EXISTS news_likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(post_id, user_id),
            FOREIGN KEY (post_id) REFERENCES news_posts(id),
            FOREIGN KEY (user_id) REFERENCES users(telegram_id)
        )
    `);

    // Support Tickets
    db.exec(`
        CREATE TABLE IF NOT EXISTS support_tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            ticket_hash TEXT UNIQUE,
            message TEXT,
            status TEXT DEFAULT 'open',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(telegram_id)
        )
    `);

    // Channels for mandatory subscription
    db.exec(`
        CREATE TABLE IF NOT EXISTS channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            channel_id TEXT NOT NULL UNIQUE,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // News Interactions (for detailed stats)
    db.exec(`
        CREATE TABLE IF NOT EXISTS news_interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER,
            user_id INTEGER,
            type TEXT, -- 'view', 'like', 'share'
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES news_posts(id),
            FOREIGN KEY (user_id) REFERENCES users(telegram_id)
        )
    `);

    // Payments
    db.exec(`
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount INTEGER,
            payment_method TEXT,
            transaction_id TEXT UNIQUE,
            subscription_type TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(telegram_id)
        )
    `);

    // Screenshot the user sent as proof of a manual bank transfer
    try { db.exec('ALTER TABLE payments ADD COLUMN screenshot_file_id TEXT'); } catch (e) { }

    console.log('Database initialized.');
};

module.exports = { db, initDb };
