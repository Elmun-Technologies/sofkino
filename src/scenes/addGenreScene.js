const { Scenes, Markup } = require('telegraf');
const Genre = require('../models/Genre');

const addGenreScene = new Scenes.WizardScene(
    'ADD_GENRE_SCENE',
    (ctx) => {
        ctx.reply('Yangi janr nomini kiriting:', Markup.keyboard(['❌ Bekor qilish']).resize());
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (ctx.message.text === '❌ Bekor qilish') {
            ctx.reply('Bekor qilindi.', require('../keyboards/adminMenu').adminMenu);
            return ctx.scene.leave();
        }

        try {
            Genre.create(ctx.message.text);
            ctx.reply(`✅ "${ctx.message.text}" janri muvaffaqiyatli qo'shildi!`, require('../keyboards/adminMenu').adminMenu);
        } catch (error) {
            ctx.reply(`❌ Xatolik: ${error.message}`, require('../keyboards/adminMenu').adminMenu);
        }
        return ctx.scene.leave();
    }
);

module.exports = addGenreScene;
