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

module.exports = { getAdminIds, isAdminId };
