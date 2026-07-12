const { Scenes, Markup } = require('telegraf');
const { db } = require('../config/db');
const News = require('../models/News');

const broadcastScene = new Scenes.WizardScene(
    'BROADCAST_SCENE',
    (ctx) => {
        ctx.wizard.state.broadcast = { type: 'text' };
        ctx.reply('📝 Xabarni yuboring (Text, Rasm yoki Video):', Markup.keyboard(['❌ Bekor qilish']).resize());
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.message?.text === '❌ Bekor qilish') {
            ctx.reply('Bekor qilindi.', require('../keyboards/adminMenu').adminMenu);
            return ctx.scene.leave();
        }

        if (ctx.message.photo) {
            ctx.wizard.state.broadcast.type = 'image';
            ctx.wizard.state.broadcast.mediaId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            ctx.wizard.state.broadcast.text = ctx.message.caption || '';
        } else if (ctx.message.video) {
            ctx.wizard.state.broadcast.type = 'video';
            ctx.wizard.state.broadcast.mediaId = ctx.message.video.file_id;
            ctx.wizard.state.broadcast.text = ctx.message.caption || '';
        } else if (ctx.message.text) {
            ctx.wizard.state.broadcast.type = 'text';
            ctx.wizard.state.broadcast.text = ctx.message.text;
        } else {
            return ctx.reply('⚠️ Iltimos, xabar (text, rasm yoki video) yuboring.');
        }

        ctx.reply('🔗 Tugma uchun link bormi? (Yo\'q bo\'lsa "Yo\'q" deb yozing yoki linkni yuboring):');
        return ctx.wizard.next();
    },
    (ctx) => {
        const text = ctx.message.text;
        if (text !== 'Yo\'q' && text !== '❌ Bekor qilish') {
            ctx.wizard.state.broadcast.url = text;
        }

        ctx.reply('Kimga yuborilsin?', Markup.keyboard([
            ['Barchaga'],
            ['Faqat Premium'],
            ['Faqat Oddiy'],
            ['❌ Bekor qilish']
        ]).resize());

        return ctx.wizard.next();
    },
    async (ctx) => {
        const target = ctx.message.text;
        if (target === '❌ Bekor qilish') {
            ctx.reply('Bekor qilindi.', require('../keyboards/adminMenu').adminMenu);
            return ctx.scene.leave();
        }

        let users = [];
        if (target === 'Barchaga') {
            users = db.prepare('SELECT telegram_id FROM users').all();
        } else if (target === 'Faqat Premium') {
            users = db.prepare('SELECT telegram_id FROM users WHERE is_premium = 1 AND premium_end > datetime("now")').all();
        } else if (target === 'Faqat Oddiy') {
            users = db.prepare('SELECT telegram_id FROM users WHERE is_premium = 0 OR premium_end < datetime("now")').all();
        } else {
            return ctx.reply('Iltimos, tugmalardan birini tanlang.');
        }

        // Create News Post for tracking
        const newsResult = News.create({
            title: ctx.wizard.state.broadcast.text.substring(0, 30) + '...',
            content: ctx.wizard.state.broadcast.text,
            type: ctx.wizard.state.broadcast.type,
            mediaId: ctx.wizard.state.broadcast.mediaId,
            url: ctx.wizard.state.broadcast.url
        });
        const postId = newsResult.lastInsertRowid;

        const keyboard = [
            [
                Markup.button.callback('🤍', `like_news_${postId}`),
                Markup.button.callback('📤', `share_news_${postId}`)
            ]
        ];
        if (ctx.wizard.state.broadcast.url) {
            keyboard.unshift([Markup.button.url('🔗 Batafsil', ctx.wizard.state.broadcast.url)]);
        }

        let successCount = 0;
        let failCount = 0;

        ctx.reply(`📤 Xabar yuborilmoqda... (Jami: ${users.length})`);

        for (const user of users) {
            try {
                const options = { parse_mode: 'Markdown', ...Markup.inlineKeyboard(keyboard) };
                if (ctx.wizard.state.broadcast.type === 'image') {
                    await ctx.telegram.sendPhoto(user.telegram_id, ctx.wizard.state.broadcast.mediaId, { caption: ctx.wizard.state.broadcast.text, ...options });
                } else if (ctx.wizard.state.broadcast.type === 'video') {
                    await ctx.telegram.sendVideo(user.telegram_id, ctx.wizard.state.broadcast.mediaId, { caption: ctx.wizard.state.broadcast.text, ...options });
                } else {
                    await ctx.telegram.sendMessage(user.telegram_id, ctx.wizard.state.broadcast.text, options);
                }
                successCount++;
                await new Promise(r => setTimeout(r, 50));
            } catch (err) {
                failCount++;
            }
        }

        ctx.reply(`✅ Xabar yuborish tugadi!\n\n✅ Muvaffaqiyatli: ${successCount}\n❌ Xatolik: ${failCount}`, require('../keyboards/adminMenu').adminMenu);
        return ctx.scene.leave();
    }
);

module.exports = broadcastScene;
