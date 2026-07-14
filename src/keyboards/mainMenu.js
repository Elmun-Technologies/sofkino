const { Markup } = require('telegraf');

const mainMenu = Markup.keyboard([
    ['🔑 KINO KODINI KIRITISH'],
    ['🎲 Tasodifiy kino', '🎬 Kinolar'],
    ['⭐ Reyting', '💎 Premium'],
    ['📰 Yangiliklar', '👤 Profil'],
    ['📞 Yordam Markazi']
]).resize();

module.exports = { mainMenu };
