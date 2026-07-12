require('dotenv').config();
const { Telegraf, session, Scenes, Markup } = require('telegraf');
const { initDb } = require('./config/db');
const { mainMenu } = require('./keyboards/mainMenu');
const { adminMenu } = require('./keyboards/adminMenu');
const { isAdmin } = require('./utils/auth');
const User = require('./models/User');
const Referral = require('./models/Referral');
const checkSubscription = require('./utils/subscriptionMiddleware');
const { REFERRAL_BONUS_UNLOCKS } = require('./config/gamification');

// Controllers
const movieController = require('./controllers/movieController');
const profileController = require('./controllers/profileController');
const premiumController = require('./controllers/premiumController');
const ratingController = require('./controllers/ratingController');
const newsController = require('./controllers/newsController');
const helpController = require('./controllers/helpController');

// Scenes
const addGenreScene = require('./scenes/addGenreScene');
const addMovieScene = require('./scenes/addMovieScene');
const broadcastScene = require('./scenes/broadcastScene');
const editProfileScene = require('./scenes/editProfileScene');
const createTicketScene = require('./scenes/createTicketScene');
const manageChannelsScene = require('./scenes/manageChannelsScene');

// Initialize Database
try {
    initDb();
} catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
}

if (!process.env.BOT_TOKEN) {
    console.error('BOT_TOKEN is missing in .env file');
    process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const stage = new Scenes.Stage([addGenreScene, addMovieScene, broadcastScene, editProfileScene, createTicketScene, manageChannelsScene]);

// Middleware
bot.use(session());
bot.use(stage.middleware());

// Middleware to track users (with basic demographic tracking for analytics)
bot.use(async (ctx, next) => {
    if (ctx.from) {
        // In a real scenario, we might use a GeoIP service or ask the user
        // For demonstration/initial tracking, we'll set defaults if not exists
        const user = User.findById(ctx.from.id);
        if (!user) {
            // New user: random demographics for demo/analytics variety
            const countries = ["O'zbekiston", "Rossiya", "AQSH", "Qozog'iston"];
            const interests = ["Drama", "Komediya", "Qo'rqinchli", "Aksiyon", "Fantastika"];

            const randomCountry = countries[Math.floor(Math.random() * countries.length)];
            const randomAge = Math.floor(Math.random() * (45 - 16 + 1)) + 16;
            const randomInterest = interests[Math.floor(Math.random() * interests.length)];

            const { db } = require('./config/db');
            db.prepare(`
                INSERT INTO users (telegram_id, username, full_name, country, age, interests)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(ctx.from.id, ctx.from.username || null, ctx.from.first_name, randomCountry, randomAge, randomInterest);
        } else {
            User.createOrUpdate(ctx.from.id, ctx.from.username, ctx.from.first_name);
        }

        // Daily login streak (awarded at most once per local day)
        const { awarded, streak, gotBonus } = User.touchStreak(ctx.from.id);
        if (awarded) {
            const bonusText = gotBonus ? '\n🎁 Tabriklaymiz! +1 bepul kino ochish qo\'lga kiritdingiz!' : '';
            ctx.reply(`🔥 Kunlik seriyangiz: ${streak} kun!${bonusText}`).catch(() => { });
        }
    }
    return next();
});

// Mandatory Subscription Check
bot.use(checkSubscription);

bot.action('check_sub', async (ctx) => {
    const activeChannels = require('./models/Channel').getAll(true);
    let allSubscribed = true;

    for (const channel of activeChannels) {
        try {
            const member = await ctx.telegram.getChatMember(channel.channel_id, ctx.from.id);
            if (['left', 'kicked'].includes(member.status)) {
                allSubscribed = false;
                break;
            }
        } catch (e) {
            console.error(`Error checking sub for ${channel.channel_id}:`, e.message);
        }
    }

    if (allSubscribed) {
        // Reward the referrer once the invited user actually subscribes (blocks referral farming)
        const referral = Referral.find(ctx.from.id);
        if (referral && !referral.rewarded) {
            Referral.markRewarded(ctx.from.id);
            User.addBonusUnlocks(referral.referrer_id, REFERRAL_BONUS_UNLOCKS);
            ctx.telegram.sendMessage(referral.referrer_id, `🎉 Do'stingiz botga qo'shildi! +${REFERRAL_BONUS_UNLOCKS} bepul kino ochish qo'lga kiritdingiz.`).catch(() => { });
        }

        await ctx.answerCbQuery("✅ Rahmat! Endi botdan foydalanishingiz mumkin.");
        return ctx.editMessageText("🎉 Tabriklaymiz! Barcha kanallarga a'zo bo'ldingiz. Asosiy menyuga o'ting:", mainMenu);
    } else {
        return ctx.answerCbQuery("⚠️ Iltimos, barcha kanallarga a'zo bo'ling!", { show_alert: true });
    }
});

// Start command
bot.start((ctx) => {
    const refMatch = /^ref_(\d+)$/.exec(ctx.startPayload || '');
    if (refMatch) {
        const referrerId = parseInt(refMatch[1]);
        if (User.setReferredBy(ctx.from.id, referrerId)) {
            Referral.record(ctx.from.id, referrerId);
        }
    }

    ctx.reply(`Assalomu alaykum, ${ctx.from.first_name}!
🎬 Kino botiga xush kelibsiz.

Bu yerda minglab kinolarni kod orqali yoki janrlar bo'yicha topishingiz mumkin!`, mainMenu);
});

// Admin Commands
bot.command('admin', isAdmin, (ctx) => {
    ctx.reply('🔐 Admin panelga xush kelibsiz!', adminMenu);
});

bot.hears('➕ Janr qo\'shish', isAdmin, (ctx) => ctx.scene.enter('ADD_GENRE_SCENE'));
bot.hears('➕ Kino qo\'shish', isAdmin, (ctx) => ctx.scene.enter('ADD_MOVIE_SCENE'));
bot.hears('👥 Foydalanuvchilar', isAdmin, (ctx) => {
    const { db } = require('./config/db');
    const users = db.prepare('SELECT * FROM users ORDER BY joined_at DESC LIMIT 20').all();
    let message = '👥 **Oxirgi 20 foydalanuvchi:**\n\n';
    users.forEach(u => {
        message += `• ${u.full_name} (@${u.username || 'yo\'q'})\n`;
    });
    ctx.reply(message, { parse_mode: 'Markdown', ...Markup.keyboard([['📤 Xabar yuborish'], ['⬅️ Bosh menyu']]).resize() });
});
bot.hears('📤 Xabar yuborish', isAdmin, (ctx) => ctx.scene.enter('BROADCAST_SCENE'));
bot.hears('📢 Kanallar', isAdmin, (ctx) => ctx.scene.enter('MANAGE_CHANNELS_SCENE'));
bot.hears('⬅️ Bosh menyu', (ctx) => ctx.reply('Asosiy menyu', mainMenu));

// Admin stats
bot.hears('📊 Statistika', isAdmin, (ctx) => {
    const { db } = require('./config/db');
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const movieCount = db.prepare('SELECT COUNT(*) as count FROM movies').get().count;
    const viewCount = db.prepare('SELECT COUNT(*) as count FROM movie_views').get().count;
    const premiumCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_premium = 1 AND premium_end > datetime("now")').get().count;

    ctx.reply(`📊 **Bot Statistikasi**

👥 Foydalanuvchilar: ${userCount}
💎 Premium: ${premiumCount}
🎬 Kinolar: ${movieCount}
👁 Jami ko'rishlar: ${viewCount}`, { parse_mode: 'Markdown' });
});

// User Commands - Movies
bot.hears('🎬 Kinolar', (ctx) => movieController.showGenres(ctx));
bot.hears('🎲 Tasodifiy kino', (ctx) => movieController.showRandomMovie(ctx));

bot.action('use_bonus_random', (ctx) => movieController.useBonusForRandom(ctx));
bot.action(/^use_bonus_code_(.+)$/, (ctx) => movieController.useBonusForCode(ctx, ctx.match[1]));
bot.action('show_referral', (ctx) => profileController.showReferral(ctx));
bot.hears('🎟 Do\'st taklif qilish', (ctx) => profileController.showReferral(ctx));

// User Commands - Rating
bot.hears('⭐ Reyting', (ctx) => ratingController.showRatingMenu(ctx));
bot.hears('📅 Haftaning eng top', (ctx) => ratingController.showTopRated(ctx, 'week'));
bot.hears('📆 Oyning eng top', (ctx) => ratingController.showTopRated(ctx, 'month'));
bot.hears('📊 Yilning eng top', (ctx) => ratingController.showTopRated(ctx, 'year'));
bot.action('back_to_rating_menu', (ctx) => {
    ctx.answerCbQuery();
    return ratingController.showRatingMenu(ctx);
});

bot.action(/^genre_(\d+)$/, (ctx) => {
    ctx.answerCbQuery();
    return movieController.showMoviesByGenre(ctx);
});

bot.action(/^top_genre_(\d+)$/, (ctx) => {
    ctx.answerCbQuery();
    return movieController.showTopByGenre(ctx);
});

bot.action('back_to_genres', (ctx) => {
    ctx.answerCbQuery();
    return movieController.showGenres(ctx);
});

bot.action(/^movie_(like|dislike)_(\d+)$/, (ctx) => {
    return movieController.handleLike(ctx);
});

bot.action(/^movie_share_(\d+)$/, (ctx) => {
    return movieController.handleShare(ctx);
});

bot.action(/^movie_(\d+)$/, (ctx) => {
    ctx.answerCbQuery();
    return movieController.showMovieDetails(ctx);
});

// User Commands - Profile
bot.hears('👤 Profil', (ctx) => profileController.showProfile(ctx));
bot.hears('✏️ Profilni tahrirlash', (ctx) => ctx.scene.enter('EDIT_PROFILE_SCENE'));

// User Commands - Premium
bot.hears('💎 Premium', (ctx) => premiumController.showPlans(ctx));
bot.hears('💎 Premium Obuna', (ctx) => premiumController.showPlans(ctx));
bot.action('premium_plans', (ctx) => {
    ctx.answerCbQuery();
    return premiumController.showPlans(ctx);
});

bot.action(/^premium_(.+)$/, (ctx) => {
    ctx.answerCbQuery();
    const plan = ctx.match[1];
    return premiumController.processPayment(ctx, plan);
});

bot.action(/^payment_confirm_(.+)$/, (ctx) => {
    ctx.answerCbQuery();
    return premiumController.confirmPayment(ctx, ctx.match[1]);
});

bot.action(/^pay_approve_(\d+)$/, isAdmin, (ctx) => premiumController.approvePayment(ctx, parseInt(ctx.match[1])));
bot.action(/^pay_reject_(\d+)$/, isAdmin, (ctx) => premiumController.rejectPayment(ctx, parseInt(ctx.match[1])));

// User Commands - Code Input
let waitingForCode = {};

bot.hears('🔑 Kod kiritish', (ctx) => {
    waitingForCode[ctx.from.id] = true;
    ctx.reply('🔑 Kino kodini kiriting:\n\nMasalan: 101, 777, ABC123');
});

// Handle code input
bot.on('text', (ctx) => {
    if (waitingForCode[ctx.from.id]) {
        delete waitingForCode[ctx.from.id];
        return movieController.unlockByCode(ctx, ctx.message.text);
    }
});

// Help
bot.hears('📞 Yordam', (ctx) => {
    ctx.reply(`📞 **Yordam**

❓ Kino qanday topiladi?
- Janrlar orqali: 🎬 Kinolar → Janrni tanlang
- Kod orqali: 🔑 Kod kiritish → Kodni kiriting

💎 Premium nima?
- Premium obunachilarga maxsus kinolar va reklamasiz ko'rish imkoniyati beriladi.

📧 Muammo yuzaga keldimi?
Admin bilan bog'lanish: @admin_username`, { parse_mode: 'Markdown' });
});

// News
bot.hears('📰 Yangiliklar', (ctx) => newsController.showNews(ctx));
bot.action(/^news_(\d+)$/, (ctx) => {
    ctx.answerCbQuery();
    return newsController.showNewsDetail(ctx);
});
bot.action(/^like_news_(\d+)$/, (ctx) => newsController.toggleLike(ctx));
bot.action(/^share_news_(\d+)$/, (ctx) => newsController.handleShare(ctx));
bot.action('back_to_news', (ctx) => {
    ctx.answerCbQuery();
    return newsController.showNews(ctx);
});
bot.action('back_to_main', (ctx) => {
    ctx.answerCbQuery();
    return ctx.reply('Asosiy menyu', mainMenu);
});

// Help
bot.hears('📞 Yordam Markazi', (ctx) => helpController.showHelp(ctx));
bot.hears('📞 Yordam', (ctx) => helpController.showHelp(ctx));
bot.hears('💬 Muloqot', (ctx) => ctx.scene.enter('CREATE_TICKET_SCENE'));
bot.hears('💳 To\'lov yordam', (ctx) => helpController.showPaymentHelp(ctx));
bot.hears('📋 Tiketlarim', (ctx) => helpController.showMyTickets(ctx));

// Back button
bot.hears('⬅️ Orqaga', (ctx) => ctx.reply('Asosiy menyu', mainMenu));

// Launch bot
bot.launch().then(() => {
    console.log('✅ Bot started successfully');
    require('./jobs/progrevJob').start(bot.telegram);
}).catch((err) => {
    console.error('❌ Bot failed to start:', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
