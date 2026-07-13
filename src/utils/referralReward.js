const Referral = require('../models/Referral');
const User = require('../models/User');
const { REFERRAL_BONUS_UNLOCKS } = require('../config/gamification');

// Captures who invited this user, straight from the raw /start text. Runs in
// the tracking middleware — BEFORE the mandatory-subscription gate — so the
// referral is recorded even if the invited user hasn't joined the required
// channels yet (otherwise checkSubscription would block the update before
// bot.start's own handler ever ran). Safe to call on every update:
// User.setReferredBy only writes once, so repeat calls are no-ops.
function captureReferral(invitedId, messageText) {
    if (typeof messageText !== 'string') return;
    const match = /^\/start\s+ref_(\d+)/.exec(messageText);
    if (!match) return;

    const referrerId = parseInt(match[1]);
    if (User.setReferredBy(invitedId, referrerId)) {
        Referral.record(invitedId, referrerId);
    }
}

// Rewards the referrer the moment the invited user is confirmed to have
// passed the subscription gate — whether that's because there was no gate,
// they were already subscribed, or they just clicked "✅ A'zo bo'ldim".
// Call this from every point that lets a user through checkSubscription.
async function rewardReferralIfPending(telegram, invitedId) {
    const referral = Referral.find(invitedId);
    if (!referral || referral.rewarded) return false;

    Referral.markRewarded(invitedId);
    User.addBonusUnlocks(referral.referrer_id, REFERRAL_BONUS_UNLOCKS);
    await telegram.sendMessage(referral.referrer_id, `🎉 Do'stingiz botga qo'shildi! +${REFERRAL_BONUS_UNLOCKS} bepul kino ochish qo'lga kiritdingiz.`).catch(() => { });
    return true;
}

module.exports = { captureReferral, rewardReferralIfPending };
