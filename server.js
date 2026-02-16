require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');


const app = express();
// cPanel/Passenger usually sets the port, but we use 3000 as fallback
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.'))); // Serve static files
app.use('/uploads', express.static(uploadsDir)); // Serve uploaded images

// Handle auth-callback.html route
app.get('/auth-callback.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'auth-callback.html'));
});


// Health Check & Debug Info
app.get('/api/health', (req, res) => {
    res.json({
        status: 'running',
        time: new Date(),
        db_path: dbPath,
        env: process.env.NODE_ENV || 'development'
    });
});

// Database Setup
const dbPath = path.join(__dirname, 'ox_database.db');
console.log('Attempting to open database at:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('CRITICAL: Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database successfully.');
        initDatabase();
    }
});

function initDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        discord_id TEXT PRIMARY KEY,
        username TEXT,
        email TEXT,
        balance REAL DEFAULT 0.00,
        avatar TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        discord_id TEXT,
        username TEXT,
        amount REAL,
        status TEXT DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        local_amount REAL,
        sender_number TEXT,
        carrier TEXT
    )`, () => {
        // Migration
        const cols = ['local_amount REAL', 'sender_number TEXT', 'carrier TEXT'];
        cols.forEach(col => {
            db.run(`ALTER TABLE orders ADD COLUMN ${col}`, (err) => { });
        });
    });

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        title TEXT,
        category TEXT,
        price REAL,
        image TEXT,
        description TEXT,
        badge TEXT,
        instant_delivery INTEGER DEFAULT 0
    )`, () => {
        // Migration: Add instant_delivery if it doesn't exist
        db.run('ALTER TABLE products ADD COLUMN instant_delivery INTEGER DEFAULT 0', (err) => { });
        seedProducts();
    });

    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`, () => {
        const defaultRates = {
            'usd_rate': '1.0',
            'gbp_rate': '0.79',
            'lyd_rate': '5.0' // Set your requested default here (5 = $1)
        };

        Object.entries(defaultRates).forEach(([key, val]) => {
            db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, val]);
        });
    });

    // Admin Permissions Table
    db.run(`CREATE TABLE IF NOT EXISTS admin_permissions (
        discord_id TEXT PRIMARY KEY,
        username TEXT,
        can_manage_products INTEGER DEFAULT 0,
        can_manage_orders INTEGER DEFAULT 0,
        can_manage_exchange INTEGER DEFAULT 0,
        can_manage_admins INTEGER DEFAULT 0,
        can_view_dashboard INTEGER DEFAULT 0
    )`, (err) => {
        if (!err) {
            console.log('Admin permissions table ready.');
            // Migration
            db.run('ALTER TABLE admin_permissions ADD COLUMN can_view_dashboard INTEGER DEFAULT 0', (err) => { });

            // Give full access to the main owner automatically
            db.run(`INSERT OR IGNORE INTO admin_permissions 
                (discord_id, username, can_manage_products, can_manage_orders, can_manage_exchange, can_manage_admins, can_view_dashboard) 
                VALUES (?, ?, 1, 1, 1, 1, 1)`, ['1259905369182830715', 'Owner']);
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT,
        title TEXT,
        message TEXT,
        type TEXT DEFAULT 'info',
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Purchases Table
    db.run(`CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT,
        username TEXT,
        product_id TEXT,
        product_title TEXT,
        price REAL,
        status TEXT DEFAULT 'COMPLETED',
        order_details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (!err) {
            db.run('ALTER TABLE purchases ADD COLUMN order_details TEXT', (e) => { });
        }
    });

    // Stock Table
    db.run(`CREATE TABLE IF NOT EXISTS product_stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id TEXT,
        content TEXT,
        is_sold INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
}

function seedProducts() {
    db.get('SELECT count(*) as count FROM products', (err, row) => {
        if (err || row.count > 0) return;
        const products = [
            { id: 'rockstar', title: 'Rockstar', category: 'accounts', price: 0.60, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/ROCK.png', description: 'حسابات روكستار جاهزة ومميزة', instant_delivery: 1 },
            { id: 'reseller', title: 'Reseller Offer', category: 'other', price: 3.0, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/72432219-50393378.jpg', badge: 'عرض خاص', description: 'باقة الموزعين المتكاملة' },
            { id: 'steam', title: 'Steam', category: 'accounts', price: 9.99, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/images.jpg', description: 'حسابات ستيم بمكتبة ألعاب متنوعة' },
            { id: 'netflix', title: 'Netflix', category: 'accounts', price: 10.0, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/hq720.jpg', description: 'اشتراكات نتفلكس 4K رسمية' },
            { id: 'discord-nitro', title: 'Discord Nitro', category: 'discord', price: 4.99, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/DFF.png', badge: 'الأكثر طلباً', description: 'نيترو جيمنج بأفضل الأسعار' },
            { id: 'discord-decoration', title: 'Discord Decoration', category: 'discord', price: 2.99, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/download.jpg', description: 'زينة ديسكورد حصرية' },
            { id: 'discord-boost', title: 'Discord Boost', category: 'discord', price: 3.99, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/How-To-Boost-A-Discord-Server.jpg', description: 'بوستات لرفع مستوى سيرفرك' },
            { id: 'discord-account', title: 'Discord Account', category: 'discord', price: 1.99, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/disabled-discord-account-look-like.jpeg', description: 'حسابات ديسكورد قديمة وموثقة' },
            { id: 'ox-citizen', title: 'OX CITIZEN', category: 'fivem', price: 9.99, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/53D705A9-C1F6-4FD2-A8A6-52B07273D1C7.jpg', badge: 'جديد', description: 'اشتراك سيتيزن المميز' },
            { id: 'ox-graphic', title: 'OX GRAPHIC FIVEM', category: 'fivem', price: 14.99, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/image.png', description: 'جرافيك فايف ام واقعي جداً' },
            { id: 'snap-plus', title: 'Snap Plus', category: 'accounts', price: 5.99, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/What-is-Snapchat-Plus-Subscription.webp', description: 'اشتراك سناب بلس مميزات كاملة' },
            { id: 'windows-pro', title: 'Windows Pro', category: 'accounts', price: 12.99, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/images(1).jpg', description: 'مفاتيح ويندوز 10/11 برو أصلية' },
            { id: 'discord-bot-prog', title: 'برمجة بوتات ديسكورد', category: 'programming', price: 9.99, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/1_2z-HnUMhWWGHoEjzxJ8SBg.jpg', description: 'برمجة بوتات خاصة حسب الطلب' },
            { id: 'fivem-prog', title: 'برمجة فايف ام', category: 'programming', price: 79.99, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/images(2).jpg', description: 'تطوير وتعديل سيرفرات فايف ام' },
            { id: 'servers', title: 'خوادم (Servers)', category: 'other', price: 1.99, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/man_controlling_cloud_server_rocket.jpg', description: 'خوادم قوية لاستضافة مشاريعك' },
            { id: 'onesync', title: 'One Sync FiveM', category: 'fivem', price: 24.99, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/14e6a494-4a25-4bc9-9f52-06be579ccc91-500x279.webp', description: 'مفاتيح ون سينك رسمية' },
            { id: 'fivem-clothes', title: 'ملابس فايف ام', category: 'fivem', price: 9.99, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/Untitled-5.png', description: 'حزم ملابس حصرية وعصرية' },
            { id: 'web-design', title: 'تصميم مواقع', category: 'programming', price: 21.99, image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/images(3).jpg', description: 'تصميم وبرمجة مواقع احترافية' }
        ];
        const stmt = db.prepare('INSERT INTO products (id, title, category, price, image, description, badge, instant_delivery) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        products.forEach(p => stmt.run(p.id, p.title, p.category, p.price, p.image, p.description, p.badge || null, p.instant_delivery || 0));
        stmt.finalize();
    });
}

// Routes
app.get('/api/products', (req, res) => {
    const query = `
        SELECT p.*, 
        (SELECT COUNT(*) FROM product_stock ps WHERE ps.product_id = p.id AND ps.is_sold = 0) as stock_count
        FROM products p
    `;
    db.all(query, [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

// Stock Management Endpoints
app.get('/api/products/:id/stock', (req, res) => {
    // Return only unsold stock
    db.all('SELECT content FROM product_stock WHERE product_id = ? AND is_sold = 0', [req.params.id], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows.map(r => r.content));
    });
});

app.post('/api/products/:id/stock', (req, res) => {
    const { stockItems } = req.body; // Expects array of strings
    if (!Array.isArray(stockItems) || stockItems.length === 0) {
        return res.status(400).json({ error: 'Invalid stock items' });
    }

    // Group items into triplets (3 lines per product)
    const tripleStock = [];
    for (let i = 0; i < stockItems.length; i += 3) {
        let entry = stockItems[i].trim();
        if (i + 1 < stockItems.length) entry += '\n' + stockItems[i + 1].trim();
        if (i + 2 < stockItems.length) entry += '\n' + stockItems[i + 2].trim();
        tripleStock.push(entry);
    }

    const stmt = db.prepare('INSERT INTO product_stock (product_id, content) VALUES (?, ?)');
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        tripleStock.forEach(item => {
            if (item.trim()) stmt.run(req.params.id, item);
        });
        db.run('COMMIT', (err) => {
            if (err) {
                console.error('Stock insert error:', err);
                res.status(500).json({ error: 'Failed to add stock' });
            } else {
                res.json({ message: 'Stock added successfully', count: tripleStock.length });
            }
        });
    });
    stmt.finalize();
});

// Update stock (replace all unsold)
app.put('/api/products/:id/stock', (req, res) => {
    const { stockItems } = req.body;

    // Group items into triplets (3 lines per product)
    const tripleStock = [];
    if (Array.isArray(stockItems)) {
        for (let i = 0; i < stockItems.length; i += 3) {
            let entry = stockItems[i].trim();
            if (i + 1 < stockItems.length) entry += '\n' + stockItems[i + 1].trim();
            if (i + 2 < stockItems.length) entry += '\n' + stockItems[i + 2].trim();
            tripleStock.push(entry);
        }
    }

    // Transaction: Delete all unsold for this product, insert new
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('DELETE FROM product_stock WHERE product_id = ? AND is_sold = 0', [req.params.id]);

        if (tripleStock.length > 0) {
            const stmt = db.prepare('INSERT INTO product_stock (product_id, content) VALUES (?, ?)');
            tripleStock.forEach(item => {
                if (item.trim()) stmt.run(req.params.id, item);
            });
            stmt.finalize();
        }

        db.run('COMMIT', (err) => {
            if (err) {
                console.error('Stock update error:', err);
                res.status(500).json({ error: 'Failed to update stock' });
            } else {
                res.json({ message: 'Stock updated successfully' });
            }
        });
    });
});

// Image Upload Endpoint
app.post('/api/upload-image', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Return the relative path to the uploaded image
        const imagePath = '/uploads/' + req.file.filename;
        res.json({
            message: 'Image uploaded successfully',
            imagePath: imagePath,
            filename: req.file.filename
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to upload image: ' + error.message });
    }
});

app.post('/api/products', (req, res) => {
    const { id, title, category, price, image, description, badge, instant_delivery } = req.body;
    db.run('INSERT INTO products (id, title, category, price, image, description, badge, instant_delivery) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, title, category, price, image, description, badge, instant_delivery ? 1 : 0], (err) => {
            if (err) res.status(500).json({ error: err.message });
            else res.status(201).json({ message: 'Product added' });
        });
});

app.put('/api/products/:id', (req, res) => {
    const { title, category, price, image, description, badge, instant_delivery } = req.body;
    db.run('UPDATE products SET title=?, category=?, price=?, image=?, description=?, badge=?, instant_delivery=? WHERE id=?',
        [title, category, price, image, description, badge, instant_delivery ? 1 : 0, req.params.id], (err) => {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ message: 'Product updated' });
        });
});

app.delete('/api/products/:id', (req, res) => {
    db.run('DELETE FROM products WHERE id = ?', req.params.id, (err) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ message: 'Product deleted' });
    });
});

app.post('/api/auth/discord', (req, res) => {
    const { id, username, email, avatar } = req.body;
    db.run('INSERT OR IGNORE INTO users (discord_id, username, email, avatar) VALUES (?, ?, ?, ?)',
        [id, username, email, avatar], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            // Check if user is in admin_permissions
            db.get('SELECT * FROM admin_permissions WHERE discord_id = ?', [id], (err, admin) => {
                db.get('SELECT * FROM users WHERE discord_id = ?', [id], (err, user) => {
                    if (err) res.status(500).json({ error: err.message });
                    else res.json({
                        user,
                        isAdmin: !!admin || id === '1259905369182830715',
                        permissions: admin || null
                    });
                });
            });
        });
});


// --- Binance Payment Verification ---
async function verifyBinancePayment(transactionId, expectedAmount) {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.BINANCE_API_KEY;
        const apiSecret = process.env.BINANCE_SECRET_KEY;

        if (!apiKey || !apiSecret) {
            console.error('Binance API keys missing');
            return resolve(false); // Can't verify, fallback to manual
        }

        // Fix: Subtract 3 seconds to avoid "ahead of server time" error
        const timestamp = Date.now() - 3000;
        const recvWindow = 10000;
        const query = `timestamp=${timestamp}&recvWindow=${recvWindow}`;

        const signature = crypto.createHmac('sha256', apiSecret).update(query).digest('hex');

        console.log(`[Binance Debug] Checking ID: ${transactionId} - Expected Amount: ${expectedAmount}`);

        const options = {
            hostname: 'api.binance.com',
            port: 443,
            path: `/sapi/v1/pay/transactions?${query}&signature=${signature}`,
            method: 'GET',
            headers: {
                'X-MBX-APIKEY': apiKey
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log('[Binance Response]:', JSON.stringify(json, null, 2));

                    if (json.code === '000000' && json.data) {
                        const tx = json.data.find(t =>
                            String(t.orderId) === String(transactionId) ||
                            String(t.transactionId) === String(transactionId)
                        );
                        if (tx) {
                            const txAmount = parseFloat(tx.amount);
                            const expected = parseFloat(expectedAmount);
                            console.log(`[Binance Match] Found. Status: ${tx.status}, Amount: ${txAmount}`);
                            if (txAmount >= expected) {
                                return resolve(true);
                            }
                        }
                    }
                    resolve(false);
                } catch (e) {
                    console.error('Error parsing Binance response:', e);
                    resolve(false);
                }
            });
        });


        req.on('error', (e) => {
            console.error('Binance API Request Error:', e);
            resolve(false);
        });

        req.end();
    });
}

app.post('/api/orders', async (req, res) => {
    const { userId, username, amount, localAmount, senderNumber, carrier } = req.body;
    const orderId = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();

    let status = 'pending';
    let autoApproved = false;

    // 1. Prevent duplicate Binance Order ID usage
    if (carrier === 'binance' && senderNumber) {
        const duplicate = await new Promise((resolve) => {
            db.get('SELECT id FROM orders WHERE sender_number = ? AND carrier = "binance"', [senderNumber], (err, row) => {
                if (err) resolve(null);
                else resolve(row);
            });
        });

        if (duplicate) {
            return res.status(400).json({ error: 'عذراً، رقم الطلب هذا (Order ID) تم استخدامه مسبقاً لشحن الرصيد.' });
        }
    }


    // Check if it's Binance and try to auto-verify
    if (carrier === 'binance' && senderNumber) {
        console.log(`[Binance] Verifying Order ID: ${senderNumber} for amount: ${amount}`);
        const isValid = await verifyBinancePayment(senderNumber, amount);
        if (isValid) {
            status = 'APPROVED';
            autoApproved = true;
            console.log(`[Binance] Order ${senderNumber} AUTO-APPROVED!`);
        } else {
            console.log(`[Binance] Order ${senderNumber} could not be auto-verified.`);
            return res.status(400).json({ error: 'لم يتم العثور على هذه العملية في Binance أو أن المبلغ غير متطابق. تأكد من رقم الطلب (Order ID).' });
        }
    }


    db.run('INSERT INTO orders (id, discord_id, username, amount, local_amount, sender_number, carrier, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [orderId, userId, username, amount, localAmount, senderNumber, carrier, status], async function (err) {
            if (err) return res.status(500).json({ error: err.message });

            if (autoApproved) {
                // If auto-approved, add balance to user
                db.run('UPDATE users SET balance = balance + ? WHERE discord_id = ?', [amount, userId], (err) => {
                    if (err) console.error('Error auto-updating balance:', err);

                    // Add notification
                    const msg = `تم تفعيل طلب شحن الرصيد تلقائياً بقيمة ${amount} USDT`;
                    db.run('INSERT INTO notifications (discord_id, title, message, type) VALUES (?, ?, ?, ?)',
                        [userId, 'شحن رصيد تلقائي', msg, 'success']);
                });

                return res.status(201).json({
                    message: 'Order created and auto-approved',
                    orderId,
                    autoApproved: true
                });
            }

            res.status(201).json({ message: 'Order created', orderId, autoApproved: false });
        });
});


app.get('/api/admin/orders', (req, res) => {
    db.all('SELECT * FROM orders ORDER BY created_at DESC', [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

app.post('/api/admin/orders/:id/approve', (req, res) => {
    const orderId = req.params.id;
    db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, order) => {
        if (err || !order) return res.status(404).json({ error: 'Order not found' });
        const userId = order.discord_id;
        const amountToAdd = parseFloat(order.amount);
        const username = order.username;

        db.run('INSERT OR IGNORE INTO users (discord_id, username, balance) VALUES (?, ?, 0)', [userId, username], (err) => {
            if (err) return res.status(500).json({ error: 'Error ensuring user existence' });
            db.run('UPDATE orders SET status = "APPROVED" WHERE id = ?', [orderId], (err) => {
                db.run('UPDATE users SET balance = balance + ? WHERE discord_id = ?', [amountToAdd, userId], (err) => {
                    if (err) res.status(500).json({ error: 'Balance update failed' });
                    else {
                        // Create Notification
                        const msg = `تم إضافة مبلغ $${amountToAdd} لمحفظتك بنجاح! رقم الطلب: ${orderId}`;
                        db.run('INSERT INTO notifications (discord_id, title, message, type) VALUES (?, ?, ?, ?)',
                            [userId, 'تم شحن الرصيد', msg, 'success']);
                        res.json({ message: 'Success', added: amountToAdd });
                    }
                });
            });
        });
    });
});

app.post('/api/admin/orders/:id/reject', (req, res) => {
    const orderId = req.params.id;
    db.get('SELECT discord_id FROM orders WHERE id = ?', [orderId], (err, order) => {
        if (err || !order) return res.status(404).json({ error: 'Order not found' });
        const userId = order.discord_id;
        db.run('UPDATE orders SET status = "REJECTED" WHERE id = ?', [orderId], (err) => {
            if (err) res.status(500).json({ error: err.message });
            else {
                const msg = `عذراً، تم رفض طلبك رقم: ${orderId}. يرجى التواصل مع الدعم للمزيد من التفاصيل.`;
                db.run('INSERT INTO notifications (discord_id, title, message, type) VALUES (?, ?, ?, ?)',
                    [userId, 'تم رفض الطلب', msg, 'error']);
                res.json({ message: 'Order rejected' });
            }
        });
    });
});

// Purchases Endpoints
app.get('/api/admin/purchases', (req, res) => {
    db.all('SELECT * FROM purchases ORDER BY created_at DESC', [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

// Deliver Manual Purchase
app.post('/api/admin/purchases/:id/deliver', (req, res) => {
    const { id } = req.params;
    const { order_details } = req.body;

    db.get('SELECT discord_id, product_title FROM purchases WHERE id = ?', [id], (err, p) => {
        if (err || !p) return res.status(404).json({ error: 'Purchase not found' });

        db.run('UPDATE purchases SET order_details = ?, status = "DELIVERED" WHERE id = ?', [order_details, id], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // Notify user
            const msg = `تم تسليم طلبك الخاص بمنتج "${p.product_title}"! يمكنك رؤية البيانات الآن في منطقة العميل.`;
            db.run('INSERT INTO notifications (discord_id, title, message, type) VALUES (?, ?, ?, ?)',
                [p.discord_id, 'تم تسليم المنتج 📦', msg, 'success']);

            res.json({ message: 'Purchase delivered successfully' });
        });
    });
});

app.post('/api/purchases', (req, res) => {
    const { discord_id, username, product_id, product_title, price, quantity } = req.body;
    const qty = parseInt(quantity) || 1;

    // 1. Get product info (to check if it's instant delivery)
    db.get('SELECT * FROM products WHERE id = ?', [product_id], (err, product) => {
        if (err || !product) return res.status(404).json({ error: 'Product not found' });

        // 2. Check balance first
        db.get('SELECT balance FROM users WHERE discord_id = ?', [discord_id], (err, user) => {
            if (err || !user) return res.status(404).json({ error: 'User not found' });

            if (user.balance < price) {
                return res.status(400).json({ error: 'رصيدك غير كافٍ لإتمام عملية الشراء.' });
            }

            // 3. Handle Stock if instant delivery
            const isInstant = product.instant_delivery === 1;

            if (isInstant) {
                // Find unsold stock items
                db.all('SELECT id, content FROM product_stock WHERE product_id = ? AND is_sold = 0 LIMIT ?', [product_id, qty], (err, stockRows) => {
                    if (err) return res.status(500).json({ error: 'Database error checking stock' });

                    if (stockRows.length < qty) {
                        return res.status(400).json({ error: 'عذراً، لا يوجد مخزون كافٍ متبقي لهذا المنتج حالياً.' });
                    }

                    const stockIds = stockRows.map(r => r.id);
                    const deliveredContent = stockRows.map(r => r.content).join('\n');

                    // All checks passed -> Start transaction
                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION');

                        // Deduct balance
                        db.run('UPDATE users SET balance = balance - ? WHERE discord_id = ?', [price, discord_id]);

                        // Mark stock as sold
                        const placeholders = stockIds.map(() => '?').join(',');
                        db.run(`UPDATE product_stock SET is_sold = 1 WHERE id IN (${placeholders})`, stockIds);

                        // Record purchase
                        db.run(`INSERT INTO purchases (discord_id, username, product_id, product_title, price, order_details) 
                                VALUES (?, ?, ?, ?, ?, ?)`,
                            [discord_id, username, product_id, product_title, price, deliveredContent]);

                        db.run('COMMIT', (err) => {
                            if (err) {
                                console.error('Purchase transaction error:', err);
                                return res.status(500).json({ error: 'Failed to complete purchase (Transaction failed)' });
                            }

                            // Add notification
                            const msg = `تم شراء منتج "${product_title}" بنجاح بقيمة $${price}. تسيلم فوري: \n${deliveredContent}`;
                            db.run('INSERT INTO notifications (discord_id, title, message, type) VALUES (?, ?, ?, ?)',
                                [discord_id, 'تمت عملية الشراء بنجاح 🚀', msg, 'success']);

                            res.json({
                                message: 'Purchase successful',
                                newBalance: user.balance - price,
                                deliveredItems: deliveredContent
                            });
                        });
                    });
                });
            } else {
                // Non-instant delivery: just deduct and record
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    db.run('UPDATE users SET balance = balance - ? WHERE discord_id = ?', [price, discord_id]);
                    db.run(`INSERT INTO purchases (discord_id, username, product_id, product_title, price, order_details) 
                            VALUES (?, ?, ?, ?, ?, ?)`,
                        [discord_id, username, product_id, product_title, price, 'جاري معالجة الطلب...']);
                    db.run('COMMIT', (err) => {
                        if (err) return res.status(500).json({ error: 'Purchase failed' });

                        const msg = `تم شراء منتج "${product_title}" بنجاح بقيمة $${price}. سيتم معالجة طلبك قريباً.`;
                        db.run('INSERT INTO notifications (discord_id, title, message, type) VALUES (?, ?, ?, ?)',
                            [discord_id, 'تم استلام طلبك بنجاح', msg, 'success']);

                        res.json({ message: 'Purchase successful', newBalance: user.balance - price });
                    });
                });
            }
        });
    });
});



app.get('/api/notifications/:userId', (req, res) => {
    db.all('SELECT * FROM notifications WHERE discord_id = ? ORDER BY created_at DESC', [req.params.userId], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

app.post('/api/notifications/read-all/:userId', (req, res) => {
    db.run('UPDATE notifications SET is_read = 1 WHERE discord_id = ?', [req.params.userId], (err) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ message: 'Notifications marked as read' });
    });
});

app.delete('/api/notifications/clear/:userId', (req, res) => {
    db.run('DELETE FROM notifications WHERE discord_id = ?', [req.params.userId], (err) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ message: 'Notifications cleared' });
    });
});

app.get('/api/user/balance/:id', (req, res) => {
    db.get('SELECT balance FROM users WHERE discord_id = ?', [req.params.id], (err, row) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ balance: row ? row.balance : 0 });
    });
});

app.get('/api/user/stats/:id', (req, res) => {
    const discord_id = req.params.id;
    db.get('SELECT balance FROM users WHERE discord_id = ?', [discord_id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });

        db.get('SELECT COUNT(*) as total_orders FROM purchases WHERE discord_id = ?', [discord_id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json({
                balance: user.balance,
                total_orders: row ? row.total_orders : 0,
                total_reviews: 0, // Placeholder
                status: 'Active'
            });
        });
    });
});

app.get('/api/user/purchases/:id', (req, res) => {
    const discord_id = req.params.id;
    db.all('SELECT * FROM purchases WHERE discord_id = ? ORDER BY created_at DESC LIMIT 5', [discord_id], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

app.get('/api/settings/exchange-rates', (req, res) => {
    db.all('SELECT key, value FROM settings WHERE key LIKE "%_rate"', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const rates = {};
        rows.forEach(row => rates[row.key] = parseFloat(row.value));
        res.json(rates);
    });
});

app.post('/api/admin/settings/exchange-rates', (req, res) => {
    const { usd_rate, gbp_rate, lyd_rate } = req.body;
    console.log('[ADMIN] Updating rates:', req.body);

    const updates = [
        { key: 'usd_rate', value: usd_rate },
        { key: 'gbp_rate', value: gbp_rate },
        { key: 'lyd_rate', value: lyd_rate }
    ];

    let completed = 0;
    let errors = [];

    updates.forEach(u => {
        if (u.value === undefined || isNaN(u.value)) {
            completed++;
            if (completed === updates.length) finalize();
            return;
        }

        db.run('UPDATE settings SET value = ? WHERE key = ?', [u.value.toString(), u.key], function (err) {
            completed++;
            if (err) {
                console.error(`Error updating ${u.key}:`, err.message);
                errors.push(err.message);
            }
            if (completed === updates.length) finalize();
        });
    });

    function finalize() {
        if (errors.length > 0) {
            res.status(500).json({ error: 'Failed to update some rates', details: errors });
        } else {
            res.json({ message: 'Rates updated successfully' });
        }
    }
});

// --- Admin Permissions Management ---

// Get all site users (to select from for admin)
app.get('/api/admin/all-users', (req, res) => {
    db.all('SELECT discord_id, username, balance, avatar FROM users ORDER BY balance DESC', [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

// Update User Balance
app.post('/api/admin/users/update-balance', (req, res) => {
    const { discord_id, amount, action } = req.body; // action: 'set', 'add', 'subtract'

    if (!discord_id) return res.status(400).json({ error: 'User ID is required' });

    let query = '';
    let params = [];

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return res.status(400).json({ error: 'Invalid amount' });

    if (action === 'set') {
        query = 'UPDATE users SET balance = ? WHERE discord_id = ?';
        params = [numAmount, discord_id];
    } else if (action === 'add') {
        query = 'UPDATE users SET balance = balance + ? WHERE discord_id = ?';
        params = [numAmount, discord_id];
    } else if (action === 'subtract') {
        query = 'UPDATE users SET balance = balance - ? WHERE discord_id = ?';
        params = [numAmount, discord_id];
    } else {
        return res.status(400).json({ error: 'Invalid action' });
    }

    db.run(query, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // Notify user
        const msg = action === 'set' ? `تم تعديل رصيدك ليصبح: $${numAmount}` :
            action === 'add' ? `تم إضافة $${numAmount} إلى رصيدك.` :
                `تم خصم $${numAmount} من رصيدك.`;

        db.run('INSERT INTO notifications (discord_id, title, message, type) VALUES (?, ?, ?, ?)',
            [discord_id, 'تحديث الرصيد', msg, 'info']);

        res.json({ message: 'Balance updated successfully' });
    });
});

// Get all admins and their permissions
app.get('/api/admin/list', (req, res) => {
    db.all('SELECT * FROM admin_permissions', [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

// Add/Update Admin Permissions
app.post('/api/admin/permissions', (req, res) => {
    const { discord_id, username, p_products, p_orders, p_exchange, p_admins, p_dashboard } = req.body;
    db.run(`INSERT INTO admin_permissions (discord_id, username, can_manage_products, can_manage_orders, can_manage_exchange, can_manage_admins, can_view_dashboard) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(discord_id) DO UPDATE SET 
            can_manage_products=excluded.can_manage_products,
            can_manage_orders=excluded.can_manage_orders,
            can_manage_exchange=excluded.can_manage_exchange,
            can_manage_admins=excluded.can_manage_admins,
            can_view_dashboard=excluded.can_view_dashboard`,
        [discord_id, username, p_products ? 1 : 0, p_orders ? 1 : 0, p_exchange ? 1 : 0, p_admins ? 1 : 0, p_dashboard ? 1 : 0],
        (err) => {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ message: 'Permissions updated' });
        });
});

// Remove Admin
app.delete('/api/admin/permissions/:id', (req, res) => {
    if (req.params.id === '1259905369182830715') return res.status(403).json({ error: 'Cannot remove owner' });
    db.run('DELETE FROM admin_permissions WHERE discord_id = ?', [req.params.id], (err) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ message: 'Admin removed' });
    });
});

// Start server
const server = app.listen(process.env.PORT || 3000, () => {
    const address = server.address();
    console.log(`Server is running! Port: ${address.port}`);
});
