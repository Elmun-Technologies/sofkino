const { Markup } = require('telegraf');
const Movie = require('../models/Movie');
const Genre = require('../models/Genre');
const User = require('../models/User');
const { db } = require('../config/db');
const { FREE_RANDOM_PER_DAY, FREE_CODES_PER_MONTH, TZ_OFFSET_SQL } = require('../config/gamification');

function isPremiumUser(user) {
    return !!(user && user.is_premium && new Date(user.premium_end) > new Date());
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// The exact text the movie carries in the storage channel. We deliver this
// verbatim so what the user gets matches the channel one-to-one (description
// and all). Older movies with no stored caption fall back to the parsed
// title/description. Everything is HTML-escaped so a caption containing
// _ * ( ) < etc. can never break Telegram's parser.
function movieBody(movie) {
    if (movie.source_caption && movie.source_caption.trim()) {
        return escapeHtml(movie.source_caption.trim());
    }
    const title = movie.title ? `🎬 ${movie.title}` : '🎬';
    const desc = movie.description ? `\n\n${movie.description}` : '';
    return escapeHtml(`${title}${desc}`);
}

function statsFooter(movie) {
    return `👁 Ko'rilgan: ${movie.views_count} marta\n👍 ${movie.likes_count} | 👎 ${movie.dislikes_count} | 📤 ${movie.shares_count}`;
}

// Full HTML caption for a delivered movie: channel text + code + stats,
// with an optional note (e.g. "Kod orqali ochildi") and trailer (promo line).
function movieCaption(movie, { note = '', trailer = '' } = {}) {
    const codeLine = movie.access_code ? `\n\n🔑 Kod: <code>${escapeHtml(String(movie.access_code))}</code>` : '';
    const noteLine = note ? `\n${note}` : '';
    const trailerBlock = trailer ? `\n\n${trailer}` : '';
    return `${movieBody(movie)}${codeLine}${noteLine}\n\n${statsFooter(movie)}${trailerBlock}`;
}

function randomViewedTodayIds(userId) {
    const rows = db.prepare(`
        SELECT movie_id FROM movie_views
        WHERE user_id = ? AND source = 'random'
        AND date(viewed_at, ?) = date('now', ?)
    `).all(userId, TZ_OFFSET_SQL, TZ_OFFSET_SQL);
    return rows.map(r => r.movie_id);
}

function codeUnlocksThisMonth(userId) {
    return db.prepare(`
        SELECT COUNT(*) as count FROM movie_views
        WHERE user_id = ? AND source = 'code'
        AND strftime('%Y-%m', viewed_at, ?) = strftime('%Y-%m', 'now', ?)
    `).get(userId, TZ_OFFSET_SQL, TZ_OFFSET_SQL).count;
}

function logView(userId, movieId, source) {
    Movie.incrementViews(movieId);
    const randomSeconds = Math.floor(Math.random() * (300 - 60 + 1)) + 60;
    Movie.addWatchTime(movieId, randomSeconds);
    db.prepare('INSERT INTO movie_views (user_id, movie_id, source) VALUES (?, ?, ?)').run(userId, movieId, source);
}

function movieKeyboard(movie, { includeBack = true } = {}) {
    const rows = [
        [
            Markup.button.callback(`👍 (${movie.likes_count})`, `movie_like_${movie.id}`),
            Markup.button.callback(`👎 (${movie.dislikes_count})`, `movie_dislike_${movie.id}`)
        ],
        [Markup.button.callback(`📤 Do'stlarga ulashish (${movie.shares_count})`, `movie_share_${movie.id}`)]
    ];
    if (includeBack) {
        rows.push([Markup.button.callback('⬅️ Orqaga', `genre_${movie.genre_id}`)]);
    }
    return Markup.inlineKeyboard(rows);
}

function paywallKeyboard(user, { bonusAction }) {
    const rows = [[Markup.button.callback('💎 Premium olish', 'premium_plans')]];
    if (user && user.bonus_unlocks > 0) {
        rows.push([Markup.button.callback(`🎁 Bepul ochish (${user.bonus_unlocks} ta bor)`, bonusAction)]);
    }
    rows.push([Markup.button.callback('🎟 Do\'st taklif qilish', 'show_referral')]);
    return Markup.inlineKeyboard(rows);
}

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
        const movie = Movie.findById(movieId);

        if (!movie) {
            return ctx.reply('❌ Kino topilmadi.');
        }

        const user = User.findById(ctx.from.id);
        const isPremium = isPremiumUser(user);

        // Check if user has access
        if (movie.is_premium_only && !isPremium) {
            return ctx.editMessageText(`🔒 <b>${escapeHtml(movie.title)}</b>\n\n❌ Bu kino faqat Premium obunachilarga ochiq!\n💎 Premium obunani faollashtiring.`, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('💎 Premium olish', 'premium_plans')],
                    [Markup.button.callback('⬅️ Orqaga', `genre_${movie.genre_id}`)]
                ])
            });
        }

        // Send movie
        logView(ctx.from.id, movieId, 'genre');

        await ctx.deleteMessage();

        const latestMovie = Movie.findById(movieId);

        await ctx.replyWithVideo(movie.file_id, {
            caption: movieCaption(latestMovie),
            parse_mode: 'HTML',
            ...movieKeyboard(movie)
        });
    },

    async handleLike(ctx) {
        const movieId = parseInt(ctx.match[2]);
        const isLike = ctx.match[1] === 'like' ? 1 : 0;

        try {
            const { likes, dislikes } = Movie.toggleLike(movieId, ctx.from.id, isLike);
            const movie = Movie.findById(movieId);

            await ctx.editMessageCaption(movieCaption(movie), {
                parse_mode: 'HTML',
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
        const movie = Movie.findById(movieId);

        if (!movie) return ctx.answerCbQuery('Kino topilmadi');

        Movie.addShare(movieId, ctx.from.id);

        const shareLink = `https://t.me/share/url?url=https://t.me/${ctx.botInfo.username}?start=movie_${movie.access_code}&text=Zo'r kino ekan, ko'rishingizni tavsiya qilaman: ${movie.title}`;

        await ctx.answerCbQuery('Ulashish uchun havola tayyor!');
        await ctx.reply(`📤 <b>${escapeHtml(movie.title)}</b> kinosini ulashish:\n\nQuyidagi havola orqali do'stlaringizga yuboring:\n${escapeHtml(shareLink)}`, {
            parse_mode: 'HTML'
        });

        // Update the original message to reflect share count
        try {
            const updatedMovie = Movie.findById(movieId);
            await ctx.editMessageCaption(movieCaption(updatedMovie), {
                parse_mode: 'HTML',
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

    async unlockByCode(ctx, code, { viaBonus = false } = {}) {
        const movie = Movie.findByCode(code.trim());

        if (!movie) {
            return ctx.reply('❌ Bunday kodli kino topilmadi. Kodni qayta tekshiring.');
        }

        const user = User.findById(ctx.from.id);
        const isPremium = isPremiumUser(user);

        if (movie.is_premium_only && !isPremium) {
            return ctx.reply(`🔒 <b>${escapeHtml(movie.title)}</b>\n\nBu kino faqat Premium obunachilarga ochiq!\n💎 Premium obunani faollashtiring.`, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('💎 Premium olish', 'premium_plans')]
                ])
            });
        }

        // Monthly free-code quota (premium users are unlimited)
        if (!isPremium && !viaBonus) {
            const usedThisMonth = codeUnlocksThisMonth(ctx.from.id);
            if (usedThisMonth >= FREE_CODES_PER_MONTH) {
                return ctx.reply(`🔒 Bu oy uchun ${FREE_CODES_PER_MONTH} ta bepul kod-kino limitingiz tugadi.`, {
                    ...paywallKeyboard(user, { bonusAction: `use_bonus_code_${movie.access_code}` })
                });
            }
        }

        logView(ctx.from.id, movie.id, viaBonus ? 'paid' : 'code');
        const updatedMovie = Movie.findById(movie.id);

        await ctx.replyWithVideo(movie.file_id, {
            caption: movieCaption(updatedMovie, { note: '✅ Kod orqali ochildi!' }),
            parse_mode: 'HTML',
            ...movieKeyboard(updatedMovie, { includeBack: false })
        });
    },

    // "🎲 Tasodifiy kino" — one free random (non-premium) movie per day.
    async showRandomMovie(ctx) {
        const seenTodayIds = randomViewedTodayIds(ctx.from.id);

        if (seenTodayIds.length >= FREE_RANDOM_PER_DAY) {
            const user = User.findById(ctx.from.id);
            return ctx.reply('🎬 Bugungi tekin kinongiz tugadi! Ertaga yana bittasi kutmoqda.', {
                ...paywallKeyboard(user, { bonusAction: 'use_bonus_random' })
            });
        }

        const movie = Movie.getRandom({ excludeIds: seenTodayIds });
        if (!movie) {
            return ctx.reply('❌ Hozircha bazada kino yo\'q.');
        }

        logView(ctx.from.id, movie.id, 'random');
        const latestMovie = Movie.findById(movie.id);

        await ctx.replyWithVideo(movie.file_id, {
            caption: movieCaption(latestMovie, { trailer: "🎁 Bugungi tekin kinongiz! Ertaga yana bittasi.\nKo'proq ko'rish uchun → 💎 Premium yoki do'st taklif qiling." }),
            parse_mode: 'HTML',
            ...movieKeyboard(movie, { includeBack: false })
        });
    },

    // Spends one bonus_unlock earned from streaks/referrals to get another random movie.
    // Checks a movie is actually available BEFORE spending, so a bonus is never
    // wasted on a delivery that turns out to be impossible.
    async useBonusForRandom(ctx) {
        const user = User.findById(ctx.from.id);
        if (!user || user.bonus_unlocks <= 0) {
            return ctx.answerCbQuery('❌ Sizda bepul ochish qolmagan', { show_alert: true });
        }

        const seenTodayIds = randomViewedTodayIds(ctx.from.id);
        const movie = Movie.getRandom({ excludeIds: seenTodayIds });
        if (!movie) {
            await ctx.answerCbQuery();
            return ctx.reply('❌ Hozircha bazada kino yo\'q.');
        }

        const spent = User.useBonusUnlock(ctx.from.id);
        if (!spent) {
            return ctx.answerCbQuery('❌ Sizda bepul ochish qolmagan', { show_alert: true });
        }
        await ctx.answerCbQuery();

        logView(ctx.from.id, movie.id, 'paid');
        const latestMovie = Movie.findById(movie.id);

        await ctx.replyWithVideo(movie.file_id, {
            caption: movieCaption(latestMovie),
            parse_mode: 'HTML',
            ...movieKeyboard(movie, { includeBack: false })
        });
    },

    // Spends one bonus_unlock to unlock a specific code-locked movie beyond the monthly quota.
    // Confirms the movie still exists BEFORE spending the bonus.
    async useBonusForCode(ctx, code) {
        const user = User.findById(ctx.from.id);
        if (!user || user.bonus_unlocks <= 0) {
            return ctx.answerCbQuery('❌ Sizda bepul ochish qolmagan', { show_alert: true });
        }

        const movie = Movie.findByCode(code.trim());
        if (!movie) {
            await ctx.answerCbQuery();
            return ctx.reply('❌ Bunday kodli kino topilmadi. Kodni qayta tekshiring.');
        }

        const spent = User.useBonusUnlock(ctx.from.id);
        if (!spent) {
            return ctx.answerCbQuery('❌ Sizda bepul ochish qolmagan', { show_alert: true });
        }
        await ctx.answerCbQuery();
        return this.unlockByCode(ctx, code, { viaBonus: true });
    }
};

module.exports = movieController;
