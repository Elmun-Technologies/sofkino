const { Markup } = require('telegraf');

const mainMenu = Markup.keyboard([
    ['🔑 Kod kiritish'],
    ['🎬 Kinolar', '⭐ Reyting'],
    ['💎 Premium', '📰 Yangiliklar'],
    ['👤 Profil', '📞 Yordam Markazi']
]).resize();

module.exports = { mainMenu };
