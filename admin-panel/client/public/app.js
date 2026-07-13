const API_URL = window.location.origin + '/api';
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

// Keep the year filter's options current instead of a hardcoded past year
const yearFilterEl = document.getElementById('year-filter');
if (yearFilterEl) {
    const currentYear = new Date().getFullYear();
    yearFilterEl.innerHTML = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3]
        .map(y => `<option value="${y}">${y}</option>`).join('');
}

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        console.log('Login attempt...', { username });
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        console.log('Login response:', data);

        if (data.success) {
            token = data.token;
            localStorage.setItem('admin_token', token);
            showDashboard();
        } else {
            document.getElementById('login-error').textContent = data.error || 'Noto\'g\'ri username yoki parol';
        }
    } catch (err) {
        console.error('Login error:', err);
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
    loadMovies(); // Pre-load movies
}

// Navigation
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = e.currentTarget.dataset.page;

        // Update active link
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        e.currentTarget.classList.add('active');

        // Show page
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`${page}-page`).classList.add('active');

        // Load data
        if (page === 'analytics') loadAnalytics();
        else if (page === 'premium') loadPremium();
        else if (page === 'movies') loadMovies();
        else if (page === 'users') loadUsers();
        else if (page === 'promocodes') loadPromocodes();
        else if (page === 'genres') loadGenres();
        else if (page === 'channels') loadChannels();
        else if (page === 'broadcast') loadBroadcasts();
    });
});

// Movie Management Initializers
document.getElementById('close-add-movie').addEventListener('click', () => {
    document.getElementById('add-movie-modal').style.display = 'none';
});

document.getElementById('random-code-btn').addEventListener('click', () => {
    document.getElementById('movie-access-code').value = random(1, 10000);
});

document.getElementById('add-movie-form').addEventListener('submit', handleAddMovie);

// Channel management initializers
document.getElementById('add-channel-btn').addEventListener('click', () => {
    document.getElementById('add-channel-modal').style.display = 'block';
});
document.getElementById('close-add-channel').addEventListener('click', () => {
    document.getElementById('add-channel-modal').style.display = 'none';
});
document.getElementById('add-channel-form').addEventListener('submit', handleAddChannel);

// Genre management initializers
document.getElementById('add-genre-btn').addEventListener('click', () => {
    document.getElementById('add-genre-modal').style.display = 'block';
});
document.getElementById('close-add-genre').addEventListener('click', () => {
    document.getElementById('add-genre-modal').style.display = 'none';
});
document.getElementById('close-top-movies').addEventListener('click', () => {
    document.getElementById('top-movies-modal').style.display = 'none';
});
document.getElementById('add-genre-form').addEventListener('submit', handleAddGenre);

document.getElementById('add-promocode-btn').addEventListener('click', () => {
    document.getElementById('add-promocode-modal').style.display = 'block';
});
document.getElementById('close-add-promocode').addEventListener('click', () => {
    document.getElementById('add-promocode-modal').style.display = 'none';
});
document.getElementById('add-promocode-form').addEventListener('submit', handleAddPromocode);

document.getElementById('close-promocode-analytics').addEventListener('click', () => {
    document.getElementById('promocode-analytics-modal').style.display = 'none';
});

document.getElementById('users-filter-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const filters = Object.fromEntries(formData.entries());
    loadUsers(filters);
});

async function openPublishModal(pendingId) {
    const modal = document.getElementById('add-movie-modal');
    modal.style.display = 'block';
    document.getElementById('movie-pending-id').value = pendingId;

    // Load genres into select
    try {
        const res = await fetch(`${API_URL}/genres`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const genres = await res.json();
        const select = document.getElementById('movie-genre-select');
        select.innerHTML = genres.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    } catch (err) {
        console.error('Error loading genres:', err);
    }
}

async function loadPendingMovies() {
    const listEl = document.getElementById('pending-movies-list');
    try {
        const res = await fetch(`${API_URL}/movies/pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const pending = await res.json();

        if (!Array.isArray(pending)) {
            throw new Error(pending?.error || `Server javobi noto'g'ri (status ${res.status})`);
        }

        if (pending.length === 0) {
            listEl.innerHTML = '<p style="color: #8b92b0;">Hozircha kutilayotgan video yo\'q. Videoni saqlash kanaliga yuboring.</p>';
            return;
        }

        listEl.innerHTML = pending.map(p => {
            const hasTitle = p.title && p.title !== '🎬 Nomsiz kino';
            return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: #0f1429; border: 1px solid #1e2542; border-radius: 10px; margin-bottom: 10px;">
                <div>
                    <div style="font-weight: 600;">${hasTitle ? p.title : '🎞️ Nomi aniqlanmadi'}</div>
                    <small style="color: #8b92b0;">${p.genre_name ? '🎭 ' + p.genre_name : '⚠️ Janr aniqlanmadi'} · ${p.created_at || ''}</small>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="publishAuto(${p.id})" class="btn-primary" style="margin: 0; padding: 8px 16px;">✅ Nashr qilish</button>
                    <button onclick="openPublishModal(${p.id})" title="Qo'lda tahrirlash" style="background: rgba(102, 126, 234, 0.1); color: #667eea; border: 1px solid rgba(102, 126, 234, 0.2); padding: 8px 12px; border-radius: 6px; cursor: pointer;">✏️</button>
                </div>
            </div>
        `;
        }).join('');
    } catch (err) {
        console.error('loadPendingMovies error:', err);
        listEl.innerHTML = `<p style="color: #ef4444;">Xatolik: ${err.message}</p>`;
    }
}

// One-click publish: uses the title/genre/description already parsed from
// the channel caption, backend just assigns a fresh access code.
async function publishAuto(id) {
    try {
        const res = await fetch(`${API_URL}/movies/${id}/publish-auto`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.success) {
            alert(`✅ "${result.title}" nashr qilindi!\nKod: ${result.accessCode}`);
            loadMovies();
        } else {
            alert('Xatolik: ' + (result.error || 'Noma\'lum xato'));
        }
    } catch (err) {
        console.error('publishAuto error:', err);
        alert('Xatolik yuz berdi: ' + err.message);
    }
}

async function handleAddMovie(e) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form).entries());
    const pendingId = data.pendingId;

    try {
        const saveBtn = form.querySelector('button[type="submit"]');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saqlanmoqda...';
        saveBtn.disabled = true;

        const res = await fetch(`${API_URL}/movies/${pendingId}/publish`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await res.json();
        if (result.success) {
            form.reset();
            document.getElementById('add-movie-modal').style.display = 'none';
            loadMovies();
        } else {
            alert('Xatolik: ' + (result.error || 'Noma\'lum xato'));
        }

        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    } catch (err) {
        console.error('Save movie error:', err);
        alert('Xatolik yuz berdi: ' + err.message);
    }
}

// Bind Movies Page Filters
document.getElementById('apply-movie-filters').addEventListener('click', () => {
    loadMovies();
});

if (document.getElementById('movie-filter-interest')) {
    document.getElementById('movie-filter-interest').addEventListener('change', loadMovies);
}
if (document.getElementById('movie-filter-country')) {
    document.getElementById('movie-filter-country').addEventListener('change', loadMovies);
}
if (document.getElementById('movie-filter-age')) {
    document.getElementById('movie-filter-age').addEventListener('change', loadMovies);
}

document.getElementById('movie-search').addEventListener('input', (e) => {
    // Optional: Auto-search with debounce
    if (e.target.value.length > 2 || e.target.value.length === 0) {
        loadMovies();
    }
});

// Load Analytics with Skvoznaya Filters
async function loadAnalytics() {
    try {
        const country = document.getElementById('filter-country').value;
        const infoAgeMin = document.getElementById('filter-age-min').value;
        const infoAgeMax = document.getElementById('filter-age-max').value;
        const interest = document.getElementById('filter-interest').value;

        let url = `${API_URL}/analytics?`;
        if (country) url += `country=${country}&`;
        if (infoAgeMin) url += `age_min=${infoAgeMin}&`;
        if (infoAgeMax) url += `age_max=${infoAgeMax}&`;
        if (interest) url += `interest=${interest}&`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // Update Total Stats
        document.getElementById('total-revenue').textContent = formatNumber(data.premium?.revenue?.monthly + data.premium?.revenue?.quarterly + data.premium?.revenue?.semi_annual + data.premium?.revenue?.lifetime || 0) + " SO'M";
        document.getElementById('total-views').textContent = formatNumber(data.views?.total || 0);
        document.getElementById('new-users').textContent = formatNumber(data.users?.total || 0);
        document.getElementById('active-promos').textContent = data.activePromos || 0;
        document.getElementById('today-revenue').textContent = formatNumber(data.todayRevenue || 0) + " SO'M";

        // Top Genres Chart
        const genres = data.views?.byGenre || [];
        const genreChart = genres.map((g, i) => `
            <div style="display: flex; align-items: center; justify-content: space-between; margin: 12px 0; padding: 12px 15px; background: #0f1429; border-radius: 12px; border: 1px solid #1e2542;">
                <div style="display: flex; align-items: center;">
                    <div style="width: 30px; height: 30px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; margin-right: 12px;">${i + 1}</div>
                    <span style="font-weight: 600; font-size: 14px;">${g.name}</span>
                </div>
                <div style="color: #10b981; font-weight: 700; font-size: 13px;">${formatNumber(g.views)} 👁</div>
            </div>
        `).join('');

        document.getElementById('top-genres-chart').innerHTML = genreChart || '<p style="text-align: center; color: #8b92b0;">Ma\'lumot topilmadi</p>';

        // Render Top Movies
        const topMovies = data.views?.topMovies || [];
        const topMoviesHtml = topMovies.map((m, i) => `
            <div onclick="showMovieAnalytics(${m.id})" style="padding: 12px; background: #0f1429; border: 1px solid #1e2542; margin-bottom: 10px; border-radius: 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;" class="top-movie-item">
                <div style="display: flex; align-items: center;">
                    <div style="font-size: 20px; margin-right: 12px;">${i === 0 ? '👑' : '🎬'}</div>
                    <div>
                        <strong style="color: white; display: block; font-size: 14px;">${m.title}</strong>
                        <small style="color: #667eea; font-weight: 600;">${m.genre_name || 'Janrsiz'}</small>
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="display: block; font-weight: 700; color: #667eea; font-size: 14px;">${formatNumber(m.views_count)} 👁</span>
                    <small style="color: #10b981; font-weight: 600;">👍 ${m.likes_count || 0}</small>
                </div>
            </div>
        `).join('');
        document.getElementById('top-movies-list').innerHTML = topMoviesHtml || '<p style="color: #8b92b0; text-align: center;">Ma\'lumot topilmadi</p>';

        if (!document.getElementById('top-movies-styles')) {
            const style = document.createElement('style');
            style.id = 'top-movies-styles';
            style.innerHTML = `
                .top-movie-item:hover { transform: translateX(5px); border-color: #667eea !important; background: rgba(102, 126, 234, 0.05) !important; }
            `;
            document.head.appendChild(style);
        }

    } catch (err) {
        console.error('loadAnalytics error:', err);
    }
}

// Bind Skvoznaya Filters
document.getElementById('apply-skvoznaya-filters').addEventListener('click', loadAnalytics);

// Load Premium with advanced filters
let premiumListenersSet = false;
async function loadPremium() {
    if (!premiumListenersSet) {
        // Main Action Buttons
        document.getElementById('apply-filters').addEventListener('click', () => {
            loadPremiumData();
        });

        document.getElementById('reset-filters').addEventListener('click', () => {
            document.getElementById('subscription-type-filter').value = 'all';
            document.getElementById('month-filter').value = 'all';
            document.getElementById('year-filter').value = new Date().getFullYear().toString();
            document.getElementById('start-date').value = '';
            document.getElementById('end-date').value = '';
            loadPremiumData();
        });

        document.getElementById('add-payment-system').addEventListener('click', () => {
            alert('To\'lov tizimi qo\'shish: Payme, Click, Uzum yoki boshqa tizimlar API integratsiya qilinadi.');
        });

        // Close details modal
        document.getElementById('close-details').onclick = () => {
            document.getElementById('details-modal').style.display = 'none';
        }

        window.onclick = (event) => {
            const modal = document.getElementById('details-modal');
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        }

        // Add change listeners for automatic updates on small filters
        ['subscription-type-filter', 'month-filter', 'year-filter'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                loadPremiumData();
            });
        });

        premiumListenersSet = true;
    }

    // Initial load
    await loadPremiumData();
}

// Resolve the active date range from the filter inputs: an explicit custom
// range wins, otherwise it's derived from the selected month/year.
function getSelectedDateRange() {
    const month = document.getElementById('month-filter').value;
    const year = parseInt(document.getElementById('year-filter').value);
    const startInput = document.getElementById('start-date').value;
    const endInput = document.getElementById('end-date').value;

    if (startInput && endInput) {
        return { start: new Date(startInput), end: new Date(endInput) };
    }

    if (month === 'all') {
        return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59) };
    }

    const monthNum = parseInt(month);
    return { start: new Date(year, monthNum, 1), end: new Date(year, monthNum + 1, 0, 23, 59, 59) };
}

async function loadPremiumData() {
    const applyBtn = document.getElementById('apply-filters');
    const originalText = applyBtn ? applyBtn.textContent : null;

    try {
        const tariffType = document.getElementById('subscription-type-filter').value;
        const month = document.getElementById('month-filter').value;
        const year = document.getElementById('year-filter').value;

        if (applyBtn) {
            applyBtn.textContent = 'Yuklanmoqda...';
            applyBtn.disabled = true;
        }

        const { start, end } = getSelectedDateRange();
        const params = `startDate=${start.toISOString()}&endDate=${end.toISOString()}`;

        const [premiumRes, methodsRes] = await Promise.all([
            fetch(`${API_URL}/premium?${params}`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/premium/payment-methods?${params}`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const premium = await premiumRes.json();
        const methods = await methodsRes.json();

        const data = buildPremiumData(premium, methods, tariffType, month, year);
        updatePremiumUI(data);
    } catch (err) {
        console.error('loadPremiumData error:', err);
    } finally {
        if (applyBtn) {
            applyBtn.textContent = originalText;
            applyBtn.disabled = false;
        }
    }
}

// Reshape the real /api/premium + /api/premium/payment-methods responses into
// what the UI renders. Every number here comes from the payments table -
// tariffs/months/methods with no payments simply come out as 0.
function buildPremiumData(premium, methods, tariff, month, year) {
    const prices = { monthly: 14990, quarterly: 39990, semi_annual: 79900, lifetime: 129900 };
    const byType = premium?.currentPeriod?.byType || [];

    const stats = {};
    Object.keys(prices).forEach(key => {
        const row = byType.find(t => t.subscription_type === key);
        let count = row?.count || 0;
        let revenue = row?.revenue || 0;
        if (tariff !== 'all' && tariff !== key) {
            count = 0;
            revenue = 0;
        }
        stats[key] = { count, revenue };
    });

    const totalRevenue = Object.values(stats).reduce((acc, s) => acc + s.revenue, 0);
    const previousRevenue = premium?.comparison?.previousPeriod || 0;
    const growth = premium?.comparison?.growth || 0;
    const forecast = premium?.forecast?.nextMonth || 0;

    const breakdown = premium?.monthlyBreakdown || [];
    const monthlyHistory = [];
    for (let i = 0; i < 12; i++) {
        const key = `${year}-${String(i + 1).padStart(2, '0')}`;
        const entry = breakdown.find(m => m.month === key);
        monthlyHistory.push(entry?.revenue || 0);
    }

    const paymentMethods = {
        payme: (methods || []).find(m => m.payment_method === 'payme')?.revenue || 0,
        click: (methods || []).find(m => m.payment_method === 'click')?.revenue || 0
    };

    return {
        stats,
        totalRevenue,
        previousRevenue,
        growth,
        forecast,
        tariff,
        month: month === 'all' ? 'Barcha oylar' : month,
        year,
        monthlyHistory,
        paymentMethods
    };
}

function updatePremiumUI(data) {
    // Main stats
    document.getElementById('premium-total-revenue').textContent = formatNumber(data.totalRevenue) + " SO'M";
    document.getElementById('current-revenue').textContent = formatNumber(data.totalRevenue) + " SO'M";
    document.getElementById('previous-revenue').textContent = formatNumber(data.previousRevenue) + " SO'M";
    document.getElementById('forecast-revenue').textContent = formatNumber(data.forecast) + " SO'M";

    // Growth indicator
    const growthIndicator = document.getElementById('growth-indicator');
    const isDecline = data.growth < 0;
    growthIndicator.innerHTML = `
        <span style="color: ${isDecline ? '#ef4444' : '#10b981'}; font-weight: 700;">
            ${isDecline ? '📉' : '📈'} ${Math.abs(data.growth)}% ${isDecline ? 'pasayish' : 'o\'sish'}
        </span>
    `;

    // Per-tariff breakdown counts
    document.getElementById('monthly-count').textContent = formatNumber(data.stats.monthly.count);
    document.getElementById('monthly-revenue').textContent = formatNumber(data.stats.monthly.revenue) + " SO'M";

    document.getElementById('quarterly-count').textContent = formatNumber(data.stats.quarterly.count);
    document.getElementById('quarterly-revenue').textContent = formatNumber(data.stats.quarterly.revenue) + " SO'M";

    document.getElementById('semi-annual-count').textContent = formatNumber(data.stats.semi_annual.count);
    document.getElementById('semi-annual-revenue').textContent = formatNumber(data.stats.semi_annual.revenue) + " SO'M";

    document.getElementById('lifetime-count').textContent = formatNumber(data.stats.lifetime.count);
    document.getElementById('lifetime-revenue').textContent = formatNumber(data.stats.lifetime.revenue) + " SO'M";

    // Re-bind click events for deep dive
    const cards = document.querySelectorAll('.premium-card');
    cards.forEach(card => {
        const type = card.querySelector('h3').textContent.toLowerCase().replace(' ', '_');
        // Standardize types for matching stats keys: 'oylik' (monthly), etc.
        let typeKey = 'monthly';
        if (type.includes('3')) typeKey = 'quarterly';
        else if (type.includes('6')) typeKey = 'semi_annual';
        else if (type.includes('umrbod')) typeKey = 'lifetime';

        card.onclick = () => showSubscriptionDetails(typeKey, data.stats[typeKey]);
    });

    // Update charts
    updateMonthlyChart(data);
    updatePaymentMethodsUI(data.paymentMethods);

    // Bind Excel Export with latest data
    document.getElementById('export-excel').onclick = () => exportToExcel(data);
}

async function showSubscriptionDetails(typeKey, stat) {
    const modal = document.getElementById('details-modal');
    const title = document.getElementById('details-title');
    const body = document.getElementById('details-body');

    const titles = {
        monthly: 'OYLIK TARIF OBUNACHILARI',
        quarterly: '3 OYLIK TARIF OBUNACHILARI',
        semi_annual: '6 OYLIK TARIF OBUNACHILARI',
        lifetime: 'UMRBOD TARIF OBUNACHILARI'
    };

    title.textContent = titles[typeKey];
    modal.style.display = 'block';

    if (!stat || stat.count === 0) {
        body.innerHTML = '<p style="color: #8b92b0; text-align: center; padding: 40px;">Ushbu davrda obunachilar topilmadi.</p>';
        return;
    }

    body.innerHTML = '<p style="color: #8b92b0; text-align: center; padding: 40px;">Yuklanmoqda...</p>';

    try {
        const { start, end } = getSelectedDateRange();
        const res = await fetch(`${API_URL}/premium/subscribers?type=${typeKey}&startDate=${start.toISOString()}&endDate=${end.toISOString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const subscribers = await res.json();

        if (!subscribers.length) {
            body.innerHTML = '<p style="color: #8b92b0; text-align: center; padding: 40px;">Ushbu davrda obunachilar topilmadi.</p>';
            return;
        }

        const tableHtml = `
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <thead>
                    <tr style="text-align: left; color: #8b92b0; font-size: 11px; text-transform: uppercase;">
                        <th style="padding: 12px;">FOYDALANUVCHI</th>
                        <th style="padding: 12px;">TO'LOV SUMMASI</th>
                        <th style="padding: 12px;">SANA</th>
                        <th style="padding: 12px;">AMAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${subscribers.slice(0, 50).map(s => `
                        <tr style="border-bottom: 1px solid #1e2542;">
                            <td style="padding: 15px;">
                                <div style="font-weight: 600;">${s.full_name || 'Noma\'lum'}</div>
                                <div style="font-size: 11px; color: #8b92b0;">@${s.username || '-'}</div>
                            </td>
                            <td style="padding: 15px; color: #10b981; font-weight: 700;">${formatNumber(s.amount)} SO'M</td>
                            <td style="padding: 15px; font-size: 12px; color: #8b92b0;">${new Date(s.created_at).toLocaleDateString()}</td>
                            <td style="padding: 15px;">
                                <button onclick="downloadReceipt('${(s.full_name || 'Nomalum').replace(/'/g, '')}', '${s.amount}', '${new Date(s.created_at).toLocaleDateString()}', '${typeKey}', '${s.transaction_id || ''}')"
                                        style="background: rgba(102, 126, 234, 0.1); color: #667eea; border: 1px solid rgba(102, 126, 234, 0.2); padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 11px;">
                                    📄 Chek yuklash
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ${subscribers.length > 50 ? `<p style="text-align: center; color: #8b92b0; font-size: 12px; margin-top: 15px;">Va yana ${subscribers.length - 50} ta obunachi...</p>` : ''}
        `;

        body.innerHTML = tableHtml;
    } catch (err) {
        console.error('showSubscriptionDetails error:', err);
        body.innerHTML = `<p style="color: #ef4444; text-align: center; padding: 40px;">Xatolik: ${err.message}</p>`;
    }
}

function downloadReceipt(name, amount, date, type, transactionId) {
    const typeNames = {
        monthly: 'OYLIK',
        quarterly: '3 OYLIK',
        semi_annual: '6 OYLIK',
        lifetime: 'UMRBOD'
    };

    const textBlob = `
SOFKINO RECEIPT
-----------------------
TARIF: ${typeNames[type]}
KLIYENT: ${name}
SANA: ${date}
SUMMA: ${amount} UZS
HOLATI: YAKUNLANDI
-----------------------
ID: ${transactionId || 'N/A'}
    `;
    const blob = new Blob([textBlob], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `chek-${name.replace(' ', '-')}.txt`;
    link.click();
}

function updateMonthlyChart(data) {
    const months = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
    const currentMonthIdx = data.month !== 'Barcha oylar' ? parseInt(data.month) : -1;

    const chartHtml = months.map((m, i) => {
        const revenue = data.monthlyHistory[i];
        const isSelected = i === currentMonthIdx;
        const maxRevenue = Math.max(...data.monthlyHistory, 1);
        const barHeight = Math.max(10, (revenue / maxRevenue) * 100);

        return `
            <div style="display: flex; flex-direction: column; align-items: center; width: 7.5%; cursor: default;" title="${m}: ${formatNumber(revenue)} SO'M">
                <div style="width: 100%; position: relative; height: 100px; display: flex; align-items: flex-end;">
                    <div style="background: ${isSelected ? '#f59e0b' : 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)'}; width: 80%; height: ${barHeight}%; border-radius: 4px 4px 0 0; transition: height 0.5s ease; box-shadow: ${isSelected ? '0 0 15px rgba(245,158,11,0.4)' : 'none'};"></div>
                </div>
                <div style="font-size: 10px; color: ${isSelected ? '#f59e0b' : '#8b92b0'}; font-weight: ${isSelected ? '700' : '400'}; margin-top: 8px;">${m}</div>
                <div style="font-size: 9px; color: #10b981; margin-top: 2px;">${(revenue / 1000000).toFixed(1)}M</div>
            </div>
        `;
    }).join('');

    document.getElementById('monthly-chart').innerHTML = `
        <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 130px; padding: 10px 0; border-bottom: 1px solid #1e2542;">
            ${chartHtml}
        </div>
    `;
}

function updatePaymentMethodsUI(methods) {
    const payme = methods?.payme || 0;
    const click = methods?.click || 0;
    const total = payme + click;
    const paymePct = total > 0 ? Math.round((payme / total) * 100) : 0;
    const clickPct = total > 0 ? 100 - paymePct : 0;

    document.getElementById('payment-methods').innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div style="background: #0f1429; padding: 20px; border-radius: 12px; border: 1px solid rgba(0, 186, 255, 0.2); position: relative; overflow: hidden;">
                <div style="position: absolute; top: -10px; right: -10px; font-size: 60px; opacity: 0.05;">💳</div>
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                    <div style="width: 45px; height: 45px; background: #00baff; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: white;">P</div>
                    <div>
                        <div style="font-size: 10px; color: #8b92b0; letter-spacing: 1px;">SYSTEM</div>
                        <div style="font-weight: 700; color: white;">PAYME</div>
                    </div>
                </div>
                <div style="font-size: 22px; font-weight: 700; color: #00baff;">${formatNumber(payme)} SO'M</div>
                <div style="margin-top: 10px; background: rgba(255,255,255,0.05); height: 6px; border-radius: 3px;">
                    <div style="background: #00baff; width: ${paymePct}%; height: 100%; border-radius: 3px;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px;">
                    <span style="color: #8b92b0;">Ulush</span>
                    <span style="color: #00baff; font-weight: 600;">${paymePct}%</span>
                </div>
            </div>

            <div style="background: #0f1429; padding: 20px; border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.2); position: relative; overflow: hidden;">
                <div style="position: absolute; top: -10px; right: -10px; font-size: 60px; opacity: 0.05;">💰</div>
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                    <div style="width: 45px; height: 45px; background: #f59e0b; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: white;">C</div>
                    <div>
                        <div style="font-size: 10px; color: #8b92b0; letter-spacing: 1px;">SYSTEM</div>
                        <div style="font-weight: 700; color: white;">CLICK</div>
                    </div>
                </div>
                <div style="font-size: 22px; font-weight: 700; color: #f59e0b;">${formatNumber(click)} SO'M</div>
                <div style="margin-top: 10px; background: rgba(255,255,255,0.05); height: 6px; border-radius: 3px;">
                    <div style="background: #f59e0b; width: ${clickPct}%; height: 100%; border-radius: 3px;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px;">
                    <span style="color: #8b92b0;">Ulush</span>
                    <span style="color: #f59e0b; font-weight: 600;">${clickPct}%</span>
                </div>
            </div>
        </div>
    `;
}

// Load Movies with Top Performers and Filters
async function loadMovies() {
    const listEl = document.getElementById('movies-list');
    const topRowEl = document.getElementById('movies-top-row');

    loadPendingMovies();

    try {
        const country = document.getElementById('movie-filter-country').value;
        const age = document.getElementById('movie-filter-age').value;
        const search = document.getElementById('movie-search').value;
        const interest = document.getElementById('movie-filter-interest') ? document.getElementById('movie-filter-interest').value : '';

        let url = `${API_URL}/movies?`;
        if (country) url += `country=${country}&`;
        if (age) url += `age=${age}&`;
        if (interest) url += `interest=${interest}&`;
        if (search) url += `search=${encodeURIComponent(search)}&`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const movies = await res.json();

        if (!Array.isArray(movies)) {
            throw new Error(movies?.error || `Server javobi noto'g'ri (status ${res.status})`);
        }

        const displayMovies = movies;

        const sortedMovies = [...displayMovies].sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
        const topMovies = sortedMovies.slice(0, 4);

        // Render Top Row
        if (topRowEl) {
            topRowEl.innerHTML = topMovies.map((m, i) => `
                <div onclick="showMovieAnalytics(${m.id})" class="premium-card" style="text-align: left; padding: 20px; transition: transform 0.3s; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; border-left: 4px solid ${i === 0 ? '#f59e0b' : '#667eea'};">
                    <div style="position: absolute; top: -10px; right: -10px; font-size: 60px; opacity: 0.05;">🎬</div>
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                            <span style="background: ${i === 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(102, 126, 234, 0.1)'}; color: ${i === 0 ? '#f59e0b' : '#667eea'}; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; letter-spacing: 1px;">TOP ${i + 1}</span>
                            <span style="color: #10b981; font-weight: 700; font-size: 12px;">★ ${m.rating || 'N/A'}</span>
                        </div>
                        <h3 style="font-size: 16px; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.title}</h3>
                        <p style="color: #8b92b0; font-size: 11px; margin-bottom: 15px;">${m.genre_name || 'Janrsiz'}</p>
                    </div>
                    <div style="display: flex; gap: 15px; border-top: 1px solid #1e2542; pt: 15px; margin-top: 10px;">
                        <div>
                            <div style="font-size: 9px; color: #8b92b0; text-transform: uppercase;">Ko'rishlar</div>
                            <div style="font-weight: 700; color: white;">${formatNumber(m.views_count || 0)}</div>
                        </div>
                        <div>
                            <div style="font-size: 9px; color: #8b92b0; text-transform: uppercase;">Like</div>
                            <div style="font-weight: 700; color: #10b981;">${formatNumber(m.likes_count || 0)}</div>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        // Populate Summary Stats - always reflects the current result set, zero included
        const countEl = document.getElementById('movie-total-count');
        const viewsEl = document.getElementById('movie-total-views');
        const rateEl = document.getElementById('movie-avg-rating');
        const shareEl = document.getElementById('movie-total-shares');

        if (countEl && viewsEl && rateEl && shareEl) {
            countEl.textContent = formatNumber(displayMovies.length);
            const totalViews = displayMovies.reduce((acc, m) => acc + (m.views_count || 0), 0);
            viewsEl.textContent = formatNumber(totalViews);
            const avgRatingValue = displayMovies.length > 0
                ? (displayMovies.reduce((acc, m) => acc + (parseFloat(m.rating) || 0), 0) / displayMovies.length).toFixed(1)
                : '0.0';
            rateEl.textContent = avgRatingValue;
            const totalShares = displayMovies.reduce((acc, m) => acc + (m.shares_count || 0), 0);
            shareEl.textContent = formatNumber(totalShares);
        }

        const html = `
            <table style="margin-top: 20px;">
                <thead>
                    <tr>
                        <th>🎬 KINO NOMI & JANR</th>
                        <th>🔑 KOD</th>
                        <th>📤 TRACTION (STAT)</th>
                        <th>🔗 MANBALAR</th>
                        <th>⚙️ AMALLAR</th>
                    </tr>
                </thead>
                <tbody>
                    ${displayMovies.length === 0 ? `
                        <tr><td colspan="5" style="text-align: center; color: #8b92b0; padding: 40px;">Hozircha kino yo'q. Videoni saqlash kanaliga yuboring va admin panelda nashr qiling.</td></tr>
                    ` : displayMovies.map(m => `
                        <tr>
                            <td>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 40px; height: 50px; background: #0f1429; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 1px solid #1e2542;">🎬</div>
                                    <div>
                                        <strong style="color: white; display: block;">${m.title}</strong>
                                        <small style="color: #667eea; font-weight: 600;">${m.genre_name || 'Janrsiz'}</small>
                                    </div>
                                </div>
                            </td>
                            <td><code style="background: #1e2542; padding: 4px 8px; border-radius: 4px; color: #a5b4fc; font-family: monospace;">${m.access_code}</code></td>
                            <td>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span title="Views" style="color: #8b92b0; font-size: 13px;">👁 ${formatNumber(m.views_count)}</span>
                                        <span title="Likes" style="color: #10b981; font-size: 13px;">👍 ${m.likes_count || 0}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span title="Shares" style="color: #6366f1; font-size: 13px;">📤 ${m.shares_count || 0}</span>
                                        <span title="Watch Time" style="color: #f59e0b; font-size: 12px;">⏳ ${Math.floor((m.total_watch_time || 0) / 60)}m</span>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <div style="display: flex; gap: 5px;">
                                    ${m.telegram_link && m.telegram_link !== '#' ? `<a href="${m.telegram_link}" target="_blank" title="Telegram Link" style="background: rgba(0, 136, 204, 0.1); color: #0088cc; padding: 6px; border-radius: 6px; text-decoration: none; font-size: 14px;">🔹 TG</a>` : (m.telegram_link === '#' ? '<span style="color: #555;">🔹 TG</span>' : '')}
                                    ${m.external_link_web && m.external_link_web !== '#' ? `<a href="${m.external_link_web}" target="_blank" title="Web Link" style="background: rgba(102, 126, 234, 0.1); color: #667eea; padding: 6px; border-radius: 6px; text-decoration: none; font-size: 14px;">🌐 WEB</a>` : (m.external_link_web === '#' ? '<span style="color: #555;">🌐 WEB</span>' : '')}
                                </div>
                            </td>
                            <td>
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="showMovieAnalytics(${m.id})" class="btn-stat-mini">📊 ANALITIKA</button>
                                    <button onclick="deleteMovie(${m.id})" class="btn-delete-mini">🗑</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        listEl.innerHTML = html;

        if (!document.getElementById('movies-inline-styles')) {
            const style = document.createElement('style');
            style.id = 'movies-inline-styles';
            style.innerHTML = `
                .btn-stat-mini { background: rgba(102, 126, 234, 0.1); color: #667eea; border: 1px solid rgba(102, 126, 234, 0.2); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 800; transition: all 0.2s; text-transform: uppercase; letter-spacing: 0.5px; }
                .btn-stat-mini:hover { background: #667eea; color: white; transform: translateY(-2px); }
                .btn-delete-mini { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
                .btn-delete-mini:hover { background: #ef4444; color: white; transform: translateY(-2px); }
            `;
            document.head.appendChild(style);
        }
    } catch (err) {
        console.error('loadMovies error:', err);
        listEl.innerHTML = `<p style="color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 15px; border-radius: 10px;">Xatolik: ${err.message}</p>`;
    }
}

// Movie Analytics Modal Logic
async function showMovieAnalytics(id) {
    const modal = document.getElementById('movie-analytics-modal');
    modal.style.display = 'block';

    try {
        const res = await fetch(`${API_URL}/analytics/movies/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        document.getElementById('movie-analytics-title').textContent = data.title.toUpperCase() + ' - ANALITIKA';
        document.getElementById('movie-detail-views').textContent = formatNumber(data.views_count);
        document.getElementById('movie-detail-likes').textContent = `${data.likes_count || 0} / ${data.dislikes_count || 0}`;
        document.getElementById('movie-detail-shares').textContent = formatNumber(data.shares_count || 0);

        const minutes = Math.floor((data.total_watch_time || 0) / 60);
        document.getElementById('movie-detail-watchtime').textContent = minutes + 'm';

        // Countries list
        const maxCountry = Math.max(...data.analytics.countries.map(c => c.count), 1);
        const countriesHtml = data.analytics.countries.map(c => `
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                    <span>${c.country || 'Noma\'lum'}</span>
                    <span style="font-weight: 700; color: #667eea;">${c.count}</span>
                </div>
                <div class="analytics-bar-container">
                    <div class="analytics-bar-fill" style="width: ${(c.count / maxCountry) * 100}%"></div>
                </div>
            </div>
        `).join('');
        document.getElementById('movie-countries-list').innerHTML = countriesHtml || '<p style="color: #8b92b0; font-size: 13px;">Ma\'lumot yo\'q</p>';

        // Ages list
        const maxAge = Math.max(...data.analytics.ages.map(a => a.count), 1);
        const agesHtml = data.analytics.ages.map(a => `
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                    <span>${a.age_group}</span>
                    <span style="font-weight: 700; color: #10b981;">${a.count}</span>
                </div>
                <div class="analytics-bar-container">
                    <div class="analytics-bar-fill age" style="width: ${(a.count / maxAge) * 100}%"></div>
                </div>
            </div>
        `).join('');
        document.getElementById('movie-ages-list').innerHTML = agesHtml || '<p style="color: #8b92b0; font-size: 13px;">Ma\'lumot yo\'q</p>';

    } catch (err) {
        console.error('Error loading movie analytics:', err);
    }
}

document.getElementById('close-movie-analytics').onclick = () => {
    document.getElementById('movie-analytics-modal').style.display = 'none';
};

async function deleteMovie(id) {
    if (!confirm('Ushbu kinoni o\'chirishga ishonchingiz komilmi?')) return;

    try {
        const res = await fetch(`${API_URL}/movies/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.success) loadMovies();
    } catch (err) {
        console.error('Delete error:', err);
    }
}

// Load Users
async function loadUsers(filters = {}) {
    try {
        const query = new URLSearchParams(filters).toString();
        const res = await fetch(`${API_URL}/users?${query}`, {
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
                        <th>HUDUD</th>
                        <th>QO'SHILGAN</th>
                        <th>PREMIUM</th>
                        <th>AMALLAR</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => `
                        <tr>
                            <td><code>${u.telegram_id}</code></td>
                            <td><strong>${u.full_name || 'N/A'}</strong>${u.is_banned ? ' <span style="color: #ef4444; font-size: 11px;">(BAN)</span>' : ''}</td>
                            <td>@${u.username || 'N/A'}</td>
                            <td>${u.city || '-'}</td>
                            <td>${new Date(u.joined_at).toLocaleDateString()}</td>
                            <td>${u.is_premium ? '<span style="color: #10b981;">✅ Premium</span>' : '<span style="color: #8b92b0;">❌</span>'}</td>
                            <td>
                                ${u.is_banned
                            ? `<button onclick="unbanUser(${u.telegram_id})" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">Unban</button>`
                            : `<button onclick="banUser(${u.telegram_id})" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">Ban</button>`
                        }
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

async function banUser(id) {
    if (!confirm('Bu foydalanuvchini ban qilishga ishonchingiz komilmi?')) return;
    try {
        await fetch(`${API_URL}/users/${id}/ban`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadUsers();
    } catch (err) {
        alert('Xatolik yuz berdi: ' + err.message);
    }
}

async function unbanUser(id) {
    try {
        await fetch(`${API_URL}/users/${id}/unban`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadUsers();
    } catch (err) {
        alert('Xatolik yuz berdi: ' + err.message);
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
                <div style="display: flex; align-items: center;">
                    <span style="color: #667eea; font-weight: 700; width: 30px;">#${i + 1}</span>
                    <span style="margin-left: 10px; font-size: 18px; font-weight: 600;">🎭 ${g.name}</span>
                </div>
                <div style="display: flex; gap: 30px; align-items: center;">
                    <div style="text-align: right;">
                        <span style="display: block; color: #8b92b0; font-size: 10px; text-transform: uppercase;">KINOLAR</span>
                        <span style="color: white; font-weight: 700;">${formatNumber(g.movie_count || 0)} 🎬</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="display: block; color: #8b92b0; font-size: 10px; text-transform: uppercase;">KO'RISHLAR</span>
                        <span style="color: #10b981; font-weight: 700;">${formatNumber(g.views_count || 0)} 👁</span>
                    </div>
                    <button onclick="viewTopMovies(${g.id}, '${g.name}')" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); padding: 8px 12px; border-radius: 6px; cursor: pointer; margin-left: 10px;">Top 10</button>
                    <button onclick="deleteGenre(${g.id})" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); padding: 8px 12px; border-radius: 6px; cursor: pointer; margin-left: 10px;">🗑</button>
                </div>
            </div>
        `).join('');

        document.getElementById('genres-list').innerHTML = html;

        // Deep Analytics
        const totalMovies = genres.reduce((sum, g) => sum + (g.movie_count || 0), 0);
        const totalViews = genres.reduce((sum, g) => sum + (g.views_count || 0), 0);
        const topGenre = genres[0];

        const analyticsHtml = `
            <h3 style="color: #667eea;">📊 CHUQUR ANALITIKA</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 20px;">
                <div style="background: #0f1429; padding: 20px; border-radius: 12px; text-align: center;">
                    <h4>Jami Kinolar</h4>
                    <p style="font-size: 24px; color: #10b981;">${formatNumber(totalMovies)}</p>
                </div>
                <div style="background: #0f1429; padding: 20px; border-radius: 12px; text-align: center;">
                    <h4>Jami Ko'rishlar</h4>
                    <p style="font-size: 24px; color: #3b82f6;">${formatNumber(totalViews)}</p>
                </div>
                <div style="background: #0f1429; padding: 20px; border-radius: 12px; text-align: center;">
                    <h4>Eng Ko'p Ko'rilgan Janr</h4>
                    <p style="font-size: 18px; color: #f59e0b;">${topGenre?.name || 'N/A'}</p>
                    <p style="font-size: 14px; color: #8b92b0;">${formatNumber(topGenre?.views_count || 0)} ko'rish</p>
                </div>
                <div style="background: #0f1429; padding: 20px; border-radius: 12px; text-align: center;">
                    <h4>Janrlar Soni</h4>
                    <p style="font-size: 24px; color: #8b5cf6;">${genres.length}</p>
                </div>
            </div>
        `;

        document.getElementById('genres-analytics').innerHTML = analyticsHtml;
    } catch (err) {
        console.error(err);
    }
}

async function handleAddGenre(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const res = await fetch(`${API_URL}/genres`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert('Janr muvaffaqiyatli qo\'shildi!');
            e.target.reset();
            document.getElementById('add-genre-modal').style.display = 'none';
            loadGenres();
        } else {
            alert('Xatolik: ' + (result.error || 'Noma\'lum xatolik'));
        }
    } catch (err) {
        console.error('Error adding genre:', err);
        alert('Xatolik: ' + err.message);
    }
}

async function viewTopMovies(genreId, genreName) {
    try {
        const res = await fetch(`${API_URL}/genres/${genreId}/top-movies`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const movies = await res.json();

        document.getElementById('top-movies-title').textContent = `🎬 ${genreName} - TOP 10 KINOLAR`;

        if (movies.length === 0) {
            document.getElementById('top-movies-list').innerHTML = '<p style="color: #8b92b0;">Bu janrda hali kinolar yo\'q.</p>';
        } else {
            const html = movies.map((m, i) => `
                <div style="padding: 15px; background: #0f1429; border: 1px solid #1e2542; margin: 10px 0; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span style="color: #667eea; font-weight: 700;">#${i + 1}</span>
                            <span style="margin-left: 10px; font-weight: 600;">${m.title}</span>
                        </div>
                        <div style="text-align: right;">
                            <span style="display: block; color: #8b92b0; font-size: 10px;">KO'RISHLAR</span>
                            <span style="color: #10b981; font-weight: 700;">${formatNumber(m.views_count || 0)} 👁</span>
                        </div>
                    </div>
                </div>
            `).join('');
            document.getElementById('top-movies-list').innerHTML = html;
        }

        document.getElementById('top-movies-modal').style.display = 'block';
    } catch (err) {
        console.error('Error loading top movies:', err);
    }
}

async function loadPromocodes() {
    try {
        const res = await fetch(`${API_URL}/promocodes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const promocodes = await res.json();

        if (promocodes.length === 0) {
            document.getElementById('promocodes-list').innerHTML = `
                <div style="background: #141a2e; border: 1px solid #1e2542; padding: 40px; border-radius: 16px; text-align: center;">
                    <p style="color: #8b92b0;">Hozircha promokodlar yo'q.</p>
                </div>
            `;
            return;
        }

        const html = promocodes.map((p) => {
            const isExpired = p.expires_at && new Date(p.expires_at) < new Date();
            const isLimitReached = p.usage_limit && p.actual_used >= p.usage_limit;
            const status = isExpired || isLimitReached ? '❌ Tugagan' : '✅ Faol';
            return `
                <div style="padding: 20px; background: #141a2e; border: 1px solid #1e2542; margin: 10px 0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center;">
                        <span style="color: #667eea; font-weight: 700; width: 50px;">${p.code}</span>
                        <div style="margin-left: 15px;">
                            <span style="font-size: 18px; font-weight: 600;">${p.name || 'Nomsiz'}</span>
                            <div style="font-size: 12px; color: #8b92b0; margin-top: 5px;">
                                ${status} | Ishlatilgan: ${p.actual_used || 0}${p.usage_limit ? ` / ${p.usage_limit}` : ''}
                                ${p.expires_at ? ` | Tugaydi: ${new Date(p.expires_at).toLocaleString()}` : ''}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="viewPromocodeAnalytics(${p.id})" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); padding: 8px 12px; border-radius: 6px; cursor: pointer;">📊 Analitika</button>
                        <button onclick="deletePromocode(${p.id})" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); padding: 8px 12px; border-radius: 6px; cursor: pointer;">🗑</button>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('promocodes-list').innerHTML = html;
    } catch (err) {
        console.error(err);
    }
}

async function handleAddPromocode(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const res = await fetch(`${API_URL}/promocodes`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            e.target.reset();
            document.getElementById('add-promocode-modal').style.display = 'none';
            loadPromocodes();
        } else {
            alert('Xatolik: ' + result.error);
        }
    } catch (err) {
        console.error('Error adding promocode:', err);
        alert('Xatolik: ' + err.message);
    }
}

async function deletePromocode(id) {
    if (!confirm('Promokodni o\'chirishga ishonchingiz komilmi?')) return;
    try {
        const res = await fetch(`${API_URL}/promocodes/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.success) {
            loadPromocodes();
        }
    } catch (err) {
        console.error(err);
    }
}

async function viewPromocodeAnalytics(id) {
    try {
        const res = await fetch(`${API_URL}/promocodes/${id}/analytics`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const usages = await res.json();

        document.getElementById('promocode-analytics-title').textContent = `📊 Promokod Analitikasi (${usages.length} foydalanuvchi)`;

        if (usages.length === 0) {
            document.getElementById('promocode-analytics-content').innerHTML = '<p style="color: #8b92b0;">Hali hech kim ishlatmagan.</p>';
        } else {
            const html = usages.map(u => `
                <div style="padding: 10px; background: #0f1429; border: 1px solid #1e2542; margin: 5px 0; border-radius: 8px;">
                    <strong>${u.first_name || ''} ${u.last_name || ''} (@${u.username || 'no username'})</strong><br>
                    <small style="color: #8b92b0;">Til: ${u.language_code || 'noma\'lum'} | Ro'yxatdan o'tgan: ${new Date(u.user_created_at).toLocaleDateString()}</small><br>
                    <small style="color: #8b92b0;">Ishlatgan: ${new Date(u.used_at).toLocaleString()}</small>
                </div>
            `).join('');
            document.getElementById('promocode-analytics-content').innerHTML = html;
        }

        document.getElementById('promocode-analytics-modal').style.display = 'block';
    } catch (err) {
        console.error('Error loading analytics:', err);
    }
}

async function deleteGenre(id) {
    if (!confirm('Janrni o\'chirishga ishonchingiz komilmi? Bu janrdagi kinolar o\'chirilmaydi, ammo janrsiz bo\'lib qoladi.')) return;
    try {
        const res = await fetch(`${API_URL}/genres/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.success) loadGenres();
    } catch (err) {
        console.error('Error deleting genre:', err);
    }
}

// Channels Management
async function loadChannels() {
    try {
        const res = await fetch(`${API_URL}/channels`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const channels = await res.json();
        const listEl = document.getElementById('channels-list');

        if (channels.length === 0) {
            listEl.innerHTML = `
                <div style="background: #141a2e; border: 1px solid #1e2542; padding: 40px; border-radius: 16px; text-align: center;">
                    <p style="color: #8b92b0;">Hozircha majburiy obuna kanallari qo'shilmagan.</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>KANAL NOMI</th>
                        <th>ID / USERNAME</th>
                        <th>HOLATI</th>
                        <th>⚙️ AMALLAR</th>
                    </tr>
                </thead>
                <tbody>
                    ${channels.map(c => `
                        <tr>
                            <td>
                                <div style="font-weight: 700;">${c.title}</div>
                                <a href="${c.url}" target="_blank" style="color: #667eea; font-size: 12px;">Havola 🔗</a>
                            </td>
                            <td><code>${c.channel_id}</code></td>
                            <td>
                                <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; background: ${c.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${c.is_active ? '#10b981' : '#ef4444'};">
                                    ${c.is_active ? 'AKTIV' : 'PASSIV'}
                                </span>
                            </td>
                            <td>
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="toggleChannel(${c.id}, ${c.is_active})" style="background: rgba(102, 126, 234, 0.1); color: #667eea; border: 1px solid rgba(102, 126, 234, 0.2); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                                        ${c.is_active ? 'O\'chirish' : 'Yoqish'}
                                    </button>
                                    <button onclick="deleteChannel(${c.id})" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">🗑</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error(err);
    }
}

async function handleAddChannel(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const res = await fetch(`${API_URL}/channels`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            e.target.reset();
            document.getElementById('add-channel-modal').style.display = 'none';
            loadChannels();
        }
    } catch (err) {
        console.error(err);
    }
}

async function toggleChannel(id, currentStatus) {
    try {
        // Find channel to get other data for full update or just status
        const res = await fetch(`${API_URL}/channels`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const channels = await res.json();
        const channel = channels.find(c => c.id === id);

        await fetch(`${API_URL}/channels/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ...channel, is_active: !currentStatus })
        });
        loadChannels();
    } catch (err) {
        console.error(err);
    }
}

async function deleteChannel(id) {
    if (!confirm('Kanalni o\'chirishga ishonchingiz komilmi?')) return;
    try {
        await fetch(`${API_URL}/channels/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadChannels();
    } catch (err) {
        console.error(err);
    }
}

// Broadcasts (News Posts)
async function loadBroadcasts() {
    try {
        const res = await fetch(`${API_URL}/broadcast`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const posts = await res.json();
        const pageEl = document.getElementById('broadcast-page');

        if (posts.length === 0) {
            pageEl.innerHTML = `
                <div class="dashboard-header">
                    <h1>📢 RASSILKA VA ANALITIKA</h1>
                    <p class="subtitle">Yangi xabar yuboring yoki tarixni ko'ring.</p>
                </div>
                <div style="background: #141a2e; border: 1px solid #1e2542; padding: 30px; border-radius: 16px; margin-bottom: 30px;">
                    <h3 style="color: #667eea; margin-bottom: 20px;">📤 YANGI RASSILKA YUBORISH</h3>
                    <form id="broadcast-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label>TURI</label>
                                <select name="type" id="broadcast-type">
                                    <option value="text">Matn</option>
                                    <option value="image">Rasm</option>
                                    <option value="video">Video</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>MAQSAD</label>
                                <select name="target">
                                    <option value="all">Barchaga</option>
                                    <option value="premium">Faqat Premium</option>
                                    <option value="regular">Faqat Oddiy</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>MATN</label>
                            <textarea name="text" placeholder="Xabar matni..." rows="4" required></textarea>
                        </div>
                        <div class="form-group" id="media-group" style="display: none;">
                            <label>MEDIA ID (Telegram file_id)</label>
                            <input type="text" name="mediaId" placeholder="Masalan: AgACAgIAAxkBAAIB...">
                        </div>
                        <div class="form-group">
                            <label>LINK (ixtiyoriy)</label>
                            <input type="url" name="url" placeholder="https://...">
                        </div>
                        <button type="submit" class="btn-primary" style="width: 100%; padding: 15px;">YUBORISH</button>
                    </form>
                </div>
                <div style="background: #141a2e; border: 1px solid #1e2542; padding: 40px; border-radius: 16px; text-align: center;">
                    <p style="color: #8b92b0;">Hozircha rassilkalar tarixi bo'sh.</p>
                </div>
            `;
            // Add event listeners
            setTimeout(() => {
                const typeSelect = document.getElementById('broadcast-type');
                const form = document.getElementById('broadcast-form');
                if (typeSelect) typeSelect.addEventListener('change', (e) => {
                    document.getElementById('media-group').style.display = e.target.value !== 'text' ? 'block' : 'none';
                });
                if (form) form.addEventListener('submit', handleBroadcast);
            }, 100);
            return;
        }

        const html = `
            <div class="dashboard-header">
                <h1>📢 RASSILKA VA ANALITIKA</h1>
                <p class="subtitle">Yangi xabar yuboring yoki tarixni ko'ring.</p>
            </div>
            <div style="background: #141a2e; border: 1px solid #1e2542; padding: 30px; border-radius: 16px; margin-bottom: 30px;">
                <h3 style="color: #667eea; margin-bottom: 20px;">📤 YANGI RASSILKA YUBORISH</h3>
                <form id="broadcast-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label>TURI</label>
                            <select name="type" id="broadcast-type">
                                <option value="text">Matn</option>
                                <option value="image">Rasm</option>
                                <option value="video">Video</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>MAQSAD</label>
                            <select name="target">
                                <option value="all">Barchaga</option>
                                <option value="premium">Faqat Premium</option>
                                <option value="regular">Faqat Oddiy</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>MATN</label>
                        <textarea name="text" placeholder="Xabar matni..." rows="4" required></textarea>
                    </div>
                    <div class="form-group" id="media-group" style="display: none;">
                        <label>MEDIA ID (Telegram file_id)</label>
                        <input type="text" name="mediaId" placeholder="Masalan: AgACAgIAAxkBAAIB...">
                    </div>
                    <div class="form-group">
                        <label>LINK (ixtiyoriy)</label>
                        <input type="url" name="url" placeholder="https://...">
                    </div>
                    <button type="submit" class="btn-primary" style="width: 100%; padding: 15px;">YUBORISH</button>
                </form>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>XABAR</th>
                        <th>TURI</th>
                        <th>STATISTIKA</th>
                        <th>SANA</th>
                    </tr>
                </thead>
                <tbody>
                    ${posts.map(p => `
                        <tr>
                            <td style="max-width: 300px;">
                                <div style="font-weight: 700;">${p.title || 'Sarlavhasiz'}</div>
                                <p style="font-size: 12px; color: #8b92b0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.content || ''}</p>
                            </td>
                            <td>
                                <span style="font-size: 11px; padding: 4px 8px; border-radius: 4px; background: rgba(102, 126, 234, 0.1); color: #667eea; text-transform: uppercase;">
                                    ${p.type || 'text'}
                                </span>
                            </td>
                            <td>
                                <div style="display: flex; gap: 15px; font-size: 13px;">
                                    <span title="Views">👁 ${formatNumber(p.views_count || 0)}</span>
                                    <span title="Likes" style="color: #10b981;">👍 ${formatNumber(p.likes_count || 0)}</span>
                                    <span title="Shares" style="color: #6366f1;">📤 ${formatNumber(p.shares_count || 0)}</span>
                                </div>
                            </td>
                            <td style="font-size: 12px; color: #8b92b0;">${new Date(p.created_at).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        pageEl.innerHTML = html;

        // Add event listeners
        setTimeout(() => {
            const typeSelect = document.getElementById('broadcast-type');
            const form = document.getElementById('broadcast-form');
            if (typeSelect) typeSelect.addEventListener('change', (e) => {
                document.getElementById('media-group').style.display = e.target.value !== 'text' ? 'block' : 'none';
            });
            if (form) form.addEventListener('submit', handleBroadcast);
        }, 100);
    } catch (err) {
        console.error(err);
    }
}

// Excel Export Function with filters
function exportToExcel(data) {
    const filters = `Tarif: ${data.tariff}, Oy: ${data.month}, Yil: ${data.year}`;

    const payme = data.paymentMethods?.payme || 0;
    const click = data.paymentMethods?.click || 0;
    const methodsTotal = payme + click;
    const paymePct = methodsTotal > 0 ? Math.round((payme / methodsTotal) * 100) : 0;
    const clickPct = methodsTotal > 0 ? 100 - paymePct : 0;

    const csvContent = `PREMIUM ANALITIKA HISOBOTI\n` +
        `Sana: ${new Date().toLocaleString()}\n` +
        `Filtrlar: ${filters}\n\n` +
        `KO'RSATKICH,MIQDOR,SUMMA\n` +
        `Oylik Tarif,${data.stats.monthly.count},"${formatNumber(data.stats.monthly.revenue)} SO'M"\n` +
        `3 Oylik Tarif,${data.stats.quarterly.count},"${formatNumber(data.stats.quarterly.revenue)} SO'M"\n` +
        `6 Oylik Tarif,${data.stats.semi_annual.count},"${formatNumber(data.stats.semi_annual.revenue)} SO'M"\n` +
        `Umrbod Tarif,${data.stats.lifetime.count},"${formatNumber(data.stats.lifetime.revenue)} SO'M"\n` +
        `----------------------------------------\n` +
        `JAMI TUSHUM,,"${formatNumber(data.totalRevenue)} SO'M"\n` +
        `O'TGAN DAVR,,"${formatNumber(data.previousRevenue)} SO'M"\n` +
        `O'SISH/PASAYISH,,"${data.growth}%"\n` +
        `PROGNOZ (KELGUSI OY),,"${formatNumber(data.forecast)} SO'M"\n\n` +
        `TO'LOV TIZIMLARI BO'YICHA:\n` +
        `PAYME (${paymePct}%),,"${formatNumber(payme)} SO'M"\n` +
        `CLICK (${clickPct}%),,"${formatNumber(click)} SO'M"\n`;

    // Handle UTF-8 for Excel (add BOM)
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().split('T')[0];
    link.download = `premium-report-${timestamp}.csv`;
    link.click();
}

async function handleBroadcast(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const res = await fetch(`${API_URL}/broadcast`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert(`Rassilka yuborildi! Muvaffaqiyat: ${result.sent}, Xatolik: ${result.failed}`);
            e.target.reset();
            loadBroadcasts();
        } else {
            alert('Xatolik: ' + result.error);
        }
    } catch (err) {
        console.error('Error sending broadcast:', err);
        alert('Xatolik: ' + err.message);
    }
}

// Check if already logged in
if (token) {
    showDashboard();
} else {
    showLogin();
}
