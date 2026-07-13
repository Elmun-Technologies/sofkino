const { Scenes, Markup } = require('telegraf');
const User = require('../models/User');
const { db } = require('../config/db');

const REGIONS = [
    'Toshkent shahri', 'Toshkent viloyati',
    'Andijon', "Farg'ona",
    'Namangan', 'Sirdaryo',
    'Jizzax', 'Samarqand',
    'Buxoro', 'Navoiy',
    'Qashqadaryo', 'Surxondaryo',
    'Xorazm', "Qoraqalpog'iston"
];

const regionKeyboard = Markup.keyboard(
    [...Array(Math.ceil(REGIONS.length / 2))].map((_, i) => REGIONS.slice(i * 2, i * 2 + 2))
        .concat([['❌ Bekor qilish']])
).resize();

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
        ctx.reply('📍 Hududingizni tanlang:', regionKeyboard);
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.message.text === '❌ Bekor qilish') {
            ctx.reply('Bekor qilindi.', require('../keyboards/mainMenu').mainMenu);
            return ctx.scene.leave();
        }

        if (!REGIONS.includes(ctx.message.text)) {
            ctx.reply('Iltimos, ro\'yxatdan hududni tanlang.', regionKeyboard);
            return;
        }

        ctx.wizard.state.profile.region = ctx.message.text;

        db.prepare('UPDATE users SET custom_name = ?, phone_number = ?, city = ? WHERE telegram_id = ?')
            .run(ctx.wizard.state.profile.customName, ctx.wizard.state.profile.phoneNumber, ctx.wizard.state.profile.region, ctx.from.id);

        ctx.reply(`✅ Profil yangilandi!\n\n👤 Ism: ${ctx.wizard.state.profile.customName}\n📞 Telefon: ${ctx.wizard.state.profile.phoneNumber}\n📍 Hudud: ${ctx.wizard.state.profile.region}`,
            require('../keyboards/mainMenu').mainMenu);

        return ctx.scene.leave();
    }
);

module.exports = editProfileScene;
