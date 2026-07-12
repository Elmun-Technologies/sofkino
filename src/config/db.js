const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../../database.sqlite');
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

    console.log('Database initialized.');
};

module.exports = { db, initDb };
