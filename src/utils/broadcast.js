// Shared throttled send loop, used by the admin broadcast scene and the daily progrev cron job.
async function sendToUsers(telegram, users, payload) {
    const { type = 'text', text = '', mediaId, options = {} } = payload;
    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
        try {
            if (type === 'image') {
                await telegram.sendPhoto(user.telegram_id, mediaId, { caption: text, ...options });
            } else if (type === 'video') {
                await telegram.sendVideo(user.telegram_id, mediaId, { caption: text, ...options });
            } else {
                await telegram.sendMessage(user.telegram_id, text, options);
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
