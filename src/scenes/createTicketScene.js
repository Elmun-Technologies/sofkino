const { Scenes, Markup } = require('telegraf');
const Ticket = require('../models/Ticket');

const createTicketScene = new Scenes.WizardScene(
    'CREATE_TICKET_SCENE',
    (ctx) => {
        ctx.reply('💬 Muammongizni yoki savolingizni yozing:', Markup.keyboard(['❌ Bekor qilish']).resize());
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.message.text === '❌ Bekor qilish') {
            ctx.reply('Bekor qilindi.', require('../keyboards/mainMenu').mainMenu);
            return ctx.scene.leave();
        }

        const ticketHash = Ticket.create(ctx.from.id, ctx.message.text);

        ctx.reply(`✅ Tiket yaratildi!\n\n🔖 Tiket kodi: #${ticketHash}\n\nTez orada javob beramiz. Tiketingizni kuzatish uchun ushbu kodni saqlang.`,
            require('../keyboards/mainMenu').mainMenu);

        return ctx.scene.leave();
    }
);

module.exports = createTicketScene;
