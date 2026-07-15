// Multiple admins are supported via ADMIN_IDS (comma-separated Telegram ids).
// ADMIN_ID (singular) still works on its own for backward compatibility.
function getAdminIds() {
    const raw = [process.env.ADMIN_IDS, process.env.ADMIN_ID]
        .filter(Boolean)
        .join(',');

    return [...new Set(
        raw.split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .map(s => parseInt(s, 10))
            .filter(n => !isNaN(n))
    )];
}

function isAdminId(id) {
    if (id === undefined || id === null) return false;
    return getAdminIds().includes(parseInt(id, 10));
}

// Consistent, diagnosable logging for every "notify all admins" loop across
// the bot (channel_post, payment screenshots, payment alerts). Telegraf's
// TelegramError exposes `.code` (Telegram's numeric error_code, e.g. 403) and
// `.description` - surface both so a failure like an admin having blocked the
// bot or never having pressed /start is obvious from the logs instead of a
// bare "Failed to notify admin".
function logAdminNotifyFailure(context, adminId, err) {
    const code = err?.code ?? err?.response?.error_code ?? null;
    const description = err?.description ?? err?.response?.description ?? err?.message ?? String(err);
    const hint = code === 403
        ? " (403 = admin botni bloklagan yoki hech qachon /start bosmagan - u shu ID bilan botga /start yuborishi kerak)"
        : '';
    console.error(`[${context}] Failed to notify admin ${adminId}: code=${code ?? 'noma\'lum'} ${description}${hint}`);
}

module.exports = { getAdminIds, isAdminId, logAdminNotifyFailure };
