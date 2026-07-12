-- Add payment tracking table
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount INTEGER,
    payment_method TEXT, -- 'payme' or 'click'
    transaction_id TEXT UNIQUE,
    subscription_type TEXT, -- 'monthly', 'quarterly', 'semi_annual', 'lifetime'
    status TEXT DEFAULT 'pending', -- 'pending', 'success', 'failed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(telegram_id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Add promocodes table
CREATE TABLE IF NOT EXISTS promocodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT,
    usage_limit INTEGER DEFAULT NULL,
    used_count INTEGER DEFAULT 0,
    expires_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add promocode usages table
CREATE TABLE IF NOT EXISTS promocode_usages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    promocode_id INTEGER,
    user_id INTEGER,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (promocode_id) REFERENCES promocodes(id),
    FOREIGN KEY (user_id) REFERENCES users(telegram_id)
);
