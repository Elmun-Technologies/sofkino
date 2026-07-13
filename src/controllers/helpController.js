const { Markup } = require('telegraf');
const Ticket = require('../models/Ticket');

const helpController = {
    async showHelp(ctx) {
        const helpText = `📞 **Yordam Markazi**\n\nQanday yordam kerak?\n\n💬 Muloqot - Savol yoki muammo haqida yozing\n💳 To'lov bo'yicha yordam - To'lov jarayoni haqida\n📋 Tiketlarim - Ochilgan tiketlar`;

        await ctx.reply(helpText, {
            parse_mode: 'Markdown',
            ...Markup.keyboard([
                ['💬 Muloqot', '💳 To\'lov yordam'],
                ['📋 Tiketlarim'],
                ['⬅️ Orqaga']
            ]).resize()
        });
    },

    async showPaymentHelp(ctx) {
        const paymentGuide = `💳 <b>To'lov bo'yicha Yordam</b>\n\n<b>To'lov qilish:</b>\n1. Premium bo'limiga o'ting\n2. Tarif tanlang\n3. Karta raqamiga to'lov qiling\n4. Chekni adminga yuboring\n\n<b>To'lov masalalari:</b>\nAgar to'lash bilan muammo bo'lsa, tiket yarating yoki to'g'ridan-to'g'ri admin bilan bog'laning: @admin_username`;

        await ctx.reply(paymentGuide, {
            parse_mode: 'HTML',
            ...Markup.keyboard([['⬅️ Orqaga']]).resize()
        });
    },

    async showMyTickets(ctx) {
        // This will be shown via scene
        ctx.reply('Sizning tiketlaringiz:', Markup.keyboard([['⬅️ Orqaga']]).resize());
    }
};

module.exports = helpController;
