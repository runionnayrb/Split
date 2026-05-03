/**
 * Simple Node.js server to serve SplitMate with OpenAI API proxy
 * This handles the OpenAI API key securely on the server side
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 5000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || 'splitmate-jwt-secret-change-in-production';

// Auth dependencies
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const Database = require('better-sqlite3');

// Initialize SQLite database
let db = null;
try {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    db = new Database(path.join(dataDir, 'splitmate.db'));
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            email         TEXT    UNIQUE NOT NULL,
            password_hash TEXT    NOT NULL,
            p1_name       TEXT    DEFAULT 'Partner 1',
            p2_name       TEXT    DEFAULT 'Partner 2',
            created_at    TEXT    DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS user_data (
            user_id           INTEGER PRIMARY KEY,
            transactions_json TEXT    DEFAULT '[]',
            updated_at        TEXT    DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS households (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT    DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS household_data (
            household_id      INTEGER PRIMARY KEY,
            transactions_json TEXT    DEFAULT '[]',
            updated_at        TEXT    DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS household_invites (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            code       TEXT    UNIQUE NOT NULL,
            inviter_id INTEGER NOT NULL,
            expires_at TEXT    NOT NULL,
            used       INTEGER DEFAULT 0,
            created_at TEXT    DEFAULT CURRENT_TIMESTAMP
        );
    `);
    // Add household_id column to users if it doesn't exist yet
    try { db.exec('ALTER TABLE users ADD COLUMN household_id INTEGER'); } catch(e) {}
    console.log('SQLite database ready');
} catch (e) {
    console.error('Database init failed:', e.message);
}

function verifyToken(req) {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return null;
    try { return jwt.verify(auth.slice(7), JWT_SECRET); }
    catch (e) { return null; }
}

// Initialize Stripe if key is available
let stripe = null;
if (STRIPE_SECRET_KEY) {
    try {
        stripe = require('stripe')(STRIPE_SECRET_KEY);
        console.log('Stripe initialized successfully');
    } catch (e) {
        console.warn('Failed to initialize Stripe:', e.message);
    }
}

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

// ── Partner data store (file-based) ─────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const PARTNERS_FILE = path.join(DATA_DIR, 'partners.json');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function loadPartnerData() {
    try {
        ensureDataDir();
        if (fs.existsSync(PARTNERS_FILE)) {
            return JSON.parse(fs.readFileSync(PARTNERS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Failed to load partner data:', e.message);
    }
    return {
        me: null,
        spouse: null,
        splitRatio: 0.5,
        vcTransactions: []
    };
}

function savePartnerData(data) {
    try {
        ensureDataDir();
        fs.writeFileSync(PARTNERS_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Failed to save partner data:', e.message);
    }
}

// ── SSE Notification clients ─────────────────────────────────────────────────
const sseClients = [];

function broadcastNotification(event) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (let i = sseClients.length - 1; i >= 0; i--) {
        try {
            sseClients[i].write(data);
        } catch (e) {
            sseClients.splice(i, 1);
        }
    }
}

// ── Request body helper ──────────────────────────────────────────────────────
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

function json(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, stripe-signature');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        // ── Stripe webhook (must read raw body before any JSON parse) ─────────
        if (pathname === '/webhook/stripe' && req.method === 'POST') {
            await handleStripeWebhook(req, res);
            return;
        }

        // ── SSE: real-time notifications ──────────────────────────────────────
        if (pathname === '/api/notifications' && req.method === 'GET') {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
            });
            res.write('data: {"type":"connected"}\n\n');
            sseClients.push(res);

            req.on('close', () => {
                const idx = sseClients.indexOf(res);
                if (idx !== -1) sseClients.splice(idx, 1);
            });
            return;
        }

        // ── Auth: Register ────────────────────────────────────────────────────
        if (pathname === '/api/auth/register' && req.method === 'POST') {
            if (!db) { json(res, 503, { error: 'Database unavailable' }); return; }
            const body = JSON.parse((await readBody(req)).toString());
            const { email, password, p1Name, p2Name } = body;
            if (!email || !password || password.length < 6) {
                json(res, 400, { error: 'Email and password (min 6 chars) are required' }); return;
            }
            try {
                const hash = bcrypt.hashSync(password, 10);
                const ins  = db.prepare('INSERT INTO users (email, password_hash, p1_name, p2_name) VALUES (?, ?, ?, ?)');
                const r    = ins.run(email.toLowerCase().trim(), hash, p1Name || 'Partner 1', p2Name || 'Partner 2');
                const user = db.prepare('SELECT id, email, p1_name, p2_name FROM users WHERE id = ?').get(r.lastInsertRowid);
                db.prepare('INSERT OR IGNORE INTO user_data (user_id) VALUES (?)').run(user.id);
                const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
                json(res, 200, { token, user: { id: user.id, email: user.email, p1Name: user.p1_name, p2Name: user.p2_name } });
            } catch (e) {
                if (e.message.includes('UNIQUE')) json(res, 400, { error: 'An account with that email already exists' });
                else { console.error(e); json(res, 500, { error: 'Registration failed' }); }
            }
            return;
        }

        // ── Auth: Login ───────────────────────────────────────────────────────
        if (pathname === '/api/auth/login' && req.method === 'POST') {
            if (!db) { json(res, 503, { error: 'Database unavailable' }); return; }
            const body = JSON.parse((await readBody(req)).toString());
            const { email, password } = body;
            if (!email || !password) { json(res, 400, { error: 'Email and password are required' }); return; }
            const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
            if (!user || !bcrypt.compareSync(password, user.password_hash)) {
                json(res, 401, { error: 'Incorrect email or password' }); return;
            }
            const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
            json(res, 200, { token, user: { id: user.id, email: user.email, p1Name: user.p1_name, p2Name: user.p2_name } });
            return;
        }

        // ── Auth: Verify token / get current user ─────────────────────────────
        if (pathname === '/api/auth/me' && req.method === 'GET') {
            if (!db) { json(res, 503, { error: 'Database unavailable' }); return; }
            const decoded = verifyToken(req);
            if (!decoded) { json(res, 401, { error: 'Unauthorized' }); return; }
            const user = db.prepare('SELECT id, email, p1_name, p2_name FROM users WHERE id = ?').get(decoded.userId);
            if (!user) { json(res, 401, { error: 'User not found' }); return; }
            json(res, 200, { user: { id: user.id, email: user.email, p1Name: user.p1_name, p2Name: user.p2_name } });
            return;
        }

        // ── User data: load ───────────────────────────────────────────────────
        if (pathname === '/api/userdata' && req.method === 'GET') {
            if (!db) { json(res, 503, { error: 'Database unavailable' }); return; }
            const decoded = verifyToken(req);
            if (!decoded) { json(res, 401, { error: 'Unauthorized' }); return; }
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
            // Personal transactions (scope='personal')
            const personalRow = db.prepare('SELECT * FROM user_data WHERE user_id = ?').get(decoded.userId);
            const personal = (personalRow ? JSON.parse(personalRow.transactions_json || '[]') : [])
                .map(t => ({ ...t, scope: 'personal' }));
            // Shared transactions from household
            let shared = [];
            if (user && user.household_id) {
                const sharedRow = db.prepare('SELECT * FROM household_data WHERE household_id = ?').get(user.household_id);
                shared = (sharedRow ? JSON.parse(sharedRow.transactions_json || '[]') : [])
                    .map(t => ({ ...t, scope: 'shared' }));
            }
            const all = [...shared, ...personal].sort((a, b) => new Date(b.date) - new Date(a.date));
            json(res, 200, { transactions: all });
            return;
        }

        // ── User data: save ───────────────────────────────────────────────────
        if (pathname === '/api/userdata' && req.method === 'POST') {
            if (!db) { json(res, 503, { error: 'Database unavailable' }); return; }
            const decoded = verifyToken(req);
            if (!decoded) { json(res, 401, { error: 'Unauthorized' }); return; }
            const body = JSON.parse((await readBody(req)).toString());
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
            const all      = body.transactions || [];
            const personal = all.filter(t => t.scope === 'personal');
            const shared   = all.filter(t => t.scope !== 'personal');
            // Save personal
            db.prepare(`
                INSERT INTO user_data (user_id, transactions_json, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                    transactions_json = excluded.transactions_json,
                    updated_at        = excluded.updated_at
            `).run(decoded.userId, JSON.stringify(personal));
            // Save shared (only if in a household)
            if (user && user.household_id) {
                db.prepare(`
                    INSERT INTO household_data (household_id, transactions_json, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(household_id) DO UPDATE SET
                        transactions_json = excluded.transactions_json,
                        updated_at        = excluded.updated_at
                `).run(user.household_id, JSON.stringify(shared));
            }
            json(res, 200, { success: true });
            return;
        }

        // ── Partner: status ───────────────────────────────────────────────────
        if (pathname === '/api/partner/status' && req.method === 'GET') {
            if (!db) { json(res, 503, { error: 'Database unavailable' }); return; }
            const decoded = verifyToken(req);
            if (!decoded) { json(res, 401, { error: 'Unauthorized' }); return; }
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
            let partner = null;
            if (user && user.household_id) {
                partner = db.prepare('SELECT id, email FROM users WHERE household_id = ? AND id != ?').get(user.household_id, decoded.userId);
            }
            const invite = db.prepare(`SELECT code FROM household_invites WHERE inviter_id = ? AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1`).get(decoded.userId);
            json(res, 200, { linked: !!partner, partner: partner || null, inviteCode: invite ? invite.code : null });
            return;
        }

        // ── Partner: generate invite code ─────────────────────────────────────
        if (pathname === '/api/partner/invite' && req.method === 'POST') {
            if (!db) { json(res, 503, { error: 'Database unavailable' }); return; }
            const decoded = verifyToken(req);
            if (!decoded) { json(res, 401, { error: 'Unauthorized' }); return; }
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
            if (user && user.household_id) { json(res, 400, { error: 'Already linked to a partner' }); return; }
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let code = null;
            for (let i = 0; i < 10; i++) {
                const attempt = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                try {
                    db.prepare(`INSERT INTO household_invites (code, inviter_id, expires_at) VALUES (?, ?, datetime('now', '+24 hours'))`).run(attempt, decoded.userId);
                    code = attempt;
                    break;
                } catch(e) { /* duplicate, retry */ }
            }
            if (!code) { json(res, 500, { error: 'Could not generate code, please try again' }); return; }
            json(res, 200, { code });
            return;
        }

        // ── Partner: accept invite code ───────────────────────────────────────
        if (pathname === '/api/partner/accept' && req.method === 'POST') {
            if (!db) { json(res, 503, { error: 'Database unavailable' }); return; }
            const decoded = verifyToken(req);
            if (!decoded) { json(res, 401, { error: 'Unauthorized' }); return; }
            const body = JSON.parse((await readBody(req)).toString());
            const code = (body.code || '').toUpperCase().trim();
            if (!code) { json(res, 400, { error: 'Code is required' }); return; }
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
            if (user && user.household_id) { json(res, 400, { error: 'You are already linked to a partner' }); return; }
            const invite = db.prepare(`SELECT * FROM household_invites WHERE code = ? AND used = 0 AND expires_at > datetime('now')`).get(code);
            if (!invite) { json(res, 400, { error: 'Invalid or expired code — check the code and try again' }); return; }
            if (invite.inviter_id === decoded.userId) { json(res, 400, { error: 'You cannot use your own invite code' }); return; }
            const inviter = db.prepare('SELECT * FROM users WHERE id = ?').get(invite.inviter_id);
            if (inviter && inviter.household_id) { json(res, 400, { error: 'That invite is no longer valid' }); return; }
            // Create household
            const householdId = db.prepare('INSERT INTO households DEFAULT VALUES').run().lastInsertRowid;
            db.prepare('UPDATE users SET household_id = ? WHERE id IN (?, ?)').run(householdId, invite.inviter_id, decoded.userId);
            db.prepare('UPDATE household_invites SET used = 1 WHERE id = ?').run(invite.id);
            // Migrate inviter's existing transactions to shared household data
            const inviterData = db.prepare('SELECT transactions_json FROM user_data WHERE user_id = ?').get(invite.inviter_id);
            if (inviterData) {
                const existing = JSON.parse(inviterData.transactions_json || '[]');
                const asShared = existing.filter(t => t.scope !== 'personal').map(t => ({ ...t, scope: 'shared' }));
                const asPersonal = existing.filter(t => t.scope === 'personal');
                db.prepare('INSERT OR REPLACE INTO household_data (household_id, transactions_json) VALUES (?, ?)').run(householdId, JSON.stringify(asShared));
                db.prepare('UPDATE user_data SET transactions_json = ? WHERE user_id = ?').run(JSON.stringify(asPersonal), invite.inviter_id);
            }
            const partner = db.prepare('SELECT id, email FROM users WHERE id = ?').get(invite.inviter_id);
            json(res, 200, { success: true, partner });
            return;
        }

        // ── Partner: unlink ───────────────────────────────────────────────────
        if (pathname === '/api/partner/unlink' && req.method === 'DELETE') {
            if (!db) { json(res, 503, { error: 'Database unavailable' }); return; }
            const decoded = verifyToken(req);
            if (!decoded) { json(res, 401, { error: 'Unauthorized' }); return; }
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
            if (!user || !user.household_id) { json(res, 400, { error: 'Not linked to a partner' }); return; }
            // Copy shared transactions to this user's personal data before unlinking
            const sharedRow = db.prepare('SELECT transactions_json FROM household_data WHERE household_id = ?').get(user.household_id);
            if (sharedRow) {
                const shared = JSON.parse(sharedRow.transactions_json || '[]').map(t => ({ ...t, scope: 'personal' }));
                const personalRow = db.prepare('SELECT transactions_json FROM user_data WHERE user_id = ?').get(decoded.userId);
                const existing = personalRow ? JSON.parse(personalRow.transactions_json || '[]') : [];
                db.prepare('INSERT OR REPLACE INTO user_data (user_id, transactions_json) VALUES (?, ?)').run(decoded.userId, JSON.stringify([...shared, ...existing]));
            }
            db.prepare('UPDATE users SET household_id = NULL WHERE id = ?').run(decoded.userId);
            json(res, 200, { success: true });
            return;
        }

        // ── Auth: Update partner names ────────────────────────────────────────
        if (pathname === '/api/auth/profile' && req.method === 'PUT') {
            if (!db) { json(res, 503, { error: 'Database unavailable' }); return; }
            const decoded = verifyToken(req);
            if (!decoded) { json(res, 401, { error: 'Unauthorized' }); return; }
            const body = JSON.parse((await readBody(req)).toString());
            db.prepare('UPDATE users SET p1_name = ?, p2_name = ? WHERE id = ?')
              .run(body.p1Name || 'Partner 1', body.p2Name || 'Partner 2', decoded.userId);
            json(res, 200, { success: true });
            return;
        }

        // ── Virtual Card: status ──────────────────────────────────────────────
        if (pathname === '/api/vc/status' && req.method === 'GET') {
            const data = loadPartnerData();
            json(res, 200, {
                stripeConfigured: !!stripe,
                me: data.me ? {
                    name: data.me.name,
                    hasCard: !!data.me.stripeCardId,
                    hasRealCard: !!data.me.stripePaymentMethodId,
                    email: data.me.email
                } : null,
                spouse: data.spouse ? {
                    name: data.spouse.name,
                    hasCard: !!data.spouse.stripeCardId,
                    hasRealCard: !!data.spouse.stripePaymentMethodId,
                    email: data.spouse.email
                } : null,
                splitRatio: data.splitRatio
            });
            return;
        }

        // ── Virtual Card: get card details ────────────────────────────────────
        if (pathname === '/api/vc/cards' && req.method === 'GET') {
            if (!stripe) {
                json(res, 400, { error: 'Stripe not configured' });
                return;
            }
            const data = loadPartnerData();
            const cards = {};

            for (const partnerKey of ['me', 'spouse']) {
                const partner = data[partnerKey];
                if (!partner || !partner.stripeCardId) {
                    cards[partnerKey] = null;
                    continue;
                }
                try {
                    const card = await stripe.issuing.cards.retrieve(partner.stripeCardId, {
                        expand: ['number', 'cvc']
                    });
                    cards[partnerKey] = {
                        id: card.id,
                        last4: card.last4,
                        expMonth: card.exp_month,
                        expYear: card.exp_year,
                        number: card.number || null,
                        cvc: card.cvc || null,
                        status: card.status,
                        brand: card.brand || 'Visa',
                        name: partner.name
                    };
                } catch (e) {
                    console.error(`Failed to retrieve card for ${partnerKey}:`, e.message);
                    cards[partnerKey] = {
                        id: partner.stripeCardId,
                        last4: partner.last4 || '????',
                        expMonth: partner.expMonth || 12,
                        expYear: partner.expYear || 2028,
                        number: null,
                        cvc: null,
                        status: 'active',
                        brand: 'Visa',
                        name: partner.name,
                        error: e.message
                    };
                }
            }

            json(res, 200, { cards });
            return;
        }

        // ── Virtual Card: setup cardholder + issue card ───────────────────────
        if (pathname === '/api/vc/setup-cardholder' && req.method === 'POST') {
            if (!stripe) {
                json(res, 400, { error: 'Stripe not configured. Add STRIPE_SECRET_KEY to environment variables.' });
                return;
            }
            const body = JSON.parse((await readBody(req)).toString());
            const { partnerKey, name, email, phone, dob, address } = body;

            if (!partnerKey || !['me', 'spouse'].includes(partnerKey)) {
                json(res, 400, { error: 'Invalid partnerKey' });
                return;
            }
            if (!name || !email) {
                json(res, 400, { error: 'name and email are required' });
                return;
            }

            const data = loadPartnerData();

            try {
                // Create or retrieve cardholder
                let cardholderId = data[partnerKey]?.stripeCardholderId;
                if (!cardholderId) {
                    const cardholderParams = {
                        name,
                        email,
                        phone_number: phone || '+15555555555',
                        status: 'active',
                        type: 'individual',
                        individual: {
                            first_name: name.split(' ')[0],
                            last_name: name.split(' ').slice(1).join(' ') || name.split(' ')[0],
                            ...(dob ? { dob: { day: dob.day, month: dob.month, year: dob.year } } : {})
                        },
                        billing: {
                            address: address || {
                                line1: '123 Main St',
                                city: 'San Francisco',
                                state: 'CA',
                                postal_code: '94111',
                                country: 'US'
                            }
                        }
                    };
                    const cardholder = await stripe.issuing.cardholders.create(cardholderParams);
                    cardholderId = cardholder.id;
                }

                // Issue a virtual card
                const card = await stripe.issuing.cards.create({
                    cardholder: cardholderId,
                    currency: 'usd',
                    type: 'virtual',
                    status: 'active'
                });

                // Save to partner data
                data[partnerKey] = {
                    ...data[partnerKey],
                    name,
                    email,
                    stripeCardholderId: cardholderId,
                    stripeCardId: card.id,
                    last4: card.last4,
                    expMonth: card.exp_month,
                    expYear: card.exp_year
                };
                savePartnerData(data);

                json(res, 200, {
                    success: true,
                    card: {
                        id: card.id,
                        last4: card.last4,
                        expMonth: card.exp_month,
                        expYear: card.exp_year,
                        status: card.status,
                        brand: 'Visa',
                        name
                    }
                });
            } catch (e) {
                console.error('Stripe cardholder/card creation failed:', e.message);
                json(res, 500, { error: e.message });
            }
            return;
        }

        // ── Virtual Card: create SetupIntent for real card linking ─────────────
        if (pathname === '/api/vc/create-setup-intent' && req.method === 'POST') {
            if (!stripe) {
                json(res, 400, { error: 'Stripe not configured' });
                return;
            }
            const body = JSON.parse((await readBody(req)).toString());
            const { partnerKey } = body;

            const data = loadPartnerData();
            const partner = data[partnerKey];
            if (!partner) {
                json(res, 400, { error: 'Partner not set up yet. Create a virtual card first.' });
                return;
            }

            try {
                // Ensure Stripe Customer exists
                let customerId = partner.stripeCustomerId;
                if (!customerId) {
                    const customer = await stripe.customers.create({
                        name: partner.name,
                        email: partner.email
                    });
                    customerId = customer.id;
                    data[partnerKey].stripeCustomerId = customerId;
                    savePartnerData(data);
                }

                const setupIntent = await stripe.setupIntents.create({
                    customer: customerId,
                    payment_method_types: ['card'],
                    usage: 'off_session'
                });

                json(res, 200, {
                    clientSecret: setupIntent.client_secret,
                    customerId
                });
            } catch (e) {
                console.error('SetupIntent creation failed:', e.message);
                json(res, 500, { error: e.message });
            }
            return;
        }

        // ── Virtual Card: confirm payment method after SetupIntent ─────────────
        if (pathname === '/api/vc/confirm-payment-method' && req.method === 'POST') {
            if (!stripe) {
                json(res, 400, { error: 'Stripe not configured' });
                return;
            }
            const body = JSON.parse((await readBody(req)).toString());
            const { partnerKey, paymentMethodId } = body;

            const data = loadPartnerData();
            const partner = data[partnerKey];
            if (!partner || !partner.stripeCustomerId) {
                json(res, 400, { error: 'Partner or customer not found' });
                return;
            }

            try {
                // Attach payment method to customer
                await stripe.paymentMethods.attach(paymentMethodId, {
                    customer: partner.stripeCustomerId
                });

                // Set as default
                await stripe.customers.update(partner.stripeCustomerId, {
                    invoice_settings: { default_payment_method: paymentMethodId }
                });

                data[partnerKey].stripePaymentMethodId = paymentMethodId;
                savePartnerData(data);

                json(res, 200, { success: true });
            } catch (e) {
                console.error('Payment method confirmation failed:', e.message);
                json(res, 500, { error: e.message });
            }
            return;
        }

        // ── Virtual Card: update split ratio ──────────────────────────────────
        if (pathname === '/api/vc/split-ratio' && req.method === 'POST') {
            const body = JSON.parse((await readBody(req)).toString());
            const { splitRatio } = body;
            if (typeof splitRatio !== 'number' || splitRatio < 0 || splitRatio > 1) {
                json(res, 400, { error: 'splitRatio must be a number between 0 and 1' });
                return;
            }
            const data = loadPartnerData();
            data.splitRatio = splitRatio;
            savePartnerData(data);
            json(res, 200, { success: true, splitRatio });
            return;
        }

        // ── Virtual Card: get VC transactions ─────────────────────────────────
        if (pathname === '/api/vc/transactions' && req.method === 'GET') {
            const data = loadPartnerData();
            json(res, 200, { transactions: data.vcTransactions || [] });
            return;
        }

        // ── Virtual Card: publishable key (for Stripe.js on frontend) ────────
        if (pathname === '/api/vc/publishable-key' && req.method === 'GET') {
            const pk = process.env.STRIPE_PUBLISHABLE_KEY;
            if (!pk) {
                json(res, 400, { error: 'STRIPE_PUBLISHABLE_KEY not configured' });
                return;
            }
            json(res, 200, { publishableKey: pk });
            return;
        }

        // ── Virtual Card: delete partner data (reset) ─────────────────────────
        if (pathname === '/api/vc/reset-partner' && req.method === 'POST') {
            const body = JSON.parse((await readBody(req)).toString());
            const { partnerKey } = body;
            if (!['me', 'spouse'].includes(partnerKey)) {
                json(res, 400, { error: 'Invalid partnerKey' });
                return;
            }
            const data = loadPartnerData();
            data[partnerKey] = null;
            savePartnerData(data);
            json(res, 200, { success: true });
            return;
        }

        // ── Existing endpoints ────────────────────────────────────────────────
        if (pathname === '/api/process-receipt' && req.method === 'POST') {
            await handleReceiptProcessing(req, res);
            return;
        }

        if (pathname === '/api/openai-available' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ available: !!OPENAI_API_KEY }));
            return;
        }

        // ── Translate expense description ─────────────────────────────────────
        if (pathname === '/api/translate' && req.method === 'POST') {
            if (!OPENAI_API_KEY) { json(res, 503, { error: 'Translation not available' }); return; }
            const body = JSON.parse((await readBody(req)).toString());
            const { text, targetLanguage } = body;
            if (!text || !text.trim()) { json(res, 400, { error: 'text is required' }); return; }
            const langLabel = (targetLanguage === 'ja') ? 'Japanese' : 'English';
            try {
                const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [{
                            role: 'user',
                            content: `Translate this expense description to natural ${langLabel}. Reply with only the translation, nothing else: "${text}"`
                        }],
                        max_tokens: 80
                    })
                });
                if (!openaiRes.ok) { json(res, 502, { error: 'Translation API error' }); return; }
                const data = await openaiRes.json();
                json(res, 200, { translation: data.choices[0].message.content.trim() });
            } catch (e) {
                console.error('Translation error:', e.message);
                json(res, 500, { error: 'Translation failed' });
            }
            return;
        }

        // Serve static files
        let filePath = pathname === '/'    ? '/landing.html'
                     : pathname === '/app' ? '/index.html'
                     : pathname;
        filePath = path.join(__dirname, filePath);

        if (!fs.existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
            return;
        }

        const ext = path.extname(filePath);
        const mimeType = mimeTypes[ext] || 'application/octet-stream';
        const fileContent = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(fileContent);

    } catch (error) {
        console.error('Server error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
    }
});

// ── Stripe Webhook Handler ───────────────────────────────────────────────────
async function handleStripeWebhook(req, res) {
    const rawBody = await readBody(req);
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        if (stripe && STRIPE_WEBHOOK_SECRET && sig) {
            event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
        } else {
            // Accept unverified in dev (no webhook secret configured)
            event = JSON.parse(rawBody.toString());
        }
    } catch (e) {
        console.error('Webhook signature verification failed:', e.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Webhook signature invalid' }));
        return;
    }

    console.log('Stripe webhook received:', event.type);

    try {
        switch (event.type) {
            case 'issuing_authorization.created':
            case 'issuing_authorization.request':
                await handleIssuingAuthorization(event.data.object);
                break;

            case 'issuing_transaction.created':
                await handleIssuingTransaction(event.data.object);
                break;

            default:
                console.log('Unhandled webhook event type:', event.type);
        }
    } catch (e) {
        console.error('Webhook processing error:', e.message);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ received: true }));
}

async function handleIssuingAuthorization(authorization) {
    console.log('Issuing authorization:', authorization.id, 'amount:', authorization.amount);

    if (!stripe) return;

    try {
        // Approve all authorizations (add spending controls logic here if needed)
        await stripe.issuing.authorizations.approve(authorization.id);
        console.log('Authorization approved:', authorization.id);
    } catch (e) {
        console.error('Failed to approve authorization:', e.message);
    }
}

async function handleIssuingTransaction(transaction) {
    console.log('Issuing transaction:', transaction.id, 'amount:', transaction.amount);

    if (!stripe) return;

    const data = loadPartnerData();
    const splitRatio = data.splitRatio || 0.5;
    const totalAmountCents = Math.abs(transaction.amount);
    const totalAmount = totalAmountCents / 100;

    const myShare = Math.round(totalAmountCents * splitRatio) / 100;
    const spouseShare = Math.round(totalAmount * 100 - myShare * 100) / 100;

    const merchant = transaction.merchant_data?.name || 'Unknown Merchant';
    const transactionDate = new Date(transaction.created * 1000).toISOString();

    // Charge each partner their share
    const chargeResults = { me: null, spouse: null };

    for (const [partnerKey, share] of [['me', myShare], ['spouse', spouseShare]]) {
        const partner = data[partnerKey];
        if (!partner || !partner.stripeCustomerId || !partner.stripePaymentMethodId) {
            console.warn(`Partner ${partnerKey} has no linked real card, skipping charge`);
            chargeResults[partnerKey] = { skipped: true, reason: 'No linked real card' };
            continue;
        }

        try {
            const shareCents = Math.round(share * 100);
            if (shareCents <= 0) {
                chargeResults[partnerKey] = { skipped: true, reason: 'Zero amount' };
                continue;
            }

            const paymentIntent = await stripe.paymentIntents.create({
                amount: shareCents,
                currency: transaction.currency || 'usd',
                customer: partner.stripeCustomerId,
                payment_method: partner.stripePaymentMethodId,
                off_session: true,
                confirm: true,
                description: `SplitMate: ${partner.name}'s share of ${merchant} — $${totalAmount.toFixed(2)} total`,
                metadata: {
                    splitmate_transaction: transaction.id,
                    partner: partnerKey,
                    merchant,
                    total_amount: totalAmount.toString()
                }
            });

            console.log(`Charged ${partnerKey} $${share} — PaymentIntent: ${paymentIntent.id}`);
            chargeResults[partnerKey] = { success: true, paymentIntentId: paymentIntent.id, amount: share };
        } catch (e) {
            console.error(`Failed to charge ${partnerKey}:`, e.message);
            chargeResults[partnerKey] = { error: e.message, amount: share };
        }
    }

    // Record VC transaction in local store
    const vcTransaction = {
        id: transaction.id,
        date: transactionDate,
        merchant,
        totalAmount,
        myShare,
        spouseShare,
        splitRatio,
        chargeResults,
        stripeTransactionId: transaction.id,
        currency: transaction.currency || 'usd',
        autoRecorded: true
    };

    if (!data.vcTransactions) data.vcTransactions = [];
    data.vcTransactions.unshift(vcTransaction);
    if (data.vcTransactions.length > 200) data.vcTransactions = data.vcTransactions.slice(0, 200);
    savePartnerData(data);

    // Broadcast in-app notification
    broadcastNotification({
        type: 'vc_charge',
        merchant,
        totalAmount,
        myShare,
        spouseShare,
        splitRatio,
        date: transactionDate,
        transaction: vcTransaction
    });

    console.log(`VC transaction recorded: $${totalAmount} at ${merchant} — split ${(splitRatio*100).toFixed(0)}/${((1-splitRatio)*100).toFixed(0)}`);
}

// ── OpenAI Receipt Handler ───────────────────────────────────────────────────
async function handleReceiptProcessing(req, res) {
    if (!OPENAI_API_KEY) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'OpenAI API key not configured' }));
        return;
    }

    try {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });

        req.on('end', async () => {
            try {
                const { image, isPdf } = JSON.parse(body);

                if (!image) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No image or PDF provided' }));
                    return;
                }

                const promptText = isPdf ?
                    `Analyze this Publix receipt image (converted from PDF) and extract all itemized expenses. Based on the receipt format, this appears to be from Publix grocery store:

IMPORTANT PARSING INSTRUCTIONS FOR PUBLIX RECEIPTS:
- Look for item names followed by prices (usually right-aligned)
- Items are listed with descriptions like "HONEYDEW CHUNKS SM", "CRUNCHY SHRIMP TEM", etc.
- Prices appear to the right, typically in format like "3.11", "10.99 T F"
- The "T" indicates taxable items, "F" indicates food/non-taxable
- Look for "Order Total", "Sales Tax", "Grand Total"
- Ignore promotional savings and discounts

Extract and return in this JSON format:

{
  "items": [
    {"name": "item name", "price": 12.99, "category": "groceries"}
  ],
  "subtotal": 45.67,
  "tax": 3.65,
  "tip": 0.00,
  "fees": 0.00,
  "total": 59.82,
  "merchant": "Publix",
  "date": "2024-01-15"
}

RULES:
- Only include purchased items with positive prices
- Skip promotional savings (negative amounts)
- All items should be categorized as "groceries"
- Parse prices as numbers without $ symbol
- Use "Order Total" as subtotal, "Sales Tax" as tax, "Grand Total" as total` :
                    `Analyze this receipt image and extract all itemized expenses. I need to split expenses with my partner, where:
                                            
1. Extract each individual item with its price
2. Identify subtotal, taxes, tips, delivery fees, and other charges
3. Calculate the total amount
4. Return in JSON format with this structure:

{
  "items": [
    {"name": "item name", "price": 12.99, "category": "groceries|dining|travel|shopping|other"}
  ],
  "subtotal": 45.67,
  "tax": 3.65,
  "tip": 8.00,
  "fees": 2.50,
  "total": 59.82,
  "merchant": "Store Name",
  "date": "2024-01-15"
}

Rules:
- Only include actual purchased items in "items" array
- Put taxes, tips, delivery fees, service charges in separate fields
- Guess the most appropriate category for each item
- If you can't read something clearly, make your best estimate
- Ensure all prices are numbers (not strings)
- Make sure subtotal + tax + tip + fees = total`;

                const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: "gpt-4o",
                        messages: [
                            {
                                role: "user",
                                content: [
                                    { type: "text", text: promptText },
                                    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } }
                                ]
                            }
                        ],
                        response_format: { type: "json_object" },
                        max_tokens: 1000
                    })
                });

                if (!openaiResponse.ok) {
                    const errorData = await openaiResponse.json();
                    throw new Error(`OpenAI API Error: ${errorData.error?.message || openaiResponse.statusText}`);
                }

                const data = await openaiResponse.json();
                const content = data.choices[0].message.content;

                try {
                    const receiptData = JSON.parse(content);
                    const cleanedData = validateAndCleanReceiptData(receiptData);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(cleanedData));
                } catch (parseError) {
                    throw new Error('Failed to parse receipt data from AI response');
                }

            } catch (error) {
                console.error('Receipt processing error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });

    } catch (error) {
        console.error('Request handling error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to process request' }));
    }
}

function validateAndCleanReceiptData(data) {
    const cleaned = {
        items: [],
        subtotal: 0,
        tax: 0,
        tip: 0,
        fees: 0,
        total: 0,
        merchant: '',
        date: ''
    };

    if (Array.isArray(data.items)) {
        cleaned.items = data.items.map(item => ({
            name: String(item.name || 'Unknown Item'),
            price: parseFloat(item.price) || 0,
            category: normalizeCategory(item.category)
        })).filter(item => item.price > 0);
    }

    cleaned.subtotal = parseFloat(data.subtotal) || 0;
    cleaned.tax = parseFloat(data.tax) || 0;
    cleaned.tip = parseFloat(data.tip) || 0;
    cleaned.fees = parseFloat(data.fees) || 0;
    cleaned.total = parseFloat(data.total) || 0;
    cleaned.merchant = String(data.merchant || '').trim();
    cleaned.date = String(data.date || '').trim();

    const calculatedTotal = cleaned.subtotal + cleaned.tax + cleaned.tip + cleaned.fees;
    if (Math.abs(cleaned.total - calculatedTotal) > 0.01) {
        cleaned.total = Math.round(calculatedTotal * 100) / 100;
    }

    return cleaned;
}

function normalizeCategory(category) {
    if (!category) return 'other';
    const normalized = category.toLowerCase();
    if (normalized.includes('grocery') || normalized.includes('food') || normalized.includes('supermarket')) return 'groceries';
    if (normalized.includes('restaurant') || normalized.includes('dining') || normalized.includes('cafe')) return 'dining';
    if (normalized.includes('travel') || normalized.includes('transport') || normalized.includes('hotel')) return 'travel';
    if (normalized.includes('shop') || normalized.includes('retail') || normalized.includes('store')) return 'shopping';
    return 'other';
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`SplitMate server running on http://0.0.0.0:${PORT}`);
    if (!OPENAI_API_KEY) {
        console.warn('Warning: OPENAI_API_KEY not set - receipt scanning will be disabled');
    }
    if (!STRIPE_SECRET_KEY) {
        console.warn('Warning: STRIPE_SECRET_KEY not set - virtual card feature will be disabled');
    }
});

module.exports = server;
