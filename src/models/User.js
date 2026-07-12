const { db } = require('../config/db');

class User {
    static createOrUpdate(telegramId, username, fullName) {
        const stmt = db.prepare(`
            INSERT INTO users (telegram_id, username, full_name)
            VALUES (?, ?, ?)
            ON CONFLICT(telegram_id) DO UPDATE SET
            username = excluded.username,
            full_name = excluded.full_name
        `);
        return stmt.run(telegramId, username, fullName);
    }

    static findById(telegramId) {
        const stmt = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
        return stmt.get(telegramId);
    }

    static setPremium(telegramId, days) {
        const user = this.findById(telegramId);
        let start = new Date();
        let end = new Date();

        // If already premium and not expired, extend it
        if (user && user.is_premium && new Date(user.premium_end) > new Date()) {
            start = new Date(user.premium_start);
            end = new Date(user.premium_end);
        }

        end.setDate(end.getDate() + days);

        const stmt = db.prepare(`
            UPDATE users SET 
            is_premium = 1,
            premium_start = ?,
            premium_end = ?
            WHERE telegram_id = ?
        `);
        return stmt.run(start.toISOString(), end.toISOString(), telegramId);
    }
}

module.exports = User;
