const { Scenes, Markup } = require('telegraf');
const Movie = require('../models/Movie');
const Genre = require('../models/Genre');

const addMovieScene = new Scenes.WizardScene(
    'ADD_MOVIE_SCENE',
    (ctx) => {
        ctx.wizard.state.movie = {};
        ctx.reply('🎬 Kino nomini kiriting:', Markup.keyboard(['❌ Bekor qilish']).resize());
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.message.text === '❌ Bekor qilish') return ctx.scene.leave();
        ctx.wizard.state.movie.title = ctx.message.text;
        ctx.reply('Kino haqida qisqacha ma\'lumot kiriting:');
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (ctx.message.text === '❌ Bekor qilish') return ctx.scene.leave();
        ctx.wizard.state.movie.description = ctx.message.text;

        const genres = Genre.getAll();
        if (genres.length === 0) {
            ctx.reply('❌ Avval janr qo\'shing!');
            return ctx.scene.leave();
        }

        const buttons = genres.map(g => [g.name]);
        buttons.push(['❌ Bekor qilish']);

        ctx.reply('Janrni tanlang:', Markup.keyboard(buttons).resize());
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.message.text === '❌ Bekor qilish') return ctx.scene.leave();
        const genre = Genre.getAll().find(g => g.name === ctx.message.text);
        if (!genre) {
            ctx.reply('Iltimos, ro\'yxatdan tanlang.');
            return;
        }
        ctx.wizard.state.movie.genreId = genre.id;
        ctx.reply('Kino faylini (video) yuboring:', Markup.keyboard(['❌ Bekor qilish']).resize());
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.message?.text === '❌ Bekor qilish') return ctx.scene.leave();
        if (!ctx.message?.video && !ctx.message?.document) {
            ctx.reply('Iltimos, video fayl yuboring.');
            return;
        }
        // Prefer file_id from video, fallback to document
        ctx.wizard.state.movie.fileId = ctx.message.video ? ctx.message.video.file_id : ctx.message.document.file_id;

        ctx.reply('Kino uchun kod kiriting (masalan: 101, 777):');
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.message.text === '❌ Bekor qilish') return ctx.scene.leave();
        ctx.wizard.state.movie.accessCode = ctx.message.text;

        ctx.reply('Bu kino faqat Premiumlar uchunmi?', Markup.keyboard(['Ha', 'Yo\'q']).resize());
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.message.text === '❌ Bekor qilish') return ctx.scene.leave();
        const isPremium = ctx.message.text === 'Ha';
        ctx.wizard.state.movie.isPremiumOnly = isPremium;

        ctx.reply('Kino reytingini kiriting (0-10):\n\nMasalan: 8.5, 9.2, 7.0', Markup.keyboard(['❌ Bekor qilish']).resize());
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.message.text === '❌ Bekor qilish') return ctx.scene.leave();

        const rating = parseFloat(ctx.message.text);
        if (isNaN(rating) || rating < 0 || rating > 10) {
            ctx.reply('❌ Noto\'g\'ri reyting! 0 dan 10 gacha bo\'lgan son kiriting.');
            return;
        }

        ctx.wizard.state.movie.rating = rating;

        try {
            Movie.create(ctx.wizard.state.movie);
            ctx.reply(`✅ Kino muvaffaqiyatli qo'shildi!\n\n🎬 Nomi: ${ctx.wizard.state.movie.title}\n🔑 Kod: ${ctx.wizard.state.movie.accessCode}\n⭐ Reyting: ${rating}/10`, require('../keyboards/adminMenu').adminMenu);
        } catch (err) {
            ctx.reply(`❌ Xatolik: ${err.message}`, require('../keyboards/adminMenu').adminMenu);
        }
        return ctx.scene.leave();
    }
);

module.exports = addMovieScene;
