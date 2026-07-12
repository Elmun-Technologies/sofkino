const { Markup } = require('telegraf');
const User = require('../models/User');
const { db } = require('../config/db');

const PLAN_MAP = {
    '1m': { days: 30, price: 14990, label: '1 oy' },
    '3m': { days: 90, price: 39990, label: '3 oy' },
    '6m': { days: 180, price: 79900, label: '6 oy' },
    'lifetime': { days: 36500, price: 129900, label: 'Umrbod' } // 100 years ≈ lifetime
};

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
        const selectedPlan = PLAN_MAP[plan];

        if (!selectedPlan) {
            return ctx.answerCbQuery('❌ Noto\'g\'ri tarif');
        }

        // In real scenario, you'd integrate payment gateway here
        // For now, we'll show payment instructions

        const paymentInfo = `
💳 **To'lov ma'lumotlari**

**Tarif:** ${selectedPlan.label}
**Narx:** ${selectedPlan.price.toLocaleString('ru-RU')} so'm

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
    },

    // User claims they paid manually — logs a pending payment and asks the admin to confirm.
    async confirmPayment(ctx, plan) {
        const selectedPlan = PLAN_MAP[plan];
        if (!selectedPlan) {
            return ctx.answerCbQuery('❌ Noto\'g\'ri tarif');
        }

        const transactionId = `manual_${ctx.from.id}_${Date.now()}`;
        const result = db.prepare(`
            INSERT INTO payments (user_id, amount, payment_method, transaction_id, subscription_type, status)
            VALUES (?, ?, 'manual', ?, ?, 'pending')
        `).run(ctx.from.id, selectedPlan.price, transactionId, plan);

        await ctx.editMessageText('✅ So\'rovingiz qabul qilindi!\n\n⏳ Admin to\'lovni tekshirib, tez orada Premiumni faollashtiradi.', {
            parse_mode: 'Markdown'
        });

        const adminId = process.env.ADMIN_ID;
        if (adminId) {
            const paymentId = result.lastInsertRowid;
            await ctx.telegram.sendMessage(adminId, `💳 **Yangi to'lov so'rovi**\n\n👤 @${ctx.from.username || 'yo\'q'} (ID: ${ctx.from.id})\n📦 Tarif: ${selectedPlan.label}\n💰 Narx: ${selectedPlan.price.toLocaleString('ru-RU')} so'm`, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('✅ Tasdiqlash', `pay_approve_${paymentId}`),
                        Markup.button.callback('❌ Rad etish', `pay_reject_${paymentId}`)
                    ]
                ])
            }).catch(() => { });
        }
    },

    async approvePayment(ctx, paymentId) {
        const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
        if (!payment || payment.status !== 'pending') {
            return ctx.answerCbQuery('Bu so\'rov allaqachon ko\'rib chiqilgan');
        }

        const plan = PLAN_MAP[payment.subscription_type];
        db.prepare(`UPDATE payments SET status = 'approved' WHERE id = ?`).run(paymentId);
        User.setPremium(payment.user_id, plan ? plan.days : 30);

        await ctx.answerCbQuery('✅ Tasdiqlandi');
        await ctx.editMessageText(`✅ To'lov #${paymentId} tasdiqlandi. Premium faollashtirildi.`);
        await ctx.telegram.sendMessage(payment.user_id, `🎉 To'lovingiz tasdiqlandi! Premium obuna faollashtirildi.`).catch(() => { });
    },

    async rejectPayment(ctx, paymentId) {
        const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
        if (!payment || payment.status !== 'pending') {
            return ctx.answerCbQuery('Bu so\'rov allaqachon ko\'rib chiqilgan');
        }

        db.prepare(`UPDATE payments SET status = 'rejected' WHERE id = ?`).run(paymentId);

        await ctx.answerCbQuery('❌ Rad etildi');
        await ctx.editMessageText(`❌ To'lov #${paymentId} rad etildi.`);
        await ctx.telegram.sendMessage(payment.user_id, `❌ To'lovingiz tasdiqlanmadi. Admin bilan bog'laning: @admin_username`).catch(() => { });
    }
};

module.exports = premiumController;
