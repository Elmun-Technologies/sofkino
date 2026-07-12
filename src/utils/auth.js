const isAdmin = (ctx, next) => {
    const adminId = parseInt(process.env.ADMIN_ID);
    if (ctx.from.id === adminId) {
        return next();
    }
    return ctx.reply('Sizga bu buyruqni bajarishga ruxsat yo\'q.');
};

module.exports = { isAdmin };
