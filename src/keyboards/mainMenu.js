const { Markup } = require('telegraf');

const mainMenu = Markup.keyboard([
    ['🔑 Kino kodini kiriting'],
    ['🎬 Kinolar', '⭐ Reyting'],
    ['💎 Premium', '📰 Yangiliklar'],
    ['👤 Profil', '📞 Yordam Markazi']
]).resize();

module.exports = { mainMenu };
