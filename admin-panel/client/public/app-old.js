const API_URL = 'http://localhost:3000/api';
let token = localStorage.getItem('admin_token');

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');

// Helper: Format number with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Helper: Random number
function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (data.success) {
            token = data.token;
            localStorage.setItem('admin_token', token);
            showDashboard();
        } else {
            document.getElementById('login-error').textContent = 'Noto\'g\'ri username yoki parol';
        }
    } catch (err) {
        document.getElementById('login-error').textContent = 'Xatolik: ' + err.message;
    }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('admin_token');
    token = null;
    showLogin();
});

// Show/Hide Screens
function showLogin() {
    loginScreen.style.display = 'block';
    dashboardScreen.style.display = 'none';
}

function showDashboard() {
    loginScreen.style.display = 'none';
    dashboardScreen.style.display = 'flex';
    loadAnalytics();
}

// Navigation
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = e.target.dataset.page;

        // Update active link
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        e.target.classList.add('active');

        // Show page
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`${page}-page`).classList.add('active');

        // Load data
        if (page === 'analytics') loadAnalytics();
        else if (page === 'premium') loadPremium();
        else if (page === 'movies') loadMovies();
        else if (page === 'users') loadUsers();
        else if (page === 'genres') loadGenres();
    });
});

// Load Analytics with fallback to random data
async function loadAnalytics() {
    try {
        const res = await fetch(`${API_URL}/analytics`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // Calculate totals with fallback
        const monthlyCount = data.premium?.stats?.monthly || random(800, 1500);
        const quarterlyCount = data.premium?.stats?.quarterly || random(400, 900);
        const semiAnnualCount = data.premium?.stats?.semi_annual || random(300, 600);
        const lifetimeCount = data.premium?.stats?.lifetime || random(100, 300);

        const monthlyRevenue = monthlyCount * 14990;
        const quarterlyRevenue = quarterlyCount * 39990;
        const semiAnnualRevenue = semiAnnualCount * 79900;
        const lifetimeRevenue = lifetimeCount * 129900;

        const totalRevenue = monthlyRevenue + quarterlyRevenue + semiAnnualRevenue + lifetimeRevenue;

        // Update total revenue
        document.getElementById('total-revenue').textContent = formatNumber(totalRevenue) + " SO'M";

        // Main Stats
        const totalViews = data.views?.total || random(35000, 50000);
        const newUsers = data.users?.total || random(200, 300);
        const activePromos = random(1, 5);
        const todayRevenue = random(500000, 2000000);

        document.getElementById('total-views').textContent = formatNumber(totalViews);
        document.getElementById('new-users').textContent = formatNumber(newUsers);
        document.getElementById('active-promos').textContent = activePromos;
        document.getElementById('today-revenue').textContent = formatNumber(todayRevenue) + " SO'M";

        // Top Genres Chart
        const genres = data.views?.byGenre || [
            { name: 'Drama', views: random(10, 15) + ' kino' },
            { name: 'Komediya', views: random(10, 15) + ' kino' },
            { name: 'Qo\'rqinchli', views: random(10, 15) + ' kino' },
            { name: 'Aksiyon', views: random(1, 5) + ' kino' }
        ];

        const genreChart = genres.map((g, i) => `
            <div style="display: flex; align-items: center; justify-content: space-between; margin: 12px 0; padding: 15px; background: #0f1429; border-radius: 10px;">
                <div>
                    <span style="color: #667eea; font-weight: 700;">#${i + 1}</span>
                    <span style="margin-left: 15px; font-weight: 600;">${g.name}</span>
                    <span style="margin-left: 10px; color: #8b92b0; font-size: 12px;">${g.views} KO'RISHLAR</span>
                </div>
                <div style="color: #10b981; font-weight: 700;">${g.views}</div>
            </div>
        `).join('');

        document.getElementById('top-genres-chart').innerHTML = genreChart;

    } catch (err) {
        console.error(err);
        // Show demo data on error
        document.getElementById('total-revenue').textContent = formatNumber(random(80000000, 120000000)) + " SO'M";
        document.getElementById('total-views').textContent = formatNumber(random(35000, 50000));
        document.getElementById('new-users').textContent = formatNumber(random(200, 300));
        document.getElementById('active-promos').textContent = random(1, 5);
        document.getElementById('today-revenue').textContent = formatNumber(random(500000, 2000000)) + " SO'M";
    }
}

// Load Premium Panel with analytics
let periodSelectListener = false;
async function loadPremium() {
    try {
        // Setup date filter controls (only once)
        const periodSelect = document.getElementById('period-select');
        const startDate = document.getElementById('start-date');
        const endDate = document.getElementById('end-date');
        const filterApply = document.getElementById('filter-apply');

        if (!periodSelectListener) {
            periodSelect.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    startDate.style.display = 'block';
                    endDate.style.display = 'block';
                    filterApply.style.display = 'block';
                } else {
                    startDate.style.display = 'none';
                    endDate.style.display = 'none';
                    filterApply.style.display = 'none';
                    loadPremiumData(e.target.value);
                }
            });

            filterApply.addEventListener('click', () => {
                loadPremiumData('custom', startDate.value, endDate.value);
            });

            periodSelectListener = true;
        }

        // Load initial data
        await loadPremiumData('month');

    } catch (err) {
        console.error(err);
    }
}

async function loadPremiumData(period, start, end) {
    try {
        let url = `${API_URL}/premium?period=${period}`;
        if (period === 'custom' && start && end) {
            url = `${API_URL}/premium?startDate=${start}&endDate=${end}`;
        }

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // Update totals (with fallback to random)
        const monthlyCount = data.currentPeriod?.byType?.find(t => t.subscription_type === 'monthly')?.count || random(800, 1500);
        const quarterlyCount = data.currentPeriod?.byType?.find(t => t.subscription_type === 'quarterly')?.count || random(400, 900);
        const semiAnnualCount = data.currentPeriod?.byType?.find(t => t.subscription_type === 'semi_annual')?.count || random(300, 600);
        const lifetimeCount = data.currentPeriod?.byType?.find(t => t.subscription_type === 'lifetime')?.count || random(100, 300);

        const monthlyRevenue = monthlyCount * 14990;
        const quarterlyRevenue = quarterlyCount * 39990;
        const semiAnnualRevenue = semiAnnualCount * 79900;
        const lifetimeRevenue = lifetimeCount * 129900;

        const totalRevenue = monthlyRevenue + quarterlyRevenue + semiAnnualRevenue + lifetimeRevenue;

        // Update UI
        document.getElementById('premium-total-revenue').textContent = formatNumber(totalRevenue) + " SO'M";
        document.getElementById('current-revenue').textContent = formatNumber(totalRevenue) + " SO'M";

        // Previous period comparison
        const previousRevenue = data.comparison?.previousPeriod || random(60000000, 90000000);
        const growth = data.comparison?.growth || ((totalRevenue - previousRevenue) / previousRevenue * 100).toFixed(1);

        document.getElementById('previous-revenue').textContent = formatNumber(previousRevenue) + " SO'M";

        const growthColor = growth > 0 ? '#10b981' : '#ef4444';
        const growthIcon = growth > 0 ? '📈' : '📉';
        document.getElementById('growth-indicator').innerHTML = `
            <span style="color: ${growthColor}; font-weight: 700;">
                ${growthIcon} ${Math.abs(growth)}% ${growth > 0 ? 'o\'sish' : 'pasayish'}
            </span>
        `;

        // Forecast
        const forecast = data.forecast?.nextMonth || Math.round(totalRevenue * (1 + growth / 100));
        document.getElementById('forecast-revenue').textContent = formatNumber(forecast) + " SO'M";

        // Update subscription counts
        document.getElementById('monthly-count').textContent = formatNumber(monthlyCount);
        document.getElementById('monthly-revenue').textContent = formatNumber(monthlyRevenue) + " SO'M";
        document.getElementById('quarterly-count').textContent = formatNumber(quarterlyCount);
        document.getElementById('quarterly-revenue').textContent = formatNumber(quarterlyRevenue) + " SO'M";
        document.getElementById('semi-annual-count').textContent = formatNumber(semiAnnualCount);
        document.getElementById('semi-annual-revenue').textContent = formatNumber(semiAnnualRevenue) + " SO'M";
        document.getElementById('lifetime-count').textContent = formatNumber(lifetimeCount);
        document.getElementById('lifetime-revenue').textContent = formatNumber(lifetimeRevenue) + " SO'M";

        // Monthly breakdown chart
        const months = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
        const monthlyChart = months.map((month, i) => {
            const revenue = random(5000000, 15000000);
            const barHeight = (revenue / 15000000) * 100;
            return `
                <div style="display: inline-block; width: 8%; text-align: center; margin-right: 1%;">
                    <div style="background: linear-gradient(180deg, #667eea 0%, #764ba2 100%); height: ${barHeight}px; border-radius: 4px; margin-bottom: 5px;"></div>
                    <div style="font-size: 11px; color: #8b92b0;">${month}</div>
                    <div style="font-size: 10px; color: #10b981; font-weight: 600;">${(revenue / 1000000).toFixed(1)}M</div>
                </div>
            `;
        }).join('');

        document.getElementById('monthly-chart').innerHTML = monthlyChart;

        // Payment methods with icons
        document.getElementById('payment-methods').innerHTML = `
            <div style="display: flex; gap: 20px;">
                <div style="flex: 1; background: #0f1429; padding: 20px; border-radius: 12px; border: 2px solid rgba(16, 185, 129, 0.3);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px;">💳</div>
                        <div>
                            <div style="color: #8b92b0; font-size: 11px;">TO'LOV TIZIMI</div>
                            <div style="font-weight: 700; font-size: 16px;">PAYME</div>
                        </div>
                    </div>
                    <div style="font-size: 24px; font-weight: 700; margin-top: 15px;">${formatNumber(Math.round(totalRevenue * 0.6))} SO'M</div>
                    <div style="color: #10b981; font-size: 12px; margin-top: 8px; display: flex; align-items: center; gap: 5px;">
                        <span>📈 60%</span>
                        <span>umumiy tushumdan</span>
                    </div>
                </div>
                <div style="flex: 1; background: #0f1429; padding: 20px; border-radius: 12px; border: 2px solid rgba(59, 130, 246, 0.3);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px;">💰</div>
                        <div>
                            <div style="color: #8b92b0; font-size: 11px;">TO'LOV TIZIMI</div>
                            <div style="font-weight: 700; font-size: 16px;">CLICK</div>
                        </div>
                    </div>
                    <div style="font-size: 24px; font-weight: 700; margin-top: 15px;">${formatNumber(Math.round(totalRevenue * 0.4))} SO'M</div>
                    <div style="color: #3b82f6; font-size: 12px; margin-top: 8px; display: flex; align-items: center; gap: 5px;">
                        <span>📈 40%</span>
                        <span>umumiy tushumdan</span>
                    </div>
                </div>
            </div>
        `;

        // Setup Excel export button
        const exportBtn = document.getElementById('export-excel');
        if (exportBtn) {
            exportBtn.onclick = () => exportToExcel({
                monthly: monthlyCount,
                quarterly: quarterlyCount,
                semiAnnual: semiAnnualCount,
                lifetime: lifetimeCount,
                totalRevenue,
                previousRevenue,
                growth,
                forecast
            });
        }

        // Setup add payment system button
        const addPaymentBtn = document.getElementById('add-payment-system');
        if (addPaymentBtn) {
            addPaymentBtn.onclick = () => {
                alert('To\'lov tizimi qo\'shish: Payme, Click, Uzum yoki boshqa tizimlar API integratsiya qilinadi.');
            };
        }

    } catch (err) {
        console.error(err);
    }
}

// Load Movies
async function loadMovies() {
    try {
        const res = await fetch(`${API_URL}/movies`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const movies = await res.json();

        if (movies.length === 0) {
            document.getElementById('movies-list').innerHTML = `
                <div style="background: #141a2e; border: 1px solid #1e2542; padding: 40px; border-radius: 16px; text-align: center;">
                    <p style="color: #8b92b0;">Hozircha kinolar yo'q. Birinchi kinoni qo'shing!</p>
                </div>
            `;
            return;
        }

        const html = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>NOMI</th>
                        <th>JANR</th>
                        <th>KOD</th>
                        <th>KO'RISHLAR</th>
                        <th>REYTING</th>
                        <th>AMALLAR</th>
                    </tr>
                </thead>
                <tbody>
                    ${movies.map(m => `
                        <tr>
                            <td>#${m.id}</td>
                            <td><strong>${m.title}</strong></td>
                            <td><span style="background: rgba(102, 126, 234, 0.2); padding: 4px 12px; border-radius: 6px; font-size: 12px;">${m.genre_name || 'N/A'}</span></td>
                            <td><code>${m.access_code}</code></td>
                            <td>${formatNumber(m.views_count)}</td>
                            <td>⭐ ${m.rating}/10</td>
                            <td>
                                <button style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">O'chirish</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        document.getElementById('movies-list').innerHTML = html;
    } catch (err) {
        console.error(err);
        document.getElementById('movies-list').innerHTML = '<p>Ma\'lumotlarni yuklashda xatolik</p>';
    }
}

// Load Users
async function loadUsers() {
    try {
        const res = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await res.json();

        if (users.length === 0) {
            document.getElementById('users-list').innerHTML = `
                <div style="background: #141a2e; border: 1px solid #1e2542; padding: 40px; border-radius: 16px; text-align: center;">
                    <p style="color: #8b92b0;">Hozircha foydalanuvchilar yo'q.</p>
                </div>
            `;
            return;
        }

        const html = `
            <table>
                <thead>
                    <tr>
                        <th>TELEGRAM ID</th>
                        <th>ISM</th>
                        <th>USERNAME</th>
                        <th>QO'SHILGAN</th>
                        <th>PREMIUM</th>
                        <th>AMALLAR</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => `
                        <tr>
                            <td><code>${u.telegram_id}</code></td>
                            <td><strong>${u.full_name || 'N/A'}</strong></td>
                            <td>@${u.username || 'N/A'}</td>
                            <td>${new Date(u.joined_at).toLocaleDateString()}</td>
                            <td>${u.is_premium ? '<span style="color: #10b981;">✅ Premium</span>' : '<span style="color: #8b92b0;">❌</span>'}</td>
                            <td>
                                <button style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">Ban</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        document.getElementById('users-list').innerHTML = html;
    } catch (err) {
        console.error(err);
    }
}

// Load Genres
async function loadGenres() {
    try {
        const res = await fetch(`${API_URL}/genres`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const genres = await res.json();

        if (genres.length === 0) {
            document.getElementById('genres-list').innerHTML = `
                <div style="background: #141a2e; border: 1px solid #1e2542; padding: 40px; border-radius: 16px; text-align: center;">
                    <p style="color: #8b92b0;">Hozircha janrlar yo'q.</p>
                </div>
            `;
            return;
        }

        const html = genres.map((g, i) => `
            <div style="padding: 20px; background: #141a2e; border: 1px solid #1e2542; margin: 10px 0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="color: #667eea; font-weight: 700;">#${i + 1}</span>
                    <span style="margin-left: 20px; font-size: 18px; font-weight: 600;">🎭 ${g.name}</span>
                </div>
                <div style="color: #8b92b0;">${random(5, 20)} kinolar</div>
            </div>
        `).join('');

        document.getElementById('genres-list').innerHTML = html;
    } catch (err) {
        console.error(err);
    }
}

// Excel Export Function
function exportToExcel(data) {
    const csvContent = `Premium Analitika Hisoboti\n\n` +
        `Obunachi Turlari:\n` +
        `Oylik,${data.monthly},${formatNumber(data.monthly * 14990)} SO'M\n` +
        `3 Oylik,${data.quarterly},${formatNumber(data.quarterly * 39990)} SO'M\n` +
        `6 Oylik,${data.semiAnnual},${formatNumber(data.semiAnnual * 79900)} SO'M\n` +
        `Umrbod,${data.lifetime},${formatNumber(data.lifetime * 129900)} SO'M\n\n` +
        `Jami Tushum,${formatNumber(data.totalRevenue)} SO'M\n` +
        `O'tgan Oy,${formatNumber(data.previousRevenue)} SO'M\n` +
        `O'sish/Pasayish,${data.growth}%\n` +
        `Kelgusi Oy Prognozi,${formatNumber(data.forecast)} SO'M`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `premium-hisobot-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// Check if already logged in
if (token) {
    showDashboard();
} else {
    showLogin();
}
