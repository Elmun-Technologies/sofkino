const { db } = require('../config/db');

class Channel {
    static create(title, url, channelId) {
        const stmt = db.prepare('INSERT INTO channels (title, url, channel_id) VALUES (?, ?, ?)');
        return stmt.run(title, url, channelId);
    }

    static getAll(activeOnly = false) {
        const sql = activeOnly
            ? 'SELECT * FROM channels WHERE is_active = 1'
            : 'SELECT * FROM channels';
        return db.prepare(sql).all();
    }

    static update(id, data) {
        const { title, url, channel_id, is_active } = data;
        const stmt = db.prepare(`
            UPDATE channels 
            SET title = ?, url = ?, channel_id = ?, is_active = ?
            WHERE id = ?
        `);
        return stmt.run(title, url, channel_id, is_active ? 1 : 0, id);
    }

    static delete(id) {
        return db.prepare('DELETE FROM channels WHERE id = ?').run(id);
    }

    static toggleActive(id) {
        return db.prepare('UPDATE channels SET is_active = 1 - is_active WHERE id = ?').run(id);
    }
}

module.exports = Channel;
