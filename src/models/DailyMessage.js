const { db } = require('../config/db');

class DailyMessage {
    static getAll() {
        const stmt = db.prepare('SELECT * FROM daily_messages ORDER BY day_of_week ASC');
        return stmt.all();
    }

    static getByDay(dayOfWeek) {
        const stmt = db.prepare('SELECT * FROM daily_messages WHERE day_of_week = ?');
        return stmt.get(dayOfWeek);
    }

    static update(dayOfWeek, template) {
        const stmt = db.prepare(`
            UPDATE daily_messages SET template = ?, updated_at = CURRENT_TIMESTAMP
            WHERE day_of_week = ?
        `);
        return stmt.run(template, dayOfWeek);
    }
}

module.exports = DailyMessage;
