const { Markup } = require('telegraf');
const User = require('../models/User');
const { db } = require('../config/db');
const { getPaymentInfo } = require('../config/payment');

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PLAN_MAP = {
    '1m': { days: 30, price: 14990, label: '1 oy' },
    '3m': { days: 90, price: 39990, label: '3 oy' },
    '6m': { days: 180, price: 79900, label: '6 oy' },
    'lifetime': { days: 36500, price: 129900, label: 'Umrbod' } // 100 years ≈ lifetime
};

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
            const selectedPlan = PLAN_MAP[plan];

            if (!selectedPlan) {
                return ctx.answerCbQuery('❌ Noto\'g\'ri tarif');
            }

            // In real scenario, you'd integrate payment gateway here
            // For now, we'll show payment instructions
            const { card } = getPaymentInfo();
            const cardText = card.number
                ? `📱 <code>${escapeHtml(card.number)}</code>${card.holderName ? ` (${escapeHtml(card.holderName)})` : ''}`
                : '⏳ Karta tez orada qo\'shiladi';

            const paymentInfo = `
💳 <b>To'lov ma'lumotlari</b>

<b>Tarif:</b> ${selectedPlan.label}

Quyidagi kartaga <b>${selectedPlan.price.toLocaleString('ru-RU')} so'm</b> summasini o'tkazing:
${cardText}

✅ To'lov qilganingizni tasdiqlash uchun pastdagi tugmani bosing — admin tekshirib, Premiumni faollashtiradi.

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
    },

    // User claims they paid manually — logs a pending payment and asks the admin to confirm.
    async confirmPayment(ctx, plan) {
        try {
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
                parse_mode: 'HTML'
            });

            const adminId = process.env.ADMIN_ID;
            if (adminId) {
                const paymentId = result.lastInsertRowid;
                await ctx.telegram.sendMessage(adminId, `💳 <b>Yangi to'lov so'rovi</b>\n\n👤 @${escapeHtml(ctx.from.username || 'yo\'q')} (ID: ${ctx.from.id})\n📦 Tarif: ${selectedPlan.label}\n💰 Narx: ${selectedPlan.price.toLocaleString('ru-RU')} so'm`, {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [
                            Markup.button.callback('✅ Tasdiqlash', `pay_approve_${paymentId}`),
                            Markup.button.callback('❌ Rad etish', `pay_reject_${paymentId}`)
                        ]
                    ])
                }).catch(() => { });
            }
        } catch (err) {
            console.error('confirmPayment error:', err);
            try {
                await ctx.reply('❌ Xatolik yuz berdi. Birozdan keyin qayta urinib ko\'ring.');
            } catch (e) { }
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
