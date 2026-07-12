const { Markup } = require('telegraf');
const User = require('../models/User');
const { getPaymentInfo } = require('../config/payment');

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const premiumController = {
    async showPlans(ctx) {
        try {
            const plans = `
💎 <b>Premium Obuna Tariflari</b>

<b>Afzalliklar:</b>
🚫 Reklamasiz
🎥 Premium kinolar
⚡ Tezkor ochish
🎁 Maxsus promokodlar

<b>Tariflar:</b>
🥉 1 oy – 14,990 so'm
🥈 3 oy – 39,990 so'm
🥇 6 oy – 79,900 so'm
👑 Umrbod – 129,900 so'm

To'lov uchun quyidagi tugmalardan birini tanlang:
            `.trim();

            await ctx.reply(plans, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🥉 1 oy', 'premium_1m')],
                    [Markup.button.callback('🥈 3 oy', 'premium_3m')],
                    [Markup.button.callback('🥇 6 oy', 'premium_6m')],
                    [Markup.button.callback('👑 Umrbod', 'premium_lifetime')],
                ])
            });
        } catch (err) {
            console.error('showPlans error:', err);
            try {
                await ctx.reply('❌ Tariflarni ko\'rsatishda xatolik yuz berdi. Birozdan keyin qayta urinib ko\'ring.');
            } catch (e) { }
        }
    },

    async processPayment(ctx, plan) {
        try {
            const planMap = {
                '1m': { days: 30, price: '14,990' },
                '3m': { days: 90, price: '39,990' },
                '6m': { days: 180, price: '79,900' },
                'lifetime': { days: 36500, price: '129,900' } // 100 years ≈ lifetime
            };

            const selectedPlan = planMap[plan];

            if (!selectedPlan) {
                return ctx.answerCbQuery('❌ Noto\'g\'ri tarif');
            }

            // In real scenario, you'd integrate payment gateway here
            // For now, we'll show payment instructions
            const { card } = getPaymentInfo();
            const cardText = card.number
                ? `📱 <code>${escapeHtml(card.number)}</code>${card.holderName ? ` (${escapeHtml(card.holderName)})` : ''}`
                : '⏳ Karta tez orada qo\'shiladi';

            const planLabel = plan === 'lifetime' ? 'Umrbod' : plan.replace('m', ' oy');

            const paymentInfo = `
💳 <b>To'lov ma'lumotlari</b>

<b>Tarif:</b> ${planLabel}

Quyidagi kartaga <b>${selectedPlan.price} so'm</b> summasini o'tkazing:
${cardText}

✅ To'lovni amalga oshirgach, kino kodini kiriting.

❗️ Savol yoki muammo bo'lsa, admin bilan bog'laning: @admin_username
            `.trim();

            await ctx.editMessageText(paymentInfo, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('✅ To\'lov qildim', `payment_confirm_${plan}`)],
                    [Markup.button.callback('⬅️ Orqaga', 'premium_plans')]
                ])
            });
        } catch (err) {
            console.error('processPayment error:', err);
            try {
                await ctx.reply('❌ To\'lov ma\'lumotlarini ko\'rsatishda xatolik yuz berdi. Birozdan keyin qayta urinib ko\'ring.');
            } catch (e) { }
        }
    }
};

module.exports = premiumController;
