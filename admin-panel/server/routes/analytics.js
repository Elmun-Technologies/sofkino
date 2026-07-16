const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { db } = require('../server');

// Get dashboard analytics
// Get dashboard analytics with filters
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { age_min, age_max, country, interest } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (age_min) {
            whereClause += ' AND u.age >= ?';
            params.push(parseInt(age_min));
        }
        if (age_max) {
            whereClause += ' AND u.age <= ?';
            params.push(parseInt(age_max));
        }
        if (country) {
            whereClause += ' AND u.country = ?';
            params.push(country);
        }
        if (interest) {
            whereClause += ' AND u.interests LIKE ?';
            params.push(`%${interest}%`);
        }

        // Total views with filters
        const viewsCount = await db.prepare(`
            SELECT COUNT(*) as total 
            FROM movie_views mv
            JOIN users u ON mv.user_id = u.telegram_id
            ${whereClause}
        `).get(params);

        // Views by genre with filters
        const viewsByGenre = await db.prepare(`
            SELECT g.name, COUNT(mv.id) as views
            FROM movie_views mv
            JOIN movies m ON mv.movie_id = m.id
            JOIN genres g ON m.genre_id = g.id
            JOIN users u ON mv.user_id = u.telegram_id
            ${whereClause}
            GROUP BY g.id
            ORDER BY views DESC
        `).all(params);

        // Premium stats (usually doesn't need these filters but let's keep it simple)
        const premiumStats = await db.prepare(`
            SELECT 
                COUNT(CASE WHEN julianday(premium_end) - julianday(premium_start) <= 30 THEN 1 END) as monthly,
                COUNT(CASE WHEN julianday(premium_end) - julianday(premium_start) > 30 AND julianday(premium_end) - julianday(premium_start) <= 90 THEN 1 END) as quarterly,
                COUNT(CASE WHEN julianday(premium_end) - julianday(premium_start) > 90 AND julianday(premium_end) - julianday(premium_start) <= 180 THEN 1 END) as semi_annual,
                COUNT(CASE WHEN julianday(premium_end) - julianday(premium_start) > 180 THEN 1 END) as lifetime
            FROM users u
            ${whereClause.replace('WHERE 1=1 AND', 'WHERE')} AND is_premium = 1 AND premium_end > datetime('now')
        `).get(params);

        const revenue = {
            monthly: premiumStats.monthly * 14990,
            quarterly: premiumStats.quarterly * 39990,
            semi_annual: premiumStats.semi_annual * 79900,
            lifetime: premiumStats.lifetime * 129900
        };

        const userStats = await db.prepare(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN is_premium = 1 AND premium_end > datetime('now') THEN 1 END) as premium
            FROM users u
            ${whereClause}
        `).get(params);

        const movieStats = await db.prepare('SELECT COUNT(*) as total FROM movies').get();

        // Active promocodes: not expired and not over their usage limit
        const activePromosRow = await db.prepare(`
            SELECT COUNT(*) as count FROM promocodes p
            WHERE (p.expires_at IS NULL OR p.expires_at > datetime('now'))
            AND (p.usage_limit IS NULL OR (SELECT COUNT(*) FROM promocode_usages pu WHERE pu.promocode_id = p.id) < p.usage_limit)
        `).get([]);

        // Revenue from payments approved today
        const todayRevenueRow = await db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total FROM payments
            WHERE status = 'approved' AND date(created_at) = date('now')
        `).get([]);

        // Top 10 movies for the dashboard
        const topMovies = await db.prepare(`
            SELECT m.id, m.title, m.views_count, m.likes_count, m.shares_count, g.name as genre_name
            FROM movies m
            LEFT JOIN genres g ON m.genre_id = g.id
            ORDER BY m.views_count DESC
            LIMIT 10
        `).all();

        res.json({
            premium: {
                stats: premiumStats,
                revenue
            },
            views: {
                total: viewsCount.total,
                byGenre: viewsByGenre,
                topMovies
            },
            users: userStats,
            movies: movieStats,
            activePromos: activePromosRow.count,
            todayRevenue: todayRevenueRow.total
        });
    } catch (err) {
        console.error('Analytics error:', err);
        res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
    }
});

// Get detailed movie analytics
router.get('/movies/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const movie = await db.prepare(`
            SELECT m.*, g.name as genre_name
            FROM movies m
            LEFT JOIN genres g ON m.genre_id = g.id
            WHERE m.id = ?
        `).get([id]);

        if (!movie) return res.status(404).json({ error: 'Movie not found' });

        const countryStats = await db.prepare(`
            SELECT u.country, COUNT(*) as count
            FROM movie_views mv
            JOIN users u ON mv.user_id = u.telegram_id
            WHERE mv.movie_id = ?
            GROUP BY u.country
            ORDER BY count DESC
        `).all([id]);

        const ageStats = await db.prepare(`
            SELECT 
                CASE 
                    WHEN age < 18 THEN '18-'
                    WHEN age BETWEEN 18 AND 25 THEN '18-25'
                    WHEN age BETWEEN 26 AND 35 THEN '26-35'
                    ELSE '35+'
                END as age_group,
                COUNT(*) as count
            FROM movie_views mv
            JOIN users u ON mv.user_id = u.telegram_id
            WHERE mv.movie_id = ?
            GROUP BY age_group
        `).all([id]);

        res.json({
            ...movie,
            analytics: {
                countries: countryStats,
                ages: ageStats
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
    }
});

module.exports = router;
