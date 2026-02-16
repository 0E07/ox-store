// Discord OAuth2 Configuration
// يجب عليك إنشاء تطبيق Discord من Developer Portal أولاً
// https://discord.com/developers/applications

const DISCORD_CONFIG = {
    // Discord Application Client ID
    CLIENT_ID: '1428812702574317738',

    // رابط إعادة التوجيه بعد تسجيل الدخول
    // يجب أن يكون مطابقاً للرابط المسجل في Discord Developer Portal
    REDIRECT_URI: window.location.origin + '/auth-callback.html',

    // الصلاحيات المطلوبة
    SCOPES: ['identify', 'email'],

    // رابط Discord OAuth2
    OAUTH_URL: 'https://discord.com/api/oauth2/authorize'
};

// دالة لتوليد رابط تسجيل الدخول
function getDiscordAuthUrl() {
    const params = new URLSearchParams({
        client_id: DISCORD_CONFIG.CLIENT_ID,
        redirect_uri: DISCORD_CONFIG.REDIRECT_URI,
        response_type: 'token',
        scope: DISCORD_CONFIG.SCOPES.join(' ')
    });

    return `${DISCORD_CONFIG.OAUTH_URL}?${params.toString()}`;
}

// دالة لتسجيل الدخول
window.loginWithDiscord = function () {
    // التحقق من إعداد Client ID
    if (DISCORD_CONFIG.CLIENT_ID === 'YOUR_DISCORD_CLIENT_ID') {
        showStatus('⚠️ تنبيه', 'يرجى إعداد Discord Client ID أولاً!', 'error');
        return;
    }

    // فتح صفحة تسجيل الدخول
    window.location.href = getDiscordAuthUrl();
};

// دالة للحصول على معلومات المستخدم من Access Token
async function getUserInfo(accessToken) {
    try {
        const response = await fetch('https://discord.com/api/users/@me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error('فشل في الحصول على معلومات المستخدم');
        }

        return await response.json();
    } catch (error) {
        console.error('خطأ في الحصول على معلومات المستخدم:', error);
        return null;
    }
}

// دالة لحفظ بيانات المستخدم
async function saveUserData(userData, accessToken) {
    const userInfo = {
        id: userData.id,
        username: userData.username,
        discriminator: userData.discriminator,
        avatar: userData.avatar,
        email: userData.email,
        accessToken: accessToken,
        loginTime: new Date().toISOString()
    };

    localStorage.setItem('discord_user', JSON.stringify(userInfo));

    // Send to Backend
    try {
        const response = await fetch(`${window.location.origin}/api/auth/discord`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userInfo)
        });

        if (!response.ok) {
            console.error('Failed to sync user with backend');
        } else {
            const data = await response.json();
            console.log('Backend sync success:', data);
            // Update local storage with any new data from backend if needed
            if (data.user) {
                if (data.user.balance !== undefined) userInfo.balance = data.user.balance;
                userInfo.isAdmin = data.isAdmin || false;
                userInfo.permissions = data.permissions || null;
                localStorage.setItem('discord_user', JSON.stringify(userInfo));
            }
        }
    } catch (error) {
        console.error('Backend connection error:', error);
    }

    return userInfo;
}

// دالة للحصول على بيانات المستخدم المحفوظة
function getStoredUser() {
    const stored = localStorage.getItem('discord_user');
    return stored ? JSON.parse(stored) : null;
}

// دالة لتسجيل الخروج
window.logout = function () {
    localStorage.removeItem('discord_user');
    window.location.reload();
};

// دالة للحصول على رابط صورة المستخدم
function getUserAvatarUrl(user) {
    if (user.avatar) {
        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
    }
    return `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator) % 5}.png`;
}

// تحديث واجهة المستخدم بناءً على حالة تسجيل الدخول
function updateUIForUser() {
    const user = getStoredUser();
    const navButtons = document.querySelector('.nav-buttons');
    const ALLOWED_ADMIN_ID = '1259905369182830715'; // ID الخاص بك

    if (!navButtons) return;

    // Show Inbox Button if user is logged in
    const inboxBtn = document.getElementById('inboxBtn');
    if (inboxBtn) {
        inboxBtn.style.display = user ? 'flex' : 'none';
        if (user && typeof fetchNotifications === 'function') {
            fetchNotifications();
        }
    }

    if (user) {
        // التحقق مما إذا كان المستخدم لديه صلاحية رؤية زر لوحة التحكم
        let adminOption = '';
        const hasDashboardPerm = user.permissions && user.permissions.can_view_dashboard === 1;

        if (user.id === ALLOWED_ADMIN_ID || hasDashboardPerm) {
            adminOption = `
                <button class="dropdown-item" onclick="window.location.href='admin.html'">
                    <span>لوحة التحكم</span>
                    <span style="font-size: 16px;">⚙️</span>
                </button>
                <div class="dropdown-divider"></div>
            `;
        }

        // المستخدم مسجل دخول - إظهار البروفايل مع القائمة المنسدلة
        navButtons.innerHTML = `
            <div class="user-profile-wrapper" id="userProfileWrapper">
                <div class="user-info-trigger" id="userDropdownTrigger">
                    <span class="user-name">${user.username}</span>
                    <img src="${getUserAvatarUrl(user)}" alt="Avatar" class="user-avatar">
                </div>
                
                <div class="user-dropdown" id="userDropdown">
                    <div style="padding: 10px 15px; border-bottom: 1px solid var(--border-color); margin-bottom: 5px;">
                        <div style="font-size: 12px; color: var(--text-muted);">تم تسجيل الدخول كـ</div>
                        <div style="font-size: 14px; font-weight: bold; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.username}</div>
                    </div>
                    
                    ${adminOption}
                    
                    <button class="dropdown-item" id="openDashboardBtn">
                        <span>منطقة العميل</span>
                        <span style="font-size: 16px;">👤</span>
                    </button>
                    
                    <div class="dropdown-divider"></div>
                    
                    <button class="dropdown-item logout-item" onclick="logout()">
                        <span>تسجيل الخروج</span>
                        <span style="font-size: 16px;">🚪</span>
                    </button>
                </div>
            </div>
        `;

        const trigger = document.getElementById('userDropdownTrigger');
        const dropdown = document.getElementById('userDropdown');
        const dashboardBtn = document.getElementById('openDashboardBtn');

        if (trigger && dropdown) {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropdown.classList.toggle('active');
            });
        }

        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open('dashboard.html', '_blank');
                if (dropdown) dropdown.classList.remove('active');
            });
        }
    } else {
        navButtons.innerHTML = `
            <button class="btn-secondary" onclick="loginWithDiscord()">تسجيل الدخول</button>
        `;
    }
}

// Global click listener to close user dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('userDropdown');
    const trigger = document.getElementById('userDropdownTrigger');
    if (dropdown && dropdown.classList.contains('active')) {
        if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    }
});

// تشغيل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
    updateUIForUser();

    // تحديث بيانات المستخدم في الخلفية (الرصيد، الصلاحيات، إلخ)
    const user = getStoredUser();
    if (user && user.id) {
        // Show inbox immediately
        const inboxBtn = document.getElementById('inboxBtn');
        if (inboxBtn) inboxBtn.style.display = 'flex';

        // نقوم بمزامنة البيانات مع السيرفر لتحديث الصلاحيات فوراً
        await saveUserData(user, user.accessToken);
        updateUIForUser(); // إعادة تحديث الواجهة بعد المزامنة
    }
});

console.log('Discord OAuth2 - تم تحميل نظام المصادقة ✅');
