const { db } = require('../config/db');

class Referral {
    static record(invitedId, referrerId) {
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO referrals (invited_id, referrer_id)
            VALUES (?, ?)
        `);
        return stmt.run(invitedId, referrerId);
    }

    static find(invitedId) {
        return db.prepare('SELECT * FROM referrals WHERE invited_id = ?').get(invitedId);
    }

    static getCountFor(referrerId) {
        return db.prepare('SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?').get(referrerId).count;
    }

    static markRewarded(invitedId) {
        return db.prepare('UPDATE referrals SET rewarded = 1 WHERE invited_id = ?').run(invitedId);
    }
}

module.exports = Referral;
