const { Markup } = require('telegraf');
const User = require('../models/User');

const premiumController = {
    async showPlans(ctx) {
        const plans = `
💎 **Premium Obuna Tariflari**

**Afzalliklar:**
🚫 Reklamasiz
🎥 Premium kinolar
⚡ Tezkor ochish
🎁 Maxsus promokodlar

**Tariflar:**
🥉 1 oy – 14,990 so'm
🥈 3 oy – 39,990 so'm
🥇 6 oy – 79,900 so'm
👑 Umrbod – 129,900 so'm

To'lov uchun quyidagi tugmalardan birini tanlang:
        `.trim();

        await ctx.reply(plans, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🥉 1 oy', 'premium_1m')],
                [Markup.button.callback('🥈 3 oy', 'premium_3m')],
                [Markup.button.callback('🥇 6 oy', 'premium_6m')],
                [Markup.button.callback('👑 Umrbod', 'premium_lifetime')],
            ])
        });
    },

    async processPayment(ctx, plan) {
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

        const paymentInfo = `
💳 **To'lov ma'lumotlari**

**Tarif:** ${plan === 'lifetime' ? 'Umrbod' : plan.replace('m', ' oy')}
**Narx:** ${selectedPlan.price} so'm

**To'lov qilish:**
1. Quyidagi karta raqamiga pul o'tkazing:
   📱 8600 1234 5678 9012
   
2. To'lov chekini adminga yuboring:
   👤 @admin_username

3. Admin tasdiqlashidan keyin Premium faollashadi

❗️ To'lov chekida Telegram username yoki ID ko'rsatilgan bo'lishi kerak.
        `.trim();

        await ctx.editMessageText(paymentInfo, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✅ To\'lov qildim', `payment_confirm_${plan}`)],
                [Markup.button.callback('⬅️ Orqaga', 'premium_plans')]
            ])
        });
    }
};

module.exports = premiumController;
