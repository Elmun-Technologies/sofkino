const { Markup } = require('telegraf');

const mainMenu = Markup.keyboard([
    ['🔑 Kino kodini kiriting', '🎲 Tasodifiy kino'],
    ['🎬 Kinolar', '⭐ Reyting'],
    ['💎 Premium', '📰 Yangiliklar'],
    ['👤 Profil', '📞 Yordam Markazi']
]).resize();

module.exports = { mainMenu };
