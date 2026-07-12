const { Markup } = require('telegraf');
const News = require('../models/News');

const newsController = {
    async showNews(ctx) {
        const newsPosts = News.getAll(10);

        if (newsPosts.length === 0) {
            return ctx.reply('📰 Hozircha yangiliklar yo\'q.', Markup.keyboard([['⬅️ Orqaga']]).resize());
        }

        const buttons = newsPosts.map(post => [Markup.button.callback(`📰 ${post.title}`, `news_${post.id}`)]);
        buttons.push([Markup.button.callback('⬅️ Orqaga', 'back_to_main')]);

        await ctx.reply('📰 **Yangiliklar**\n\nQuyidagi postlarni o\'qing:', {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
    },

    async showNewsDetail(ctx) {
        const postId = parseInt(ctx.match[1]);
        const post = News.getById(postId);

        if (!post) {
            return ctx.answerCbQuery('Post topilmadi');
        }

        // Track view
        News.addInteraction(postId, ctx.from.id, 'view');

        const hasLiked = News.hasUserLiked(postId, ctx.from.id);
        const likeButton = hasLiked ? `❤️ ${post.likes_count}` : `🤍 ${post.likes_count || ''}`;

        const keyboard = [
            [
                Markup.button.callback(likeButton, `like_news_${postId}`),
                Markup.button.callback(`📤 ${post.shares_count || ''}`, `share_news_${postId}`)
            ],
            [Markup.button.callback('⬅️ Orqaga', 'back_to_news')]
        ];

        if (post.url) {
            keyboard.unshift([Markup.button.url('🔗 Batafsil', post.url)]);
        }

        const caption = `📰 **${post.title}**\n\n${post.content}\n\n👁 ${post.views_count + 1} marta ko'rildi`;

        try {
            if (post.type === 'image' && post.media_id) {
                await ctx.replyWithPhoto(post.media_id, { caption, parse_mode: 'Markdown', ...Markup.inlineKeyboard(keyboard) });
            } else if (post.type === 'video' && post.media_id) {
                await ctx.replyWithVideo(post.media_id, { caption, parse_mode: 'Markdown', ...Markup.inlineKeyboard(keyboard) });
            } else {
                await ctx.reply(caption, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(keyboard) });
            }

            // Delete selection message if possible
            if (ctx.callbackQuery) {
                try { await ctx.deleteMessage(); } catch (e) { }
            }
        } catch (e) {
            console.error('Error showing news detail:', e);
            ctx.reply(caption, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(keyboard) });
        }
    },

    async toggleLike(ctx) {
        const postId = parseInt(ctx.match[1]);
        const hasLiked = News.hasUserLiked(postId, ctx.from.id);

        if (hasLiked) {
            News.removeLike(postId, ctx.from.id);
            await ctx.answerCbQuery('🤍 Yoqtirish olib tashlandi');
        } else {
            News.addInteraction(postId, ctx.from.id, 'like');
            await ctx.answerCbQuery('❤️ Yoqtirdingiz!');
        }

        // Refresh stats on UI
        const post = News.getById(postId);
        const likeButton = !hasLiked ? `❤️ ${post.likes_count}` : `🤍 ${post.likes_count || ''}`;

        const keyboard = [
            [
                Markup.button.callback(likeButton, `like_news_${postId}`),
                Markup.button.callback(`📤 ${post.shares_count || ''}`, `share_news_${postId}`)
            ],
            [Markup.button.callback('⬅️ Orqaga', 'back_to_news')]
        ];

        if (post.url) {
            keyboard.unshift([Markup.button.url('🔗 Batafsil', post.url)]);
        }

        try {
            await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(keyboard).reply_markup);
        } catch (e) {
            // Might fail if content didn't change (fast clicks)
        }
    },

    async handleShare(ctx) {
        const postId = parseInt(ctx.match[1]);
        News.addInteraction(postId, ctx.from.id, 'share');

        const post = News.getById(postId);
        const botUsername = ctx.botInfo.username;
        const shareUrl = `https://t.me/${botUsername}?start=news_${postId}`;

        await ctx.answerCbQuery('📤 Ulashish uchun havolani nusxalang!');

        ctx.reply(`📤 **Ushbu yangilikni do'stlaringizga ulashing:**\n\n${shareUrl}`, {
            parse_mode: 'Markdown'
        });

        // Update share counter on UI
        this.toggleLike(ctx); // Reuse logic to refresh keyboard if needed, but slightly different
    }
};

module.exports = newsController;
