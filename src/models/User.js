const { db } = require('../config/db');
const { STREAK_MILESTONE_DAYS, STREAK_MILESTONE_BONUS, TZ_OFFSET_SQL } = require('../config/gamification');

function todayLocal() {
    return db.prepare(`SELECT date('now', ?) as d`).get(TZ_OFFSET_SQL).d;
}

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

    // Advances the daily login streak at most once per local day, awarding a
    // bonus unlock every STREAK_MILESTONE_DAYS. Returns whether today already
    // counted so callers only notify the user once per day.
    static touchStreak(telegramId) {
        const user = this.findById(telegramId);
        if (!user) return { awarded: false, streak: 0, gotBonus: false };

        const today = todayLocal();
        if (user.last_streak_date === today) {
            return { awarded: false, streak: user.streak_count, gotBonus: false };
        }

        const yesterday = db.prepare(`SELECT date(?, '-1 day') as d`).get(today).d;
        const newStreak = user.last_streak_date === yesterday ? user.streak_count + 1 : 1;
        const gotBonus = newStreak > 0 && newStreak % STREAK_MILESTONE_DAYS === 0;

        const run = db.transaction(() => {
            db.prepare('UPDATE users SET streak_count = ?, last_streak_date = ? WHERE telegram_id = ?')
                .run(newStreak, today, telegramId);
            if (gotBonus) {
                db.prepare('UPDATE users SET bonus_unlocks = bonus_unlocks + ? WHERE telegram_id = ?')
                    .run(STREAK_MILESTONE_BONUS, telegramId);
            }
        });
        run();

        return { awarded: true, streak: newStreak, gotBonus };
    }

    // Records who invited this user. No-op if already set or self-referral.
    static setReferredBy(telegramId, referrerId) {
        if (telegramId === referrerId) return false;
        const user = this.findById(telegramId);
        if (!user || user.referred_by) return false;

        db.prepare('UPDATE users SET referred_by = ? WHERE telegram_id = ?').run(referrerId, telegramId);
        return true;
    }

    static addBonusUnlocks(telegramId, n) {
        return db.prepare('UPDATE users SET bonus_unlocks = bonus_unlocks + ? WHERE telegram_id = ?').run(n, telegramId);
    }

    // Atomically spends one bonus unlock. Returns true if one was available and spent.
    static useBonusUnlock(telegramId) {
        const spend = db.transaction(() => {
            const user = this.findById(telegramId);
            if (!user || user.bonus_unlocks <= 0) return false;
            db.prepare('UPDATE users SET bonus_unlocks = bonus_unlocks - 1 WHERE telegram_id = ?').run(telegramId);
            return true;
        });
        return spend();
    }

    static getStats(telegramId) {
        const user = this.findById(telegramId);
        if (!user) return null;
        const referralCount = db.prepare('SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?').get(telegramId).count;
        return {
            streak: user.streak_count || 0,
            bonusUnlocks: user.bonus_unlocks || 0,
            referralCount
        };
    }
}

module.exports = User;
