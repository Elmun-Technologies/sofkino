const { Scenes, Markup } = require('telegraf');
const Channel = require('../models/Channel');

const manageChannelsScene = new Scenes.BaseScene('MANAGE_CHANNELS_SCENE');

manageChannelsScene.enter(async (ctx) => {
    const channels = Channel.getAll();
    let message = '📢 **Majburiy obuna kanallari:**\n\n';

    const buttons = [];
    if (channels.length === 0) {
        message += "Hozircha kanallar yo'q.";
    } else {
        channels.forEach(ch => {
            message += `${ch.is_active ? '✅' : '❌'} ${ch.title} (${ch.channel_id})\n`;
            buttons.push([
                Markup.button.callback(`${ch.is_active ? 'OFF' : 'ON'} ${ch.title}`, `toggle_channel_${ch.id}`),
                Markup.button.callback('🗑', `del_channel_${ch.id}`)
            ]);
        });
    }

    buttons.push([Markup.button.callback('➕ Yangi kanal qo\'shish', 'add_channel')]);
    buttons.push([Markup.button.callback('⬅️ Orqaga', 'back_to_admin')]);

    await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
    });
});

manageChannelsScene.action('add_channel', (ctx) => {
    ctx.reply('Kanal ma\'lumotlarini quyidagi formatda yuboring:\n\n`Kanal nomi | @kanal_yoki_id | https://t.me/link`', { parse_mode: 'Markdown' });
});

manageChannelsScene.on('text', async (ctx) => {
    const text = ctx.message.text;
    const parts = text.split('|').map(p => p.trim());

    if (parts.length === 3) {
        const [title, channelId, url] = parts;
        try {
            Channel.create(title, url, channelId);
            ctx.reply('✅ Kanal muvaffaqiyatli qo\'shildi!');
            return ctx.scene.reenter();
        } catch (e) {
            ctx.reply('❌ Xatolik: ' + e.message);
        }
    } else {
        ctx.reply('⚠️ Noto\'g\'ri format. Qaytadan urinib ko\'ring.');
    }
});

manageChannelsScene.action(/^toggle_channel_(\d+)$/, async (ctx) => {
    const id = parseInt(ctx.match[1]);
    Channel.toggleActive(id);
    await ctx.answerCbQuery('Holat o\'zgartirildi');
    return ctx.scene.reenter();
});

manageChannelsScene.action(/^del_channel_(\d+)$/, async (ctx) => {
    const id = parseInt(ctx.match[1]);
    Channel.delete(id);
    await ctx.answerCbQuery('Kanal o\'chirildi');
    return ctx.scene.reenter();
});

manageChannelsScene.action('back_to_admin', (ctx) => {
    ctx.scene.leave();
    return ctx.reply('Admin panel', require('../keyboards/adminMenu').adminMenu);
});

module.exports = manageChannelsScene;
