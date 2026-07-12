const { db } = require('../config/db');

class Genre {
    static create(name) {
        const stmt = db.prepare('INSERT INTO genres (name) VALUES (?)');
        try {
            return stmt.run(name);
        } catch (e) {
            if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                throw new Error('Bu janr allaqachon mavjud');
            }
            throw e;
        }
    }

    static getAll() {
        const stmt = db.prepare('SELECT * FROM genres ORDER BY views_count DESC');
        return stmt.all();
    }

    static incrementViews(id) {
        const stmt = db.prepare('UPDATE genres SET views_count = views_count + 1 WHERE id = ?');
        return stmt.run(id);
    }

    static findById(id) {
        const stmt = db.prepare('SELECT * FROM genres WHERE id = ?');
        return stmt.get(id);
    }

    static delete(id) {
        const stmt = db.prepare('DELETE FROM genres WHERE id = ?');
        return stmt.run(id);
    }
}

module.exports = Genre;
