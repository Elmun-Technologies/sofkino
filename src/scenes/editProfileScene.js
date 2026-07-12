const { Scenes, Markup } = require('telegraf');
const User = require('../models/User');
const { db } = require('../config/db');

const editProfileScene = new Scenes.WizardScene(
    'EDIT_PROFILE_SCENE',
    (ctx) => {
        ctx.wizard.state.profile = {};
        ctx.reply('✏️ Ismingizni kiriting:\n\n(Hozirgi: ' + ctx.from.first_name + ')', Markup.keyboard(['❌ Bekor qilish']).resize());
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.message.text === '❌ Bekor qilish') {
            ctx.reply('Bekor qilindi.', require('../keyboards/mainMenu').mainMenu);
            return ctx.scene.leave();
        }

        ctx.wizard.state.profile.customName = ctx.message.text;
        ctx.reply('📞 Telefon raqamingizni kiriting:\n\nMasalan: +998901234567');
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.message.text === '❌ Bekor qilish') {
            ctx.reply('Bekor qilindi.', require('../keyboards/mainMenu').mainMenu);
            return ctx.scene.leave();
        }

        ctx.wizard.state.profile.phoneNumber = ctx.message.text;

        // Update user profile
        const stmt = db.prepare('UPDATE users SET custom_name = ?, phone_number = ? WHERE telegram_id = ?');
        stmt.run(ctx.wizard.state.profile.customName, ctx.wizard.state.profile.phoneNumber, ctx.from.id);

        ctx.reply(`✅ Profil yangilandi!\n\n👤 Ism: ${ctx.wizard.state.profile.customName}\n📞 Telefon: ${ctx.wizard.state.profile.phoneNumber}`,
            require('../keyboards/mainMenu').mainMenu);

        return ctx.scene.leave();
    }
);

module.exports = editProfileScene;
