
// Navbar scroll effect
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Mobile menu toggle
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
const navLinks = document.querySelector('.nav-links');

mobileMenuToggle?.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    mobileMenuToggle.classList.toggle('active');
});

// Theme Toggle
const themeToggle = document.querySelector('.theme-toggle');
const htmlElement = document.documentElement;
const sunIcon = document.querySelector('.sun-icon');
const moonIcon = document.querySelector('.moon-icon');

// Check for saved theme preference
const savedTheme = localStorage.getItem('theme') || 'dark';
htmlElement.setAttribute('data-theme', savedTheme);
updateThemeIcons(savedTheme);

themeToggle?.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    htmlElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcons(newTheme);
});

function updateThemeIcons(theme) {
    if (theme === 'dark') {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
    } else {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    }
}

// Modal Helper Functions
function openModal(modal) {
    if (modal) {
        modal.style.display = 'flex'; // Use flex for centering
        modal.offsetHeight; // Force reflow
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modal) {
    if (modal) {
        modal.classList.remove('active');
        modal.classList.remove('dashboard-active');
        setTimeout(() => {
            modal.style.display = 'none';
            if (modal.id === 'addFundsModal') {
                const paymentMethodSelect = document.getElementById('paymentMethodSelect');
                if (paymentMethodSelect) {
                    paymentMethodSelect.value = 'libyana';
                    paymentMethodSelect.dispatchEvent(new Event('change'));
                }
                if (typeof resetLPViews === 'function') resetLPViews();
            }
            const anyActive = document.querySelector('.contact-modal.active, .about-modal.active, .product-modal.active, .checkout-modal.active, .add-funds-modal.active, .confirmation-modal.active, .status-modal.active, .inbox-modal.active, .tutorial-modal.active, .cart-sidebar.active, .customer-dashboard-modal.active');
            if (!anyActive) {
                document.body.style.overflow = '';
            }
        }, 400);
    }
}

// Helper to reset Add Funds views and inputs
function resetLPViews() {
    const views = document.querySelectorAll('.lp-view');
    views.forEach((v, i) => {
        v.style.display = i === 0 ? 'block' : 'none';
    });
    const inputs = ['lpAmountInput', 'lpOrderIdInput', 'inputSenderNumber', 'inputSentAmount'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

// Smooth scrolling for navigation links
const navLinksAnchors = document.querySelectorAll('.nav-links a');
navLinksAnchors.forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        const isScrollTarget = href.startsWith('#') && document.querySelector(href);

        if (isScrollTarget) {
            e.preventDefault();
            navLinksAnchors.forEach(link => link.classList.remove('active'));
            this.classList.add('active');
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        } else if (href === '#') {
            e.preventDefault();
        }
    });
});

// Scroll Spy
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section[id], header[id], .hero[id]');
    const scrollPos = window.scrollY + 100;
    sections.forEach(section => {
        if (scrollPos >= section.offsetTop && scrollPos < (section.offsetTop + section.offsetHeight)) {
            const currentId = section.getAttribute('id');
            navLinksAnchors.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${currentId}`) {
                    link.classList.add('active');
                }
            });
        }
    });
});

// --- Inbox & Notifications Logic ---
async function fetchNotifications() {
    const userStr = localStorage.getItem('discord_user');
    if (!userStr) return;
    const user = JSON.parse(userStr);
    try {
        const res = await fetch(`/api/notifications/${user.id}`);
        if (!res.ok) return;
        const notifications = await res.json();
        updateInboxUI(notifications);
    } catch (err) {
        console.error('Error fetching notifications:', err);
    }
}

function updateInboxUI(notifications) {
    const inboxBtn = document.getElementById('inboxBtn');
    const inboxBadge = document.getElementById('inboxBadge');
    const inboxContent = document.getElementById('inboxContent');
    if (!inboxBtn || !inboxBadge || !inboxContent) return;
    const unreadCount = notifications.filter(n => !n.is_read || n.is_read == 0).length;
    if (unreadCount > 0) {
        inboxBadge.textContent = unreadCount;
        inboxBtn.classList.add('has-notifications');
    } else {
        inboxBtn.classList.remove('has-notifications');
    }
    if (notifications.length === 0) {
        inboxContent.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted);">لا توجد إشعارات حالياً</div>';
        return;
    }
    inboxContent.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.is_read ? '' : 'unread'}">
            <div class="notification-title">${n.title}</div>
            <div class="notification-message">${n.message}</div>
            <div class="notification-date">${new Date(n.created_at).toLocaleString('ar-LY')}</div>
        </div>
    `).join('');
}

async function markNotificationsRead() {
    const userStr = localStorage.getItem('discord_user');
    if (!userStr) return;
    const user = JSON.parse(userStr);
    try {
        await fetch(`/api/notifications/read-all/${user.id}`, { method: 'POST' });
        fetchNotifications();
    } catch (err) { console.error(err); }
}

async function clearInbox() {
    const userStr = localStorage.getItem('discord_user');
    if (!userStr) return;
    const user = JSON.parse(userStr);
    showConfirm('مسح الإشعارات', 'هل أنت متأكد من مسح جميع الإشعارات؟', async () => {
        try {
            await fetch(`/api/notifications/clear/${user.id}`, { method: 'DELETE' });
            fetchNotifications();
        } catch (err) { console.error(err); }
    });
}

function showConfirm(title, message, onConfirm) {
    const modal = document.getElementById('customConfirmModal');
    // Simplified specific modal usage if it exists, otherwise standard confirm
    if (modal) {
        // ... (implementation if modal exists in HTML)
        openModal(modal);
        // Logic for buttons...
    } else {
        if (confirm(message)) onConfirm();
    }
}

// Initialize Inbox
document.addEventListener('DOMContentLoaded', () => {
    const inboxBtn = document.getElementById('inboxBtn');
    const inboxDropdown = document.getElementById('inboxDropdown');
    const clearInboxBtn = document.getElementById('clearInboxBtn');
    if (inboxBtn && inboxDropdown) {
        inboxBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            inboxDropdown.classList.toggle('active');
            if (inboxDropdown.classList.contains('active')) markNotificationsRead();
        });
        document.addEventListener('click', (e) => {
            if (!inboxDropdown.contains(e.target) && !inboxBtn.contains(e.target)) {
                inboxDropdown.classList.remove('active');
            }
        });
    }
    if (clearInboxBtn) clearInboxBtn.addEventListener('click', clearInbox);
    fetchNotifications();
    setInterval(fetchNotifications, 15000);
});

// Animated counter for stats
const animateCounter = (element, target, duration = 2000) => {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target % 1 === 0 ? target : target.toFixed(1);
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
};

const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statNumbers = entry.target.querySelectorAll('.stat-number');
            statNumbers.forEach(stat => {
                const target = parseFloat(stat.getAttribute('data-target'));
                animateCounter(stat, target);
            });
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const statsContainer = document.querySelector('.stats-container');
if (statsContainer) statsObserver.observe(statsContainer);

// Product card hover effects & Button Ripple
document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('mouseenter', function () { this.style.transform = 'translateY(-10px) scale(1.02)'; });
    card.addEventListener('mouseleave', function () { this.style.transform = 'translateY(0) scale(1)'; });
});

document.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', function (e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    });
});

const style = document.createElement('style');
style.textContent = `
    button { position: relative; overflow: hidden; }
    .ripple { position: absolute; border-radius: 50%; background: rgba(255, 255, 255, 0.3); transform: scale(0); animation: ripple-animation 0.6s ease-out; pointer-events: none; }
    @keyframes ripple-animation { to { transform: scale(4); opacity: 0; } }
`;
document.head.appendChild(style);

// Parallax effect
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const heroContent = document.querySelector('.hero-content');
    const heroBg = document.querySelector('.hero-bg');
    if (heroContent && scrolled < window.innerHeight) {
        heroContent.style.transform = `translateY(${scrolled * 0.5}px)`;
        heroContent.style.opacity = 1 - (scrolled / window.innerHeight);
    }
    if (heroBg && scrolled < window.innerHeight) {
        heroBg.style.transform = `translateY(${scrolled * 0.3}px)`;
    }
});

// Loading Animation
window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease-in';
        document.body.style.opacity = '1';
    }, 100);
});

// --- Products Data & Logic ---
let products = [
    { id: 'rockstar', title: 'Rockstar', category: 'accounts', price: '0.60', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/ROCK.png', description: 'حسابات روكستار جاهزة ومميزة', instant_delivery: true },
    { id: 'reseller', title: 'Reseller Offer', category: 'other', price: '3.0', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/72432219-50393378.jpg', badge: 'عرض خاص', description: 'باقة الموزعين المتكاملة' },
    { id: 'steam', title: 'Steam', category: 'accounts', price: '9.99', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/images.jpg', description: 'حسابات ستيم بمكتبة ألعاب متنوعة' },
    { id: 'netflix', title: 'Netflix', category: 'accounts', price: '10.0', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/hq720.jpg', description: 'اشتراكات نتفلكس 4K رسمية' },
    { id: 'discord-nitro', title: 'Discord Nitro', category: 'discord', price: '4.99', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/DFF.png', badge: 'الأكثر طلباً', description: 'نيترو جيمنج بأفضل الأسعار' },
    { id: 'discord-decoration', title: 'Discord Decoration', category: 'discord', price: '2.99', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/download.jpg', description: 'زينة ديسكورد حصرية' },
    { id: 'discord-boost', title: 'Discord Boost', category: 'discord', price: '3.99', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/How-To-Boost-A-Discord-Server.jpg', description: 'بوستات لرفع مستوى سيرفرك' },
    { id: 'discord-account', title: 'Discord Account', category: 'discord', price: '1.99', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/disabled-discord-account-look-like.jpeg', description: 'حسابات ديسكورد قديمة وموثقة' },
    { id: 'ox-citizen', title: 'OX CITIZEN', category: 'fivem', price: '9.99', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/53D705A9-C1F6-4FD2-A8A6-52B07273D1C7.jpg', badge: 'جديد', description: 'اشتراك سيتيزن المميز' },
    { id: 'ox-graphic', title: 'OX GRAPHIC FIVEM', category: 'fivem', price: '14.99', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/image.png', description: 'جرافيك فايف ام واقعي جداً' },
    { id: 'snap-plus', title: 'Snap Plus', category: 'accounts', price: '5.99', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/What-is-Snapchat-Plus-Subscription.webp', description: 'اشتراك سناب بلس مميزات كاملة' },
    { id: 'windows-pro', title: 'Windows Pro', category: 'accounts', price: '12.99', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/images(1).jpg', description: 'مفاتيح ويندوز 10/11 برو أصلية' },
    { id: 'discord-bot-prog', title: 'برمجة بوتات ديسكورد', category: 'programming', price: '9.99', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/1_2z-HnUMhWWGHoEjzxJ8SBg.jpg', description: 'برمجة بوتات خاصة حسب الطلب' },
    { id: 'fivem-prog', title: 'برمجة فايف ام', category: 'programming', price: '79.99', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/images(2).jpg', description: 'تطوير وتعديل سيرفرات فايف ام' },
    { id: 'servers', title: 'خوادم (Servers)', category: 'other', price: '1.99', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/man_controlling_cloud_server_rocket.jpg', description: 'خوادم قوية لاستضافة مشاريعك' },
    { id: 'onesync', title: 'One Sync FiveM', category: 'fivem', price: '24.99', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/14e6a494-4a25-4bc9-9f52-06be579ccc91-500x279.webp', description: 'مفاتيح ون سينك رسمية' },
    { id: 'fivem-clothes', title: 'ملابس فايف ام', category: 'fivem', price: '9.99', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/Untitled-5.png', description: 'حزم ملابس حصرية وعصرية' },
    { id: 'web-design', title: 'تصميم مواقع', category: 'programming', price: '21.99', image: 'https://r2.fivemanage.com/2KfimCGtqFkmxL9fil5gb/images(3).jpg', description: 'تصميم وبرمجة مواقع احترافية' }
];

async function fetchProducts() {
    try {
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        if (Array.isArray(data)) {
            products = data;
            renderProducts();
        }
    } catch (e) { }
}

const safeStorage = {
    getItem: (key) => { try { return localStorage.getItem(key); } catch (e) { return null; } },
    setItem: (key, val) => { try { localStorage.setItem(key, val); } catch (e) { } }
};

let currentCategory = 'all';
let currentSearchQuery = '';
let currentCurrency = 'USD';
safeStorage.setItem('currency', 'USD');
let userBalance = 0;

let currencyRates = { 'USD': { rate: 1, symbol: '$', name: 'USD', icon: '💲' } };

async function refreshRates() {
    try {
        const res = await fetch('/api/settings/exchange-rates');
        if (res.ok) {
            const data = await res.json();
            if (data.lyd_rate) window.exchangeRate = parseFloat(data.lyd_rate);
            else window.exchangeRate = 13.0;
            const rateText = document.querySelector('.rate-text');
            if (rateText) rateText.textContent = `( الـ 1 دولار = ${parseFloat(window.exchangeRate).toFixed(2)} رصيد )`;
            renderProducts();
            updateBalanceUI();
        }
    } catch (err) { console.error('Failed to sync rates:', err); }
}

refreshRates();

function renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    grid.style.opacity = '0';
    grid.style.transition = 'opacity 0.3s ease';

    const filteredProducts = products.filter(product => {
        const matchesCategory = currentCategory === 'all' || product.category === currentCategory;
        const matchesSearch = product.title.toLowerCase().includes(currentSearchQuery.toLowerCase()) ||
            (product.description && product.description.toLowerCase().includes(currentSearchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    if (filteredProducts.length === 0) {
        grid.innerHTML = '<div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted); font-size: 1.2rem;">لا توجد منتجات تطابق بحثك</div>';
    }

    filteredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.setAttribute('data-category', product.category);
        const currencyData = currencyRates[currentCurrency] || currencyRates['USD'];
        const rate = currencyData.rate;
        const symbol = currencyData.symbol;
        const priceVal = parseFloat(product.price);
        const displayPrice = (priceVal * rate).toFixed(2);
        const badge = product.badge ? `<div class="product-badge">${product.badge}</div>` : '';

        // Stock Display Logic
        let stockBadge = '';
        let isOutOfStock = false;

        if (product.instant_delivery) {
            if (product.stock_count > 0) {
                stockBadge = `<div class="stock-badge">متوفر: ${product.stock_count}</div>`;
            } else {
                stockBadge = `<div class="stock-badge out-of-stock">Out Of Stock</div>`;
                isOutOfStock = true;
            }
        }

        card.innerHTML = `
            <div class="product-image">
                <img src="${product.image}" alt="${product.title}">
                ${badge}
                ${stockBadge}
            </div>
            <div class="product-content">
                ${product.instant_delivery ? '<div class="instant-delivery-badge">🚀 تسليم فوري</div>' : ''}
                <h3 class="product-title">${product.title}</h3>
                <p class="product-description">${product.description || 'وصف المنتج يتوفر قريباً'}</p>
                <div class="product-footer">
                    <span class="product-price">${symbol}${displayPrice}</span>
                    <div class="product-buttons">
                        <button class="btn-add-to-cart ${isOutOfStock ? 'disabled' : ''}" 
                                data-product-id="${product.id}"
                                ${isOutOfStock ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}
                                title="أضف إلى السلة">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="9" cy="21" r="1"></circle>
                                <circle cx="20" cy="21" r="1"></circle>
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                            </svg>
                        </button>
                        <button class="btn-product offer-trigger ${isOutOfStock ? 'disabled' : ''}" 
                                data-title="${product.title}" 
                                ${isOutOfStock ? 'disabled style="background: #374151; cursor: not-allowed; opacity: 0.6;"' : ''}>
                            ${isOutOfStock ? 'نفذت الكمية' : 'عرض للبيع'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        card.addEventListener('mouseenter', function () {
            if (!isOutOfStock) this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        card.addEventListener('mouseleave', function () {
            this.style.transform = 'translateY(0) scale(1)';
        });

        grid.appendChild(card);

        const offerBtn = card.querySelector('.offer-trigger');
        offerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isOutOfStock) openProductModal(product);
        });

        // Add to cart button functionality
        const addToCartBtn = card.querySelector('.btn-add-to-cart');
        if (addToCartBtn && !isOutOfStock) {
            addToCartBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                addToCart({
                    id: product.id,
                    title: product.title,
                    price: product.price,
                    image: product.image,
                    category: product.category
                });
                
                // Visual feedback
                addToCartBtn.classList.add('added');
                addToCartBtn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;
                
                setTimeout(() => {
                    addToCartBtn.classList.remove('added');
                    addToCartBtn.innerHTML = `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="9" cy="21" r="1"></circle>
                            <circle cx="20" cy="21" r="1"></circle>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                        </svg>
                    `;
                }, 1500);
            });
        }

        card.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-product') && !e.target.closest('.btn-add-to-cart') && !isOutOfStock) openProductModal(product);
        });

        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    });

    setTimeout(() => { grid.style.opacity = '1'; }, 50);
}

async function updateBalanceUI() {
    const user = typeof getStoredUser === 'function' ? getStoredUser() : JSON.parse(safeStorage.getItem('discord_user') || 'null');
    if (!user) return;
    try {
        const userId = user.id || user.discord_id;
        const res = await fetch(`/api/user/balance/${userId}`);
        if (res.ok) {
            const data = await res.json();
            userBalance = data.balance || 0;
            const balanceElements = document.querySelectorAll('.account-balance');
            const currencyData = currencyRates[currentCurrency] || currencyRates['USD'];
            const rate = currencyData.rate;
            balanceElements.forEach(el => {
                el.textContent = `(${(userBalance * rate).toFixed(2)})`;
            });
        }
    } catch (err) { console.error('Failed to fetch balance:', err); }
}

document.addEventListener('DOMContentLoaded', () => {
    renderProducts();
    fetchProducts();
    updateBalanceUI();
    setInterval(updateBalanceUI, 5000);
    setInterval(fetchProducts, 10000); // Refresh products/stock every 10s
});

const filterBtns = document.querySelectorAll('.filter-btn');
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.getAttribute('data-filter');
        renderProducts();
    });
});

const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.trim();
        renderProducts();
    });
}

// Scroll Top
const scrollTopBtn = document.getElementById('scrollTopBtn');
if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) scrollTopBtn.classList.add('visible');
        else scrollTopBtn.classList.remove('visible');
    });
    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// Chat Widget
const chatToggleBtn = document.getElementById('chatToggleBtn');
const chatWindow = document.getElementById('chatWindow');
const closeChatBtn = document.getElementById('closeChat');
if (chatToggleBtn && chatWindow) {
    chatToggleBtn.addEventListener('click', () => {
        chatWindow.classList.toggle('active');
        const badge = chatToggleBtn.querySelector('.notification-badge');
        if (badge && chatWindow.classList.contains('active')) badge.style.display = 'none';
    });
}
if (closeChatBtn && chatWindow) closeChatBtn.addEventListener('click', () => { chatWindow.classList.remove('active'); });

// Modals
const contactTriggers = document.querySelectorAll('.contact-trigger');
const aboutTriggers = document.querySelectorAll('.about-trigger');
const contactModal = document.getElementById('contactModal');
const aboutModal = document.getElementById('aboutModal');
const productModal = document.getElementById('productModal');
const modalCloseBtns = document.querySelectorAll('.modal-close-btn');
const modalBackdrops = document.querySelectorAll('.modal-backdrop');

function showStatus(title, message, type = 'success', deliveredItems = null, orderNumber = null) {
    const statusModal = document.getElementById('statusModal');
    const statusIcon = document.getElementById('statusIcon');
    const statusTitle = document.getElementById('statusTitle');
    const statusMessage = document.getElementById('statusMessage');
    const deliveryArea = document.getElementById('deliveryArea');
    const deliveryContent = document.getElementById('deliveryContent');
    const orderNumberArea = document.getElementById('orderNumberArea');
    const orderNumberDisplay = document.getElementById('orderNumberDisplay');
    const btnCustomerArea = document.getElementById('btnCustomerArea');

    if (!statusModal || !statusTitle || !statusMessage || !statusIcon) {
        alert(`${title}\n\n${message}`);
        return;
    }

    statusTitle.textContent = title;
    statusMessage.textContent = message;

    // Handle Order Number Display
    if (orderNumber && orderNumberArea && orderNumberDisplay) {
        orderNumberDisplay.textContent = orderNumber;
        orderNumberArea.style.display = 'block';
        if (btnCustomerArea) btnCustomerArea.style.display = 'flex';
    } else {
        if (orderNumberArea) orderNumberArea.style.display = 'none';
        if (btnCustomerArea) btnCustomerArea.style.display = 'none';
    }

    // Handle Delivery Display
    if (deliveredItems && deliveryArea && deliveryContent) {
        deliveryContent.textContent = deliveredItems;
        deliveryArea.style.display = 'block';
    } else if (deliveryArea) {
        deliveryArea.style.display = 'none';
    }

    if (type === 'success') {
        statusIcon.innerHTML = '<span style="font-size: 30px;">✅</span>';
        statusIcon.style.background = 'rgba(74, 222, 128, 0.1)';
        statusIcon.style.border = '1px solid rgba(74, 222, 128, 0.2)';
    } else {
        statusIcon.innerHTML = '<span style="font-size: 30px;">❌</span>';
        statusIcon.style.background = 'rgba(220, 38, 38, 0.1)';
        statusIcon.style.border = '1px solid rgba(220, 38, 38, 0.2)';
    }

    openModal(statusModal);
}

// Function to open customer area/dashboard
function openCustomerArea() {
    closeModal(document.getElementById('statusModal'));
    window.open('dashboard.html', '_blank');
}

// Global Copy Function
window.copyDelivery = function () {
    const content = document.getElementById('deliveryContent').textContent;
    navigator.clipboard.writeText(content).then(() => {
        const btn = document.querySelector('#deliveryArea button');
        const originalText = btn.textContent;
        btn.textContent = 'تم النسخ!';
        btn.style.background = '#4ade80';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 2000);
    });
};

// Open Checkout
function openCheckoutModal(product) {
    const checkoutModal = document.getElementById('checkoutModal');
    if (!checkoutModal) return;

    const quantity = product.quantity || 1;
    const rate = currencyRates[currentCurrency].rate;
    const symbol = currencyRates[currentCurrency].symbol;
    const priceVal = parseFloat(product.price);
    const totalPriceVal = priceVal * quantity;
    const displayTotalPrice = (totalPriceVal * rate).toFixed(2);

    document.getElementById('checkoutProductName').textContent = `${product.title} (x${quantity})`;
    document.getElementById('checkoutProductPrice').textContent = `${symbol}${(priceVal * rate).toFixed(2)}`;
    document.getElementById('checkoutTotalPrice').textContent = `${symbol}${displayTotalPrice}`;
    document.getElementById('checkoutProductImage').src = product.image;

    const btnProceed = document.getElementById('btnProceedPayment');
    if (btnProceed) {
        const newBtn = btnProceed.cloneNode(true);
        btnProceed.parentNode.replaceChild(newBtn, btnProceed);
        newBtn.addEventListener('click', async () => {
            const paymentMethodInput = document.querySelector('input[name="payment"]:checked');
            const paymentMethod = paymentMethodInput ? paymentMethodInput.value : 'balance';

            if (paymentMethod === 'balance') {
                const user = JSON.parse(safeStorage.getItem('discord_user') || 'null');
                if (!user) {
                    showStatus('خطأ', 'يرجى تسجيل الدخول أولاً لإتمام الشراء.', 'error');
                    return;
                }

                newBtn.disabled = true;
                newBtn.textContent = 'جاري المعالجة...';

                try {
                    const res = await fetch('/api/purchases', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            discord_id: user.id || user.discord_id,
                            username: user.username,
                            product_id: product.id,
                            product_title: product.title,
                            price: totalPriceVal,
                            quantity: quantity
                        })
                    });

                    const data = await res.json();
                    if (res.ok) {
                        closeModal(checkoutModal);
                        let successMsg = `تهانينا! لقد اشتريت "${product.title}" بنجاح. رصيدك الجديد: $${data.newBalance.toFixed(2)}`;
                        showStatus('تم الشراء بنجاح', successMsg, 'success', data.deliveredItems);
                        if (typeof updateBalanceUI === 'function') updateBalanceUI();
                    } else {
                        showStatus('خطأ في الشراء', data.error || 'حدث خطأ أثناء إتمام العملية.', 'error');
                    }
                } catch (err) {
                    showStatus('خطأ', 'تعذر الاتصال بالسيرفر، يرجى المحاولة لاحقاً.', 'error');
                } finally {
                    newBtn.disabled = false;
                    newBtn.textContent = 'Proceed to Payment';
                }
            } else {
                showStatus('بوابة الدفع', 'PayPal (Friends & Family) سيتم تفعيله قريباً. حالياً يرجى استخدام الرصيد.', 'info');
            }
        });
    }

    openModal(checkoutModal);
}

// Events for modals
contactTriggers.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); openModal(contactModal); }));
aboutTriggers.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); openModal(aboutModal); }));
const tutorialTriggers = document.querySelectorAll('.tutorial-trigger');
const tutorialModal = document.getElementById('tutorialModal');
tutorialTriggers.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); openModal(tutorialModal); }));

modalCloseBtns.forEach(btn => btn.addEventListener('click', () => {
    closeModal(contactModal); closeModal(aboutModal); closeModal(tutorialModal); closeModal(productModal);
    closeModal(document.getElementById('checkoutModal')); closeModal(document.getElementById('addFundsModal'));
}));

// Explicit close for dashboard to avoid interference
const dashboardCloseBtn = document.getElementById('dashboardCloseBtn');
if (dashboardCloseBtn) {
    dashboardCloseBtn.addEventListener('click', () => {
        closeModal(document.getElementById('customerDashboardModal'));
    });
}

modalBackdrops.forEach(backdrop => backdrop.addEventListener('click', (e) => {
    e.stopPropagation();
    const modal = backdrop.parentElement;
    if (modal) closeModal(modal);
}));

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.active');
        modals.forEach(m => closeModal(m));
    }
});

// Add Funds Logic
const addFundsTriggers = document.querySelectorAll('.add-funds-trigger');
const addFundsModal = document.getElementById('addFundsModal');
addFundsTriggers.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); openModal(addFundsModal); }));
const addFundsCloseBtn = addFundsModal?.querySelector('.modal-close-btn');
if (addFundsCloseBtn) addFundsCloseBtn.addEventListener('click', () => closeModal(addFundsModal));

async function fetchUserBalance() {
    const storedUser = safeStorage.getItem('discord_user');
    if (!storedUser) return;
    const user = JSON.parse(storedUser);
    try {
        const response = await fetch(`/api/user/balance/${user.id || user.discord_id}`);
        if (response.ok) {
            const data = await response.json();
            userBalance = data.balance;
            const balanceElement = document.querySelector('.account-balance');
            const currencyData = currencyRates[currentCurrency] || currencyRates['USD'];
            if (balanceElement && currencyData) {
                const rate = currencyData.rate;
                const convertedBalance = (userBalance * rate).toFixed(2);
                balanceElement.textContent = `(${convertedBalance})`;
            }
        }
    } catch (error) { console.error('Error fetching balance:', error); }
}
document.addEventListener('DOMContentLoaded', fetchUserBalance);

// Binance Logic
document.addEventListener('DOMContentLoaded', () => {
    const paymentMethodSelect = document.getElementById('paymentMethodSelect');
    const libyanaContent = document.getElementById('libyanaContent');
    const lpContent = document.getElementById('lpContent');
    const btnNextLP = document.getElementById('btnNextLP');
    const btnVerifyLPFinal = document.getElementById('btnVerifyLPFinal');

    if (paymentMethodSelect) {
        paymentMethodSelect.addEventListener('change', (e) => {
            if (e.target.value === 'lp') {
                if (libyanaContent) libyanaContent.style.display = 'none';
                if (lpContent) { lpContent.style.display = 'block'; resetLPViews(); }
            } else {
                if (libyanaContent) libyanaContent.style.display = 'block';
                if (lpContent) lpContent.style.display = 'none';
            }
        });
    }

    if (btnNextLP) {
        btnNextLP.addEventListener('click', () => {
            const amountInput = document.getElementById('lpAmountInput');
            const amount = amountInput ? amountInput.value.trim() : '';
            if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
                showStatus('خطأ', 'الرجاء إدخال مبلغ صحيح', 'error');
                return;
            }
            window.currentLPAmount = amount;
            const s0 = document.getElementById('lpStep0');
            const s2 = document.getElementById('lpStep2');
            if (s0) s0.style.display = 'none';
            if (s2) s2.style.display = 'block';
        });
    }

    if (btnVerifyLPFinal) {
        btnVerifyLPFinal.addEventListener('click', async () => {
            const orderIdInput = document.getElementById('lpOrderIdInput');
            const orderId = orderIdInput ? orderIdInput.value.trim() : '';
            if (!orderId) { showStatus('خطأ', 'الرجاء إدخال رقم الطلب (Order ID)', 'error'); return; }
            if (orderId.length !== 18) { showStatus('تنبيه', 'يجب أن يتكون رقم الطلب من 18 رقماً فقط', 'error'); return; }

            const storedUser = safeStorage.getItem('discord_user');
            const user = storedUser ? JSON.parse(storedUser) : { id: 'manual_guest', username: 'Guest' };
            const amount = window.currentLPAmount || '0';
            const originalText = btnVerifyLPFinal.textContent;
            btnVerifyLPFinal.textContent = 'جاري التحقق...';
            btnVerifyLPFinal.disabled = true;

            try {
                const res = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user.id,
                        username: user.username,
                        amount: amount,
                        localAmount: amount,
                        senderNumber: orderId,
                        carrier: 'binance',
                        status: 'pending'
                    })
                });
                const data = await res.json();
                if (res.ok) {
                    closeModal(addFundsModal);
                    const msg = data.autoApproved ? 'تم شحن رصيدك تلقائياً بنجاح! يمكنك استخدامه الآن.' : 'تم إرسال طلبك بنجاح! سيتم مراجعة الطلب يدوياً قريباً.';
                    setTimeout(() => {
                        showStatus('نجاح', msg, 'success');
                        if (data.autoApproved) fetchUserBalance();
                    }, 400);
                    setTimeout(resetLPViews, 600);
                } else {
                    showStatus('تنبيه', data.error || 'فشل إرسال الطلب', 'error');
                }
            } catch (error) {
                closeModal(addFundsModal);
                alert('تم تسجيل الطلب محلياً (وضع المحاكاة)');
                setTimeout(resetLPViews, 500);
            } finally {
                btnVerifyLPFinal.textContent = originalText;
                btnVerifyLPFinal.disabled = false;
            }
        });
    }
});

// --- Cart Logic (NEW) ---
let cart = JSON.parse(localStorage.getItem('ox_cart')) || [];

function saveCart() {
    localStorage.setItem('ox_cart', JSON.stringify(cart));
    updateCartUI();
}

function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        showStatus('تنبيه', 'هذا المنتج موجود بالفعل في السلة', 'info');
        return;
    }
    cart.push(product);
    saveCart();
    // Product added to cart - sidebar will open automatically
    openCartSidebar();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
}

function clearCart() {
    cart = [];
    saveCart();
}

function updateCartUI() {
    const cartBadge = document.getElementById('cartBadge');
    const cartItems = document.getElementById('cartItems');
    const cartEmpty = document.getElementById('cartEmpty');
    const cartFooter = document.getElementById('cartFooter');
    const cartItemsCount = document.getElementById('cartItemsCount');
    const cartTotal = document.getElementById('cartTotal');

    // Update badge
    if (cartBadge) {
        cartBadge.textContent = cart.length;
        cartBadge.style.display = cart.length > 0 ? 'flex' : 'none';
    }

    // Update items list
    if (cartItems) {
        if (cart.length === 0) {
            cartItems.style.display = 'none';
            if (cartEmpty) cartEmpty.style.display = 'flex';
            if (cartFooter) cartFooter.style.display = 'none';
        } else {
            cartItems.style.display = 'flex';
            if (cartEmpty) cartEmpty.style.display = 'none';
            if (cartFooter) cartFooter.style.display = 'block';

            cartItems.innerHTML = cart.map(item => `
                <div class="cart-item">
                    <div class="cart-item-image">
                        <img src="${item.image}" alt="${item.title}">
                    </div>
                    <div class="cart-item-details">
                        <div>
                            <h4 class="cart-item-title">${item.title}</h4>
                            <p class="cart-item-category">${getCategoryName(item.category)}</p>
                        </div>
                        <div class="cart-item-bottom">
                            <span class="cart-item-price">$${item.price.toFixed(2)}</span>
                            <button class="cart-item-remove" onclick="removeFromCart('${item.id}')" title="إزالة من السلة">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    // Update summary
    if (cartItemsCount) {
        cartItemsCount.textContent = cart.length;
    }
    if (cartTotal) {
        const total = cart.reduce((sum, item) => sum + item.price, 0);
        cartTotal.textContent = '$' + total.toFixed(2);
    }
}

function getCategoryName(category) {
    const categories = {
        'fivem': 'فايف ام',
        'discord': 'ديسكورد',
        'programming': 'برمجة',
        'accounts': 'حسابات',
        'other': 'أخرى'
    };
    return categories[category] || category;
}

function openCartSidebar() {
    const cartSidebar = document.getElementById('cartSidebar');
    if (cartSidebar) {
        cartSidebar.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeCartSidebar() {
    const cartSidebar = document.getElementById('cartSidebar');
    if (cartSidebar) {
        cartSidebar.classList.remove('active');
        const anyActive = document.querySelector('.contact-modal.active, .about-modal.active, .product-modal.active, .checkout-modal.active, .add-funds-modal.active, .confirmation-modal.active, .status-modal.active, .inbox-modal.active, .tutorial-modal.active, .cart-sidebar.active, .customer-dashboard-modal.active');
        if (!anyActive) {
            document.body.style.overflow = '';
        }
    }
}

// Cart Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    updateCartUI();

    const cartBtn = document.getElementById('cartBtn');
    const cartCloseBtn = document.getElementById('cartCloseBtn');
    const cartBackdrop = document.getElementById('cartBackdrop');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const cartCheckoutBtn = document.getElementById('cartCheckoutBtn');

    if (cartBtn) {
        cartBtn.addEventListener('click', openCartSidebar);
    }

    if (cartCloseBtn) {
        cartCloseBtn.addEventListener('click', closeCartSidebar);
    }

    if (cartBackdrop) {
        cartBackdrop.addEventListener('click', closeCartSidebar);
    }

    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            if (cart.length > 0) {
                showConfirm('تأكيد', 'هل أنت متأكد من إفراغ السلة؟', () => {
                    clearCart();
                });
            }
        });
    }

    if (cartCheckoutBtn) {
        cartCheckoutBtn.addEventListener('click', () => {
            const user = getStoredUser ? getStoredUser() : null;
            if (!user) {
                showStatus('تنبيه', 'يجب تسجيل الدخول أولاً', 'error');
                return;
            }
            if (cart.length === 0) {
                showStatus('تنبيه', 'السلة فارغة', 'error');
                return;
            }
            // Process checkout for all cart items
            processCartCheckout();
        });
    }
});

async function processCartCheckout() {
    const user = getStoredUser ? getStoredUser() : null;
    if (!user) return;

    const cartCheckoutBtn = document.getElementById('cartCheckoutBtn');
    if (cartCheckoutBtn) {
        cartCheckoutBtn.disabled = true;
        cartCheckoutBtn.innerHTML = '<span>جاري المعالجة...</span>';
    }

    let successCount = 0;
    let failCount = 0;

    for (const item of cart) {
        try {
            const response = await fetch('/api/purchases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    discord_id: user.id,
                    username: user.username,
                    product_id: item.id,
                    product_title: item.title,
                    price: item.price,
                    quantity: 1
                })
            });

            if (response.ok) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (error) {
            console.error('Checkout error:', error);
            failCount++;
        }
    }

    // Clear cart after checkout
    clearCart();
    closeCartSidebar();

    if (failCount === 0) {
        const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
        const successMessage = `تم شراء المنتج بنجاح!\n\nللحصول على معلومات المنتج الرجاء الضغط على منطقة العميل`;
        showStatus('نجاح', successMessage, 'success', null, orderNumber);
    } else {
        showStatus('تنبيه', `تم شراء ${successCount} منتج، فشل ${failCount} منتج`, 'error');
    }

    if (cartCheckoutBtn) {
        cartCheckoutBtn.disabled = false;
        cartCheckoutBtn.innerHTML = '<span>إتمام الشراء</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>';
    }

    // Refresh user data
    if (typeof updateUIForUser === 'function') {
        updateUIForUser();
    }
}

// Helper function for confirmation modal
function showConfirm(title, message, onConfirm) {
    const modal = document.getElementById('customConfirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('btnConfirmAction');
    const cancelBtn = document.getElementById('btnCancelAction');

    if (!modal) return;

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    modal.style.display = 'flex';
    modal.offsetHeight;
    modal.classList.add('active');

    const handleConfirm = () => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
        onConfirm();
        cleanup();
    };

    const handleCancel = () => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
        cleanup();
    };

    const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
}

// --- Open Product Modal with Cart Connection (Fixed) ---
function openProductModal(product) {
    const modalProductDescription = document.getElementById('modalProductDescription');
    const modalProductName = document.getElementById('modalProductName');
    const modalProductImage = document.getElementById('modalProductImage');
    const modalProductPrice = document.getElementById('modalProductPrice');
    const productModal = document.getElementById('productModal');

    // Quantity Elements
    const qtyInput = document.getElementById('modalQtyInput');
    const qtyMinus = document.getElementById('modalQtyMinus');
    const qtyPlus = document.getElementById('modalQtyPlus');
    let currentQty = 1;

    if (productModal && modalProductName) {
        modalProductName.textContent = product.title;
        if (modalProductDescription) modalProductDescription.textContent = product.description || 'No description available.';
        if (modalProductImage) modalProductImage.src = product.image;
        if (qtyInput) qtyInput.value = 1;

        // Function to update price display based on quantity
        const updatePriceDisplay = () => {
            if (modalProductPrice) {
                const currencyData = currencyRates[currentCurrency] || currencyRates['USD'];
                const rate = currencyData.rate;
                const symbol = currencyData.symbol;
                const priceVal = parseFloat(product.price);
                const total = (priceVal * currentQty * rate).toFixed(2);
                modalProductPrice.textContent = `${symbol}${total}`;
            }
        };

        // Initial Price Update
        updatePriceDisplay();

        // Quantity Logic
        if (qtyMinus && qtyPlus && qtyInput) {
            // Clone buttons to remove old listeners
            const newMinus = qtyMinus.cloneNode(true);
            const newPlus = qtyPlus.cloneNode(true);
            qtyMinus.parentNode.replaceChild(newMinus, qtyMinus);
            qtyPlus.parentNode.replaceChild(newPlus, qtyPlus);

            newMinus.addEventListener('click', () => {
                if (currentQty > 1) {
                    currentQty--;
                    qtyInput.value = currentQty;
                    updatePriceDisplay();
                }
            });

            newPlus.addEventListener('click', () => {
                if (product.instant_delivery && currentQty >= product.stock_count) {
                    showStatus('تنبيه', `عذراً، المتوفر من هذا المنتج هو ${product.stock_count} فقط.`, 'error');
                    return;
                }
                currentQty++;
                qtyInput.value = currentQty;
                updatePriceDisplay();
            });
        }

        const btnBuyNow = document.getElementById('btnBuyNow');
        const btnAddToCart = document.getElementById('btnAddToCart');

        if (btnBuyNow) {
            const newBtn = btnBuyNow.cloneNode(true);
            btnBuyNow.parentNode.replaceChild(newBtn, btnBuyNow);
            newBtn.addEventListener('click', () => {
                // Add to cart instead of direct checkout
                addToCart({
                    id: product.id,
                    title: product.title,
                    price: product.price,
                    image: product.image,
                    category: product.category
                });
                closeModal(productModal);
            });
        }
        openModal(productModal);
    }
}

// End of file logic cleaned up

// Handle query actions (e.g., opening modals from other pages)
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    if (action === 'addfunds') {
        const addFundsModal = document.getElementById('addFundsModal');
        if (addFundsModal) setTimeout(() => openModal(addFundsModal), 500);
    }
});

// Cart System Functions (cart variable defined above)
function saveCart() {
    localStorage.setItem('ox_cart', JSON.stringify(cart));
    updateCartUI();
}

function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        showStatus('تنبيه', 'هذا المنتج موجود بالفعل في السلة', 'info');
        return;
    }
    cart.push(product);
    saveCart();
    // Product added to cart - sidebar will open automatically
    openCartSidebar();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
}

function clearCart() {
    cart = [];
    saveCart();
}

function updateCartUI() {
    const cartBadge = document.getElementById('cartBadge');
    const cartItems = document.getElementById('cartItems');
    const cartEmpty = document.getElementById('cartEmpty');
    const cartFooter = document.getElementById('cartFooter');
    const cartItemsCount = document.getElementById('cartItemsCount');
    const cartTotal = document.getElementById('cartTotal');

    // Update badge
    if (cartBadge) {
        cartBadge.textContent = cart.length;
        cartBadge.style.display = cart.length > 0 ? 'flex' : 'none';
    }

    // Update items list
    if (cartItems) {
        if (cart.length === 0) {
            cartItems.style.display = 'none';
            if (cartEmpty) cartEmpty.style.display = 'flex';
            if (cartFooter) cartFooter.style.display = 'none';
        } else {
            cartItems.style.display = 'flex';
            if (cartEmpty) cartEmpty.style.display = 'none';
            if (cartFooter) cartFooter.style.display = 'block';

            cartItems.innerHTML = cart.map(item => `
                <div class="cart-item">
                    <div class="cart-item-image">
                        <img src="${item.image}" alt="${item.title}">
                    </div>
                    <div class="cart-item-details">
                        <div>
                            <h4 class="cart-item-title">${item.title}</h4>
                            <p class="cart-item-category">${getCategoryName(item.category)}</p>
                        </div>
                        <div class="cart-item-bottom">
                            <span class="cart-item-price">$${item.price.toFixed(2)}</span>
                            <button class="cart-item-remove" onclick="removeFromCart('${item.id}')" title="إزالة من السلة">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    // Update summary
    if (cartItemsCount) {
        cartItemsCount.textContent = cart.length;
    }
    if (cartTotal) {
        const total = cart.reduce((sum, item) => sum + item.price, 0);
        cartTotal.textContent = '$' + total.toFixed(2);
    }
}

function getCategoryName(category) {
    const categories = {
        'fivem': 'فايف ام',
        'discord': 'ديسكورد',
        'programming': 'برمجة',
        'accounts': 'حسابات',
        'other': 'أخرى'
    };
    return categories[category] || category;
}

function openCartSidebar() {
    const cartSidebar = document.getElementById('cartSidebar');
    if (cartSidebar) {
        cartSidebar.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeCartSidebar() {
    const cartSidebar = document.getElementById('cartSidebar');
    if (cartSidebar) {
        cartSidebar.classList.remove('active');
        const anyActive = document.querySelector('.contact-modal.active, .about-modal.active, .product-modal.active, .checkout-modal.active, .add-funds-modal.active, .confirmation-modal.active, .status-modal.active, .inbox-modal.active, .tutorial-modal.active, .cart-sidebar.active, .customer-dashboard-modal.active');
        if (!anyActive) {
            document.body.style.overflow = '';
        }
    }
}

// Cart Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    updateCartUI();

    const cartBtn = document.getElementById('cartBtn');
    const cartCloseBtn = document.getElementById('cartCloseBtn');
    const cartBackdrop = document.getElementById('cartBackdrop');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const cartCheckoutBtn = document.getElementById('cartCheckoutBtn');

    if (cartBtn) {
        cartBtn.addEventListener('click', openCartSidebar);
    }

    if (cartCloseBtn) {
        cartCloseBtn.addEventListener('click', closeCartSidebar);
    }

    if (cartBackdrop) {
        cartBackdrop.addEventListener('click', closeCartSidebar);
    }

    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            if (cart.length > 0) {
                showConfirm('تأكيد', 'هل أنت متأكد من إفراغ السلة؟', () => {
                    clearCart();
                });
            }
        });
    }

    if (cartCheckoutBtn) {
        cartCheckoutBtn.addEventListener('click', () => {
            const user = getStoredUser ? getStoredUser() : null;
            if (!user) {
                showStatus('تنبيه', 'يجب تسجيل الدخول أولاً', 'error');
                return;
            }
            if (cart.length === 0) {
                showStatus('تنبيه', 'السلة فارغة', 'error');
                return;
            }
            // Process checkout for all cart items
            processCartCheckout();
        });
    }
});

async function processCartCheckout() {
    const user = getStoredUser ? getStoredUser() : null;
    if (!user) return;

    const cartCheckoutBtn = document.getElementById('cartCheckoutBtn');
    if (cartCheckoutBtn) {
        cartCheckoutBtn.disabled = true;
        cartCheckoutBtn.innerHTML = '<span>جاري المعالجة...</span>';
    }

    let successCount = 0;
    let failCount = 0;

    for (const item of cart) {
        try {
            const response = await fetch('/api/purchases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    discord_id: user.id,
                    username: user.username,
                    product_id: item.id,
                    product_title: item.title,
                    price: item.price,
                    quantity: 1
                })
            });

            if (response.ok) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (error) {
            console.error('Checkout error:', error);
            failCount++;
        }
    }

    // Clear cart after checkout
    clearCart();
    closeCartSidebar();

    if (failCount === 0) {
        const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
        const successMessage = `تم شراء المنتج بنجاح!\n\nللحصول على معلومات المنتج الرجاء الضغط على منطقة العميل`;
        showStatus('نجاح', successMessage, 'success', null, orderNumber);
    } else {
        showStatus('تنبيه', `تم شراء ${successCount} منتج، فشل ${failCount} منتج`, 'error');
    }

    if (cartCheckoutBtn) {
        cartCheckoutBtn.disabled = false;
        cartCheckoutBtn.innerHTML = '<span>إتمام الشراء</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>';
    }

    // Refresh user data
    if (typeof updateUIForUser === 'function') {
        updateUIForUser();
    }
}

// Helper function for confirmation modal
function showConfirm(title, message, onConfirm) {
    const modal = document.getElementById('customConfirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('btnConfirmAction');
    const cancelBtn = document.getElementById('btnCancelAction');

    if (!modal) return;

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    modal.style.display = 'flex';
    modal.offsetHeight;
    modal.classList.add('active');

    const handleConfirm = () => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
        onConfirm();
        cleanup();
    };

    const handleCancel = () => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
        cleanup();
    };

    const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
}
