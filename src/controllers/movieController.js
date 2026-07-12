const { Markup } = require('telegraf');
const Movie = require('../models/Movie');
const Genre = require('../models/Genre');
const User = require('../models/User');
const { db } = require('../config/db');

const movieController = {
    async showGenres(ctx) {
        const genres = Genre.getAll();

        if (genres.length === 0) {
            return ctx.reply('❌ Hozircha janrlar qo\'shilmagan.');
        }

        const buttons = genres.map(g => [Markup.button.callback(`${g.name}`, `genre_${g.id}`)]);
        buttons.push([Markup.button.callback('⬅️ Orqaga', 'back_to_main')]);

        await ctx.reply('🎬 Janrni tanlang:', Markup.inlineKeyboard(buttons));
    },

    async showMoviesByGenre(ctx) {
        const genreId = parseInt(ctx.match[1]);
        const movies = Movie.findByGenre(genreId);
        const genre = Genre.findById(genreId);

        if (!genre) return ctx.answerCbQuery('Janr topilmadi');

        // Track genre view
        Genre.incrementViews(genreId);

        if (movies.length === 0) {
            return ctx.editMessageText(`❌ ${genre.name} janrida hozircha kinolar yo'q.`, {
                reply_markup: Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'back_to_genres')]]).reply_markup
            });
        }

        let message = `🎭 **${genre.name}** janridagi kinolar:\n\n`;
        message += `👁 Janr ko'rilgan: ${genre.views_count + 1} marta\n\n`;

        const buttons = [];
        // Add Top 10 button at the top
        buttons.push([Markup.button.callback('🔝 Ushbu janrdagi Top 10', `top_genre_${genreId}`)]);

        movies.forEach(movie => {
            buttons.push([Markup.button.callback(`▶️ ${movie.title}`, `movie_${movie.id}`)]);
        });

        buttons.push([Markup.button.callback('⬅️ Orqaga', 'back_to_genres')]);

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
    },

    async showTopByGenre(ctx) {
        const genreId = parseInt(ctx.match[1]);
        const genre = Genre.findById(genreId);
        const topMovies = Movie.getTopByGenre(genreId, 10);

        if (topMovies.length === 0) {
            return ctx.answerCbQuery('Ushbu janrda kinolar yo\'q');
        }

        let message = `🔝 **${genre.name} janridagi Top 10 kinolar:**\n\n`;
        const buttons = [];

        topMovies.forEach((movie, index) => {
            message += `${index + 1}. ${movie.title} (👁 ${movie.views_count})\n`;
            buttons.push([Markup.button.callback(`${index + 1}. ${movie.title}`, `movie_${movie.id}`)]);
        });

        buttons.push([Markup.button.callback('⬅️ Orqaga', `genre_${genreId}`)]);

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
    },

    async showMovieDetails(ctx) {
        const movieId = parseInt(ctx.match[1]);
        const movie = Movie.getAll().find(m => m.id === movieId);

        if (!movie) {
            return ctx.reply('❌ Kino topilmadi.');
        }

        const user = User.findById(ctx.from.id);
        const isPremium = user && user.is_premium && new Date(user.premium_end) > new Date();

        // Check if user has access
        if (movie.is_premium_only && !isPremium) {
            return ctx.editMessageText(`🔒 **${movie.title}**\n\n${movie.description}\n\n❌ Bu kino faqat Premium obunachilarga ochiq!\n💎 Premium obunani faollashtiring.`, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('💎 Premium olish', 'premium_plans')],
                    [Markup.button.callback('⬅️ Orqaga', `genre_${movie.genre_id}`)]
                ])
            });
        }

        // Send movie
        Movie.incrementViews(movieId);

        // Track watch time (simulated for demo purposes, 1-5 minutes per view)
        const randomSeconds = Math.floor(Math.random() * (300 - 60 + 1)) + 60;
        Movie.addWatchTime(movieId, randomSeconds);

        // Log view
        const stmt = db.prepare('INSERT INTO movie_views (user_id, movie_id) VALUES (?, ?)');
        stmt.run(ctx.from.id, movieId);

        await ctx.deleteMessage();

        const latestMovie = Movie.getAll().find(m => m.id === movieId);
        const caption = `🎬 **${latestMovie.title}**\n\n${latestMovie.description}\n\n👁 Ko'rilgan: ${latestMovie.views_count} marta\n👍 ${latestMovie.likes_count} | 👎 ${latestMovie.dislikes_count} | 📤 ${latestMovie.shares_count}`;

        await ctx.replyWithVideo(movie.file_id, {
            caption: caption,
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback(`👍 (${movie.likes_count})`, `movie_like_${movie.id}`),
                    Markup.button.callback(`👎 (${movie.dislikes_count})`, `movie_dislike_${movie.id}`)
                ],
                [Markup.button.callback(`📤 Do'stlarga ulashish (${movie.shares_count})`, `movie_share_${movie.id}`)],
                [Markup.button.callback('⬅️ Orqaga', `genre_${movie.genre_id}`)]
            ])
        });
    },

    async handleLike(ctx) {
        const movieId = parseInt(ctx.match[2]);
        const isLike = ctx.match[1] === 'like' ? 1 : 0;

        try {
            const { likes, dislikes } = Movie.toggleLike(movieId, ctx.from.id, isLike);
            const movie = Movie.getAll().find(m => m.id === movieId);

            await ctx.editMessageCaption(`🎬 **${movie.title}**\n\n${movie.description}\n\n👁 Ko'rilgan: ${movie.views_count} marta\n👍 ${likes} | 👎 ${dislikes} | 📤 ${movie.shares_count}`, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback(`👍 (${likes})`, `movie_like_${movieId}`),
                        Markup.button.callback(`👎 (${dislikes})`, `movie_dislike_${movieId}`)
                    ],
                    [Markup.button.callback(`📤 Do'stlarga ulashish (${movie.shares_count})`, `movie_share_${movieId}`)],
                    [Markup.button.callback('⬅️ Orqaga', `genre_${movie.genre_id}`)]
                ])
            });

            await ctx.answerCbQuery(isLike ? 'Sizga yoqdi! 👍' : 'Sizga yoqmadi! 👎');
        } catch (err) {
            console.error('Like error:', err);
            await ctx.answerCbQuery('Xatolik yuz berdi');
        }
    },

    async handleShare(ctx) {
        const movieId = parseInt(ctx.match[1]);
        const movie = Movie.getAll().find(m => m.id === movieId);

        if (!movie) return ctx.answerCbQuery('Kino topilmadi');

        Movie.addShare(movieId, ctx.from.id);

        const shareLink = `https://t.me/share/url?url=https://t.me/${ctx.botInfo.username}?start=movie_${movie.access_code}&text=Zo'r kino ekan, ko'rishingizni tavsiya qilaman: ${movie.title}`;

        await ctx.answerCbQuery('Ulashish uchun havola tayyor!');
        await ctx.reply(`📤 **${movie.title}** kinosini ulashish:\n\nQuyidagi havola orqali do'stlaringizga yuboring:\n${shareLink}`, {
            parse_mode: 'Markdown'
        });

        // Update the original message to reflect share count
        try {
            const updatedMovie = Movie.getAll().find(m => m.id === movieId);
            await ctx.editMessageCaption(`🎬 **${updatedMovie.title}**\n\n${updatedMovie.description}\n\n👁 Ko'rilgan: ${updatedMovie.views_count} marta\n👍 ${updatedMovie.likes_count} | 👎 ${updatedMovie.dislikes_count} | 📤 ${updatedMovie.shares_count}`, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback(`👍 (${updatedMovie.likes_count})`, `movie_like_${movieId}`),
                        Markup.button.callback(`👎 (${updatedMovie.dislikes_count})`, `movie_dislike_${movieId}`)
                    ],
                    [Markup.button.callback(`📤 Do'stlarga ulashish (${updatedMovie.shares_count})`, `movie_share_${movieId}`)],
                    [Markup.button.callback('⬅️ Orqaga', `genre_${updatedMovie.genre_id}`)]
                ])
            });
        } catch (e) {
            // Silently fail if message cannot be updated
        }
    },

    async unlockByCode(ctx, code) {
        const movie = Movie.findByCode(code.trim());

        if (!movie) {
            return ctx.reply('❌ Bunday kodli kino topilmadi. Kodni qayta tekshiring.');
        }

        const user = User.findById(ctx.from.id);
        const isPremium = user && user.is_premium && new Date(user.premium_end) > new Date();

        if (movie.is_premium_only && !isPremium) {
            return ctx.reply(`🔒 **${movie.title}**\n\nBu kino faqat Premium obunachilarga ochiq!\n💎 Premium obunani faollashtiring.`, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('💎 Premium olish', 'premium_plans')]
                ])
            });
        }

        // Increment views
        Movie.incrementViews(movie.id);

        // Log view
        const stmt = db.prepare('INSERT INTO movie_views (user_id, movie_id) VALUES (?, ?)');
        stmt.run(ctx.from.id, movie.id);

        await ctx.replyWithVideo(movie.file_id, {
            caption: `🎬 **${movie.title}**\n\n${movie.description}\n\n✅ Kod orqali ochildi!\n👁 Ko'rilgan: ${movie.views_count + 1} marta\n👍 ${movie.likes_count} | 👎 ${movie.dislikes_count} | 📤 ${movie.shares_count}`,
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback(`👍 (${movie.likes_count})`, `movie_like_${movie.id}`),
                    Markup.button.callback(`👎 (${movie.dislikes_count})`, `movie_dislike_${movie.id}`)
                ],
                [Markup.button.callback(`📤 Do'stlarga ulashish (${movie.shares_count})`, `movie_share_${movie.id}`)]
            ])
        });
    }
};

module.exports = movieController;
