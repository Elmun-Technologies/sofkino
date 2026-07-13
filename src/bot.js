require('dotenv').config();
const { Telegraf, session, Scenes, Markup } = require('telegraf');
const { initDb } = require('./config/db');
const { mainMenu } = require('./keyboards/mainMenu');
const { adminMenu } = require('./keyboards/adminMenu');
const { isAdmin } = require('./utils/auth');
const User = require('./models/User');
const checkSubscription = require('./utils/subscriptionMiddleware');
const { captureReferral, rewardReferralIfPending } = require('./utils/referralReward');
const { getAdminIds } = require('./config/admins');

// Controllers
const movieController = require('./controllers/movieController');
const profileController = require('./controllers/profileController');
const premiumController = require('./controllers/premiumController');
const ratingController = require('./controllers/ratingController');
const newsController = require('./controllers/newsController');
const helpController = require('./controllers/helpController');
const Movie = require('./models/Movie');

// Scenes
const addGenreScene = require('./scenes/addGenreScene');
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
const stage = new Scenes.Stage([addGenreScene, broadcastScene, editProfileScene, createTicketScene, manageChannelsScene]);

// Safety net: an error thrown anywhere in the middleware chain would otherwise
// crash the whole process and take the bot offline for every user.
bot.catch((err, ctx) => {
    console.error(`Bot error for update ${ctx.update?.update_id}:`, err);
});

// Middleware
bot.use(session());
bot.use(stage.middleware());

// Middleware to track users
bot.use(async (ctx, next) => {
    if (ctx.from) {
        const user = User.findById(ctx.from.id);
        if (!user) {
            // Country/age/interests start unknown (NULL) until the user actually
            // provides them (e.g. via the profile edit scene) - no guessed values.
            const { db } = require('./config/db');
            db.prepare(`
                INSERT INTO users (telegram_id, username, full_name)
                VALUES (?, ?, ?)
            `).run(ctx.from.id, ctx.from.username || null, ctx.from.first_name);
        } else {
            User.createOrUpdate(ctx.from.id, ctx.from.username, ctx.from.first_name);
            if (user.is_banned) {
                return ctx.reply('🚫 Siz botdan foydalanish huquqidan mahrum qilingansiz.').catch(() => { });
            }
        }

        // Daily login streak (awarded at most once per local day)
        const { awarded, streak, gotBonus } = User.touchStreak(ctx.from.id);
        if (awarded) {
            const bonusText = gotBonus ? '\n🎁 Tabriklaymiz! +1 bepul kino ochish qo\'lga kiritdingiz!' : '';
            ctx.reply(`🔥 Kunlik seriyangiz: ${streak} kun!${bonusText}`).catch(() => { });
        }

        // Capture the referral payload here — BEFORE the mandatory-subscription
        // gate below — so it's recorded even if this brand-new user hasn't
        // joined the required channels yet (checkSubscription would otherwise
        // block the update before bot.start's own handler ever ran).
        captureReferral(ctx.from.id, ctx.message && ctx.message.text);
    }
    return next();
});

// Mandatory Subscription Check
bot.use(checkSubscription);

// Movie ingestion from the storage channel
bot.on('channel_post', async (ctx, next) => {
    const post = ctx.channelPost;
    const storageChannelId = process.env.STORAGE_CHANNEL_ID;
    const chatIdMatches = !!storageChannelId && String(post.chat.id) === String(storageChannelId);

    console.log('[channel_post] received', {
        chatId: post.chat.id,
        chatIdType: typeof post.chat.id,
        chatType: post.chat.type,
        messageId: post.message_id,
        storageChannelIdEnv: storageChannelId,
        storageChannelIdEnvType: typeof storageChannelId,
        chatIdMatches
    });

    if (chatIdMatches) {
        const file = post.video || post.document;
        console.log('[channel_post] file check', {
            hasVideo: !!post.video,
            hasDocument: !!post.document,
            fileId: file?.file_id,
            fileSize: file?.file_size,
            mimeType: file?.mime_type,
            hasCaption: !!post.caption
        });

        if (file) {
            try {
                const result = Movie.createPending({
                    fileId: file.file_id,
                    sourceChannelId: post.chat.id,
                    sourceMessageId: post.message_id,
                    caption: post.caption
                });
                console.log('[channel_post] createPending result', {
                    messageId: post.message_id,
                    changes: result?.changes,
                    insertedId: result?.lastInsertRowid,
                    parsedTitle: result?.title
                });

                // Let every admin publish straight from the bot - no computer or
                // admin panel needed. Everything (title/genre/description) was
                // already parsed from the caption above; this just assigns a code.
                // Whichever admin taps the button first publishes it (the others'
                // button then just says "already published").
                if (result?.lastInsertRowid) {
                    const id = result.lastInsertRowid;
                    const title = result.title || '⏳ Nomi aniqlanmadi';
                    const genreNote = result.genreId ? '' : '\n⚠️ Janr avtomatik aniqlanmadi (admin panelda tuzatish mumkin).';
                    for (const adminId of getAdminIds()) {
                        await ctx.telegram.sendMessage(adminId,
                            `🎬 <b>Yangi video keldi</b>\n\n${title}${genreNote}\n\nNashr qilishga tayyor - kod avtomatik biriktiriladi.`,
                            {
                                parse_mode: 'HTML',
                                ...Markup.inlineKeyboard([[Markup.button.callback('✅ Nashr qilish', `movie_publish_auto_${id}`)]])
                            }
                        ).catch(err => console.error(`[channel_post] Failed to notify admin ${adminId}:`, err.message));
                    }
                }
            } catch (err) {
                console.error('[channel_post] Failed to save pending movie:', err);
            }
        } else {
            console.log('[channel_post] no video/document on this post, skipping');
        }
    } else {
        console.log('[channel_post] chat.id does not match STORAGE_CHANNEL_ID, ignoring');
    }

    return next();
});

// One-click publish from the bot itself - for admins without a computer handy.
bot.action(/^movie_publish_auto_(\d+)$/, isAdmin, async (ctx) => {
    const id = parseInt(ctx.match[1]);
    const result = Movie.publishAuto(id);

    if (!result) {
        return ctx.answerCbQuery('Bu video allaqachon nashr qilingan yoki topilmadi');
    }

    await ctx.answerCbQuery('✅ Nashr qilindi');
    await ctx.editMessageText(
        `✅ <b>${result.title}</b> nashr qilindi!\n\n🔑 Kod: <code>${result.accessCode}</code>\n${result.genreName ? `🎭 Janr: ${result.genreName}` : '⚠️ Janr tayinlanmagan - admin panelda tahrirlang.'}`,
        { parse_mode: 'HTML' }
    );
});

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
        await rewardReferralIfPending(ctx.telegram, ctx.from.id).catch(() => { });

        await ctx.answerCbQuery("✅ Rahmat! Endi botdan foydalanishingiz mumkin.");
        return ctx.editMessageText("🎉 Tabriklaymiz! Barcha kanallarga a'zo bo'ldingiz. Asosiy menyuga o'ting:", mainMenu);
    } else {
        return ctx.answerCbQuery("⚠️ Iltimos, barcha kanallarga a'zo bo'ling!", { show_alert: true });
    }
});

// Start command
// (Referral capture already happened earlier in the tracking middleware,
// before the mandatory-subscription gate — see captureReferral above.)
bot.start((ctx) => {
    ctx.reply(`Assalomu alaykum, ${ctx.from.first_name}!
🎬 Kino botiga xush kelibsiz.

Bu yerda minglab kinolarni kod orqali yoki janrlar bo'yicha topishingiz mumkin!`, mainMenu);
});

// Admin Commands
bot.command('admin', isAdmin, (ctx) => {
    ctx.reply('🔐 Admin panelga xush kelibsiz!', adminMenu);
});

bot.hears('➕ Janr qo\'shish', isAdmin, (ctx) => ctx.scene.enter('ADD_GENRE_SCENE'));
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
    return premiumController.requestScreenshot(ctx, ctx.match[1]);
});

bot.action(/^pay_approve_(\d+)$/, isAdmin, (ctx) => premiumController.approvePayment(ctx, parseInt(ctx.match[1])));
bot.action(/^pay_reject_(\d+)$/, isAdmin, (ctx) => premiumController.rejectPayment(ctx, parseInt(ctx.match[1])));

// Handle the payment screenshot the user sends after transferring - accepted
// either as a compressed photo or as an image sent uncompressed (a "document").
bot.on('photo', (ctx, next) => {
    if (premiumController.isAwaitingScreenshot(ctx.from.id)) {
        return premiumController.handleScreenshot(ctx);
    }
    return next();
});

bot.on('document', (ctx, next) => {
    if (premiumController.isAwaitingScreenshot(ctx.from.id)) {
        return premiumController.handleScreenshot(ctx);
    }
    return next();
});

// User Commands - Code Input
let waitingForCode = {};

bot.hears('🔑 Kino kodini kiriting', (ctx) => {
    waitingForCode[ctx.from.id] = true;
    ctx.reply('🔑 Kino kodini kiriting:\n\nMasalan: 101, 777, ABC123');
});

// Handle code input
bot.on('text', (ctx, next) => {
    if (waitingForCode[ctx.from.id]) {
        delete waitingForCode[ctx.from.id];
        return movieController.unlockByCode(ctx, ctx.message.text);
    }
    if (premiumController.isAwaitingScreenshot(ctx.from.id)) {
        return ctx.reply('📸 Iltimos, chek skrinshotini rasm (yoki fayl) sifatida yuboring, matn emas.');
    }
    return next();
});

// Help
bot.hears('📞 Yordam', (ctx) => {
    ctx.reply(`📞 **Yordam**

❓ Kino qanday topiladi?
- Janrlar orqali: 🎬 Kinolar → Janrni tanlang
- Kod orqali: 🔑 Kino kodini kiriting → Kodni kiriting

💎 Premium nima?
- Premium obunachilarga maxsus kinolar va reklamasiz ko'rish imkoniyati beriladi.

📧 Muammo yuzaga keldimi?
Admin bilan bog'lanish: @sofkino_support`, { parse_mode: 'Markdown' });
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
// Telegram remembers the last allowed_updates list used for this bot token
// across restarts/redeploys, so it must be listed explicitly here - otherwise
// a previously narrower list (e.g. one without channel_post) keeps applying
// forever, silently dropping storage-channel posts before they ever reach us.
bot.launch({
    allowedUpdates: ['message', 'edited_message', 'callback_query', 'channel_post', 'edited_channel_post']
}).then(() => {
    console.log('✅ Bot started successfully');
    require('./jobs/progrevJob').start(bot.telegram);
}).catch((err) => {
    console.error('❌ Bot failed to start:', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
