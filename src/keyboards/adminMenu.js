const { Markup } = require('telegraf');

const adminMenu = Markup.keyboard([
    ['➕ Janr qo\'shish'],
    ['📊 Statistika', '👥 Foydalanuvchilar'],
    ['📤 Xabar yuborish', '📢 Kanallar'],
    ['⬅️ Bosh menyu']
]).resize();

module.exports = { adminMenu };

