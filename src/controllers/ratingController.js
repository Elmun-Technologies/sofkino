const { Markup } = require('telegraf');
const Movie = require('../models/Movie');
const { db } = require('../config/db');

const ratingController = {
    async showRatingMenu(ctx) {
        const message = '⭐ **Reytingli Kinolar**\n\nQaysi davr uchun top kinolarni ko\'rmoqchisiz?';

        await ctx.reply(message, {
            parse_mode: 'Markdown',
            ...Markup.keyboard([
                ['📅 Haftaning eng top', '📆 Oyning eng top'],
                ['📊 Yilning eng top'],
                ['⬅️ Orqaga']
            ]).resize()
        });
    },

    async showTopRated(ctx, period = 'all') {
        let movies = [];
        let title = '';

        const now = new Date();

        if (period === 'week') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const stmt = db.prepare(`
                SELECT m.*, COUNT(mv.id) as recent_views
                FROM movies m
                LEFT JOIN movie_views mv ON m.id = mv.movie_id AND mv.viewed_at > ?
                WHERE m.status = 'published'
                GROUP BY m.id
                HAVING m.rating > 0 OR recent_views > 0
                ORDER BY m.rating DESC, recent_views DESC
                LIMIT 10
            `);
            movies = stmt.all(oneWeekAgo.toISOString());
            title = '📅 **Haftaning Eng Top Filmlari**';
        } else if (period === 'month') {
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const stmt = db.prepare(`
                SELECT m.*, COUNT(mv.id) as recent_views
                FROM movies m
                LEFT JOIN movie_views mv ON m.id = mv.movie_id AND mv.viewed_at > ?
                WHERE m.status = 'published'
                GROUP BY m.id
                HAVING m.rating > 0 OR recent_views > 0
                ORDER BY m.rating DESC, recent_views DESC
                LIMIT 10
            `);
            movies = stmt.all(oneMonthAgo.toISOString());
            title = '📆 **Oyning Eng Top Filmlari**';
        } else if (period === 'year') {
            const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            const stmt = db.prepare(`
                SELECT m.*, COUNT(mv.id) as recent_views
                FROM movies m
                LEFT JOIN movie_views mv ON m.id = mv.movie_id AND mv.viewed_at > ?
                WHERE m.status = 'published'
                GROUP BY m.id
                HAVING m.rating > 0 OR recent_views > 0
                ORDER BY m.rating DESC, recent_views DESC
                LIMIT 10
            `);
            movies = stmt.all(oneYearAgo.toISOString());
            title = '📊 **Yilning Eng Top Filmlari**';
        }

        if (movies.length === 0) {
            return ctx.reply('❌ Hozircha reytingli kinolar yo\'q.', Markup.keyboard([['⬅️ Orqaga']]).resize());
        }

        let message = title + '\n\n';

        const buttons = [];
        movies.forEach((movie, index) => {
            const ratingLine = movie.rating > 0
                ? `   ${'⭐'.repeat(Math.round(movie.rating / 2))} ${movie.rating}/10\n`
                : '';
            message += `${index + 1}. 🎬 ${movie.title}\n${ratingLine}   👁 ${movie.views_count} ko\'rilgan\n\n`;
            buttons.push([Markup.button.callback(`${index + 1}. ${movie.title}${movie.rating > 0 ? ` (${movie.rating}/10)` : ''}`, `movie_${movie.id}`)]);
        });

        buttons.push([Markup.button.callback('⬅️ Orqaga', 'back_to_rating_menu')]);

        await ctx.reply(message, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
    }
};

module.exports = ratingController;
