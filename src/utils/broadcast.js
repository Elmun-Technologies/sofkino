// Shared throttled send loop, used by the admin broadcast scene and the daily progrev cron job.
// `payload.text` may be a plain string (same text for everyone) or a function
// `(user) => string` for per-recipient personalization (e.g. inserting the
// user's display name into a greeting).
async function sendToUsers(telegram, users, payload) {
    const { type = 'text', text = '', mediaId, options = {} } = payload;
    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
        try {
            const messageText = typeof text === 'function' ? text(user) : text;
            if (type === 'image') {
                await telegram.sendPhoto(user.telegram_id, mediaId, { caption: messageText, ...options });
            } else if (type === 'video') {
                await telegram.sendVideo(user.telegram_id, mediaId, { caption: messageText, ...options });
            } else {
                await telegram.sendMessage(user.telegram_id, messageText, options);
            }
            successCount++;
        } catch (err) {
            failCount++;
        }
        await new Promise(r => setTimeout(r, 50));
    }

    return { successCount, failCount };
}

module.exports = { sendToUsers };
