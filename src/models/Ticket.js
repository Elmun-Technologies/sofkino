const { db } = require('../config/db');
const crypto = require('crypto');

class Ticket {
    static create(userId, message) {
        const ticketHash = crypto.randomBytes(4).toString('hex').toUpperCase();
        const stmt = db.prepare('INSERT INTO support_tickets (user_id, ticket_hash, message) VALUES (?, ?, ?)');
        stmt.run(userId, ticketHash, message);
        return ticketHash;
    }

    static getAll(status = 'open') {
        const stmt = db.prepare('SELECT * FROM support_tickets WHERE status = ? ORDER BY created_at DESC');
        return stmt.all(status);
    }

    static findByHash(hash) {
        const stmt = db.prepare('SELECT * FROM support_tickets WHERE ticket_hash = ?');
        return stmt.get(hash);
    }

    static updateStatus(hash, status) {
        const stmt = db.prepare('UPDATE support_tickets SET status = ? WHERE ticket_hash = ?');
        return stmt.run(status, hash);
    }
}

module.exports = Ticket;
