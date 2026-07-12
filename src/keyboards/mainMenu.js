const { Markup } = require('telegraf');

const mainMenu = Markup.keyboard([
    ['🔑 Kod kiritish', '🎲 Tasodifiy kino'],
    ['🎬 Kinolar', '⭐ Reyting'],
    ['💎 Premium', '📰 Yangiliklar'],
    ['👤 Profil', '📞 Yordam Markazi']
]).resize();

module.exports = { mainMenu };
