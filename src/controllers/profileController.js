const User = require('../models/User');
const { db } = require('../config/db');
const { Markup } = require('telegraf');

const profileController = {
    async showProfile(ctx) {
        // Create or update user
        User.createOrUpdate(ctx.from.id, ctx.from.username, ctx.from.first_name);

        const user = User.findById(ctx.from.id);

        if (!user) {
            return ctx.reply('❌ Profil topilmadi.');
        }

        // Calculate days in bot
        const joinedDate = new Date(user.joined_at);
        const now = new Date();
        const daysInBot = Math.floor((now - joinedDate) / (1000 * 60 * 60 * 24));

        // Count watched movies
        const watchedCount = db.prepare('SELECT COUNT(DISTINCT movie_id) as count FROM movie_views WHERE user_id = ?').get(user.telegram_id);

        // Get genre interests
        const genreInterests = db.prepare(`
            SELECT g.name, COUNT(mv.id) as count
            FROM movie_views mv
            JOIN movies m ON mv.movie_id = m.id
            JOIN genres g ON m.genre_id = g.id
            WHERE mv.user_id = ?
            GROUP BY g.id
            ORDER BY count DESC
            LIMIT 3
        `).all(user.telegram_id);

        let interestText = 'Hali kinolar ko\'rilmagan';
        if (genreInterests.length > 0) {
            interestText = genreInterests.map(g => g.name).join(', ');
        }

        // Personality analysis
        let personalityText = '';
        const shouldUpdatePersonality = !user.personality_updated_at ||
            (new Date() - new Date(user.personality_updated_at)) > 7 * 24 * 60 * 60 * 1000; // 7 days

        if (genreInterests.length > 0) {
            const topGenre = genreInterests[0].name.toLowerCase();

            if (topGenre.includes('romantik') || topGenre.includes('romantic')) {
                personalityText = '❤️ Siz emotsiyaga boy va mehr-muhabbatga qadrlovchi insonsiz!';
            } else if (topGenre.includes('qo\'rqinchli') || topGenre.includes('horror')) {
                personalityText = '⚠️ Qo\'rqinchli kinolar sizning uyqungizga zarar qilishi mumkin. Ko\'proq boshqa janrlarni ham sinab ko\'ring!';
            } else if (topGenre.includes('komediya') || topGenre.includes('comedy')) {
                personalityText = '😄 Siz hayotdan zavq oluvchi va kulishni yaxshi ko\'radigan odamsiz!';
            } else if (topGenre.includes('aksiyon') || topGenre.includes('action')) {
                personalityText = '💪 Siz faol va hayajonli hayot tarzini afzal ko\'rasiz!';
            } else if (topGenre.includes('hujjatli') || topGenre.includes('documentary')) {
                personalityText = '🧠 Siz bilim olishni yaxshi ko\'radigan va qiziquvchan insonsiz!';
            } else {
                personalityText = '🎬 Siz turli xil kinolardan zavq olasiz!';
            }

            if (shouldUpdatePersonality) {
                db.prepare('UPDATE users SET personality_updated_at = ? WHERE telegram_id = ?')
                    .run(now.toISOString(), user.telegram_id);
            }
        }

        // Premium status
        let premiumStatus = '❌ Faol emas';
        if (user.is_premium && new Date(user.premium_end) > now) {
            const daysLeft = Math.ceil((new Date(user.premium_end) - now) / (1000 * 60 * 60 * 24));
            premiumStatus = `✅ Faol (${daysLeft} kun qoldi)`;
        }

        const displayName = user.custom_name || user.full_name || 'Noma\'lum';
        const phoneDisplay = user.phone_number || 'Kiritilmagan';
        const stats = User.getStats(user.telegram_id);

        const profile = `
👤 **Profil**

📛 Ism: ${displayName}
📞 Telefon: ${phoneDisplay}
📍 Hudud: ${user.city || 'Kiritilmagan'}
🆔 Username: @${user.username || 'yo\'q'}
📆 Botda: ${daysInBot} kun
💎 Premium: ${premiumStatus}
👁 Ko'rgan kinolar: ${watchedCount.count} ta

🔥 Kunlik seriya: ${stats.streak} kun
🎁 Bepul ochishlar: ${stats.bonusUnlocks} ta
🎟 Takliflar: ${stats.referralCount} ta

🎭 **Qiziqishlar:** ${interestText}

${personalityText}
        `.trim();

        ctx.reply(profile, {
            parse_mode: 'Markdown',
            ...Markup.keyboard([
                ['✏️ Profilni tahrirlash'],
                ['🎟 Do\'st taklif qilish'],
                ['⬅️ Orqaga']
            ]).resize()
        });
    },

    async showReferral(ctx) {
        const stats = User.getStats(ctx.from.id) || { referralCount: 0, bonusUnlocks: 0 };
        const link = `https://t.me/${ctx.botInfo.username}?start=ref_${ctx.from.id}`;

        const message = `
🎟 **Do'stlaringizni taklif qiling!**

Har bir do'stingiz botga qo'shilib, kanallarga a'zo bo'lsa — sizga 1 ta bepul kino ochish beriladi.

🔗 Sizning havolangiz:
${link}

🎁 Bepul ochishlar: ${stats.bonusUnlocks} ta
👥 Taklif qilinganlar: ${stats.referralCount} ta
        `.trim();

        if (ctx.callbackQuery) await ctx.answerCbQuery();
        await ctx.reply(message, { parse_mode: 'Markdown' });
    }
};

module.exports = profileController;
