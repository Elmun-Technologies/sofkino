const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { db } = require('../server');

// Get premium analytics with date filtering
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { startDate, endDate, period } = req.query;

        // Calculate date ranges
        const now = new Date();
        let start, end;

        if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        } else if (period === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (period === 'year') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31);
        } else {
            // Default: current month
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = now;
        }

        // Get payments for current period
        const currentPayments = await db.prepare(`
            SELECT 
                subscription_type,
                COUNT(*) as count,
                SUM(amount) as revenue
            FROM payments
            WHERE status = 'success' AND created_at BETWEEN ? AND ?
            GROUP BY subscription_type
        `).all([start.toISOString(), end.toISOString()]);

        // Previous period comparison
        const prevStart = new Date(start);
        prevStart.setMonth(prevStart.getMonth() - 1);
        const prevEnd = new Date(end);
        prevEnd.setMonth(prevEnd.getMonth() - 1);

        const previousPayments = await db.prepare(`
            SELECT SUM(amount) as revenue FROM payments
            WHERE status = 'success' AND created_at BETWEEN ? AND ?
        `).get([prevStart.toISOString(), prevEnd.toISOString()]);

        const currentTotal = currentPayments.reduce((sum, p) => sum + (p.revenue || 0), 0);
        const previousTotal = previousPayments?.revenue || 0;
        const growth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal * 100).toFixed(1) : 0;

        // Forecast for next month (simple linear projection)
        const forecast = Math.round(currentTotal * (1 + growth / 100));

        // Monthly breakdown for the year
        const monthlyData = await db.prepare(`
            SELECT 
                strftime('%Y-%m', created_at) as month,
                SUM(amount) as revenue,
                COUNT(*) as transactions
            FROM payments
            WHERE status = 'success' AND strftime('%Y', created_at) = ?
            GROUP BY month
            ORDER BY month
        `).all([now.getFullYear().toString()]);

        res.json({
            currentPeriod: {
                start: start.toISOString(),
                end: end.toISOString(),
                total: currentTotal,
                byType: currentPayments
            },
            comparison: {
                previousPeriod: previousTotal,
                growth: parseFloat(growth)
            },
            forecast: {
                nextMonth: forecast,
                confidence: growth > 0 ? 'high' : 'medium'
            },
            monthlyBreakdown: monthlyData
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get payment methods stats
router.get('/payment-methods', authMiddleware, async (req, res) => {
    try {
        const stats = await db.prepare(`
            SELECT 
                payment_method,
                COUNT(*) as count,
                SUM(amount) as revenue
            FROM payments
            WHERE status = 'success'
            GROUP BY payment_method
        `).all([]);

        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
