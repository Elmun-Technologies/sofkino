const { isAdminId } = require('../config/admins');

const isAdmin = (ctx, next) => {
    if (ctx.from && isAdminId(ctx.from.id)) {
        return next();
    }
    return ctx.reply('Sizga bu buyruqni bajarishga ruxsat yo\'q.');
};

module.exports = { isAdmin };
