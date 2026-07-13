const { Markup } = require('telegraf');
const User = require('../models/User');
const { db } = require('../config/db');
const { getPaymentInfo } = require('../config/payment');
const { getAdminIds } = require('../config/admins');

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PLAN_MAP = {
    '1m': { days: 30, price: 14990, label: '1 oy' },
    '3m': { days: 90, price: 39990, label: '3 oy' },
    '6m': { days: 180, price: 79900, label: '6 oy' },
    'lifetime': { days: 36500, price: 129900, label: 'Umrbod' } // 100 years ≈ lifetime
};

// userId -> plan key, while we're waiting for their payment screenshot
const waitingForScreenshot = {};

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

📸 To'lovni amalga oshirgach, <b>chek skrinshotini shu chatga rasm sifatida yuboring</b> — admin tekshirib, Premiumni faollashtiradi.

❗️ Savol yoki muammo bo'lsa, admin bilan bog'laning: @sofkino_support
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

    // Step 1: user says they paid — ask for the screenshot instead of trusting the click.
    async requestScreenshot(ctx, plan) {
        try {
            const selectedPlan = PLAN_MAP[plan];
            if (!selectedPlan) {
                return ctx.answerCbQuery('❌ Noto\'g\'ri tarif');
            }

            waitingForScreenshot[ctx.from.id] = plan;

            await ctx.editMessageText(
                `📸 <b>To'lov chekini yuboring</b>\n\nKartaga <b>${selectedPlan.price.toLocaleString('ru-RU')} so'm</b> o'tkazgan bo'lsangiz, endi shu chatga chek skrinshotini rasm sifatida yuboring.`,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'premium_plans')]])
                }
            );
        } catch (err) {
            console.error('requestScreenshot error:', err);
        }
    },

    isAwaitingScreenshot(userId) {
        return !!waitingForScreenshot[userId];
    },

    // Step 2: the screenshot photo arrives — log the pending payment and forward
    // the actual screenshot to the admin so they can verify it before approving.
    async handleScreenshot(ctx) {
        const plan = waitingForScreenshot[ctx.from.id];
        delete waitingForScreenshot[ctx.from.id];

        const selectedPlan = PLAN_MAP[plan];
        if (!selectedPlan) return;

        try {
            const photos = ctx.message.photo;
            const fileId = photos[photos.length - 1].file_id;

            const transactionId = `manual_${ctx.from.id}_${Date.now()}`;
            const result = db.prepare(`
                INSERT INTO payments (user_id, amount, payment_method, transaction_id, subscription_type, status, screenshot_file_id)
                VALUES (?, ?, 'manual', ?, ?, 'pending', ?)
            `).run(ctx.from.id, selectedPlan.price, transactionId, plan, fileId);

            await ctx.reply('✅ Chek qabul qilindi!\n\n⏳ Admin tekshirib, tez orada Premiumni faollashtiradi.');

            const paymentId = result.lastInsertRowid;
            for (const adminId of getAdminIds()) {
                await ctx.telegram.sendPhoto(adminId, fileId, {
                    caption: `💳 <b>Yangi to'lov so'rovi</b>\n\n👤 @${escapeHtml(ctx.from.username || 'yo\'q')} (ID: ${ctx.from.id})\n📦 Tarif: ${selectedPlan.label}\n💰 Narx: ${selectedPlan.price.toLocaleString('ru-RU')} so'm`,
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [
                            Markup.button.callback('✅ Tasdiqlash', `pay_approve_${paymentId}`),
                            Markup.button.callback('❌ Rad etish', `pay_reject_${paymentId}`)
                        ]
                    ])
                }).catch(err => console.error(`Failed to notify admin ${adminId} of payment:`, err.message));
            }
        } catch (err) {
            console.error('handleScreenshot error:', err);
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
        // The admin notification is a photo (the screenshot), so its caption -
        // not its text - has to be edited.
        await ctx.editMessageCaption(`✅ To'lov #${paymentId} tasdiqlandi. Premium faollashtirildi.`).catch(() => { });
        await ctx.telegram.sendMessage(payment.user_id, `🎉 To'lovingiz tasdiqlandi! Premium obuna faollashtirildi.`).catch(() => { });
    },

    async rejectPayment(ctx, paymentId) {
        const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
        if (!payment || payment.status !== 'pending') {
            return ctx.answerCbQuery('Bu so\'rov allaqachon ko\'rib chiqilgan');
        }

        db.prepare(`UPDATE payments SET status = 'rejected' WHERE id = ?`).run(paymentId);

        await ctx.answerCbQuery('❌ Rad etildi');
        await ctx.editMessageCaption(`❌ To'lov #${paymentId} rad etildi.`).catch(() => { });
        await ctx.telegram.sendMessage(payment.user_id, `❌ To'lovingiz tasdiqlanmadi. Admin bilan bog'laning: @sofkino_support`).catch(() => { });
    }
};

module.exports = premiumController;
