const Channel = require('../models/Channel');
const { Markup } = require('telegraf');

const checkSubscription = async (ctx, next) => {
    // Skip if it's a callback query for 'check_sub' to avoid recursion
    if (ctx.callbackQuery && ctx.callbackQuery.data === 'check_sub') {
        return next();
    }

    // Skip for admins
    const adminId = parseInt(process.env.ADMIN_ID);
    if (ctx.from && ctx.from.id === adminId) {
        return next();
    }

    const activeChannels = Channel.getAll(true);
    if (activeChannels.length === 0) {
        return next();
    }

    const unsubscribed = [];

    for (const channel of activeChannels) {
        try {
            const member = await ctx.telegram.getChatMember(channel.channel_id, ctx.from.id);
            if (['left', 'kicked'].includes(member.status)) {
                unsubscribed.push(channel);
            }
        } catch (e) {
            console.error(`Error checking sub for ${channel.channel_id}:`, e.message);
            // If bot is not admin in channel, we might get an error. 
            // Better to assume subscribed or handle it.
        }
    }

    if (unsubscribed.length > 0) {
        let text = "⚠️ **Botdan foydalanish uchun quyidagi kanallarga a'zo bo'lishingiz shart:**\n\n";
        const buttons = unsubscribed.map(channel => [Markup.button.url(channel.title, channel.url)]);
        buttons.push([Markup.button.callback("✅ A'zo bo'ldim", "check_sub")]);

        if (ctx.callbackQuery) {
            await ctx.answerCbQuery("Iltimos, avval barcha kanallarga a'zo bo'ling!");
            return ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
        } else {
            return ctx.reply(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
        }
    }

    return next();
};

module.exports = checkSubscription;
