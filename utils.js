class Utils {
    static get MAHNSTUFEN_CONFIG() {
        return {
            1: { color: '#4CAF50', icon: 'fa-info-circle', short: 'Zahlungserinnerung', long: 'Zahlungserinnerung', days: 10 },
            2: { color: '#FF9800', icon: 'fa-exclamation-triangle', short: '1. Mahnung', long: '1. Mahnung', days: 7 },
            3: { color: '#F44336', icon: 'fa-ban', short: '2. Mahnung', long: '2. Mahnung', days: 5 }
        };
    }

    static get NOTIFICATION_COLORS() {
        return {
            error: '#dc3545', success: '#28a745', warning: '#ffc107',
            info: '#17a2b8', mahnstufe1: '#4CAF50', mahnstufe2: '#FF9800', mahnstufe3: '#F44336'
        };
    }

    static get VALIDATION_PATTERNS() {
        return {
            iban: /^[A-Z]{2}\d{20}$/,
            bic: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/
        };
    }

    static parseAmount(amountStr) {
        if (!amountStr || amountStr === '') return 0;
        const cleaned = String(amountStr).trim().replace(/[€\s]/g, '').replace(',', '.');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }

    static formatAmount(amount) {
        if (typeof amount !== 'number' || isNaN(amount)) return '0,00 €';
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
    }

    static formatDate(date = new Date()) {
        return date.toLocaleDateString('de-DE');
    }

    static formatDateLong(date = new Date()) {
        return date.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    }

    static getPaymentDeadline(days = 14) {
        const deadline = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        return this.formatDate(deadline);
    }

    static getPaymentDeadlineForMahnstufe(mahnstufe = 1) {
        const config = this.MAHNSTUFEN_CONFIG[mahnstufe];
        const days = config ? config.days : 14;
        return this.getPaymentDeadline(days);
    }

    static validateIBAN(iban) {
        if (!iban) return false;
        const cleanIBAN = iban.replace(/\s/g, '').toUpperCase();
        return this.VALIDATION_PATTERNS.iban.test(cleanIBAN);
    }

    static validateBIC(bic) {
        if (!bic) return false;
        const cleanBIC = bic.replace(/\s/g, '').toUpperCase();
        return this.VALIDATION_PATTERNS.bic.test(cleanBIC);
    }

    static isValidMahnstufe(stufe) {
        return Number.isInteger(stufe) && stufe >= 1 && stufe <= 3;
    }

    static getMahnstufenColor(mahnstufe) {
        return this.MAHNSTUFEN_CONFIG[mahnstufe]?.color || '#17a2b8';
    }

    static getMahnstufenIcon(mahnstufe) {
        return this.MAHNSTUFEN_CONFIG[mahnstufe]?.icon || 'fa-file-invoice';
    }

    static formatMahnstufenText(mahnstufe, shortForm = false) {
        const config = this.MAHNSTUFEN_CONFIG[mahnstufe];
        if (!config) return 'Unbekannt';
        return shortForm ? config.short : config.long;
    }

    static escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static detectMobile() {
        return window.innerWidth <= 768;
    }

    static showNotification(message, type = 'info', duration = 5000) {
        const container = this.getOrCreateNotificationContainer();
        const notification = this.createNotificationElement(message, type);
        container.appendChild(notification);
        this.animateNotification(notification, duration);
    }

    static showMahnstufenNotification(message, mahnstufe, duration = 3000) {
        this.showNotification(message, `mahnstufe${mahnstufe}`, duration);
    }

    static generateUniqueId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static cleanPortfolioName(portfolioName) {
        if (!portfolioName) return 'Unbekanntes Portfolio';
        return portfolioName.trim().replace(/[<>:"'/\\|?*]/g, '').substring(0, 50);
    }

    static formatPortfolioStats(stats) {
        if (!stats) return 'Keine Daten';
        return `${stats.totalTenants} Mieter (${stats.tenantsWithDebt} mit Schulden, ${this.formatAmount(stats.totalDebt)} Rückstand)`;
    }

    static readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
            reader.readAsText(file, 'UTF-8');
        });
    }

    static debugLog(message, data = null) {
        if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
            /* console.log(`[DEBUG] ${message}`, data || ''); */
        }
    }

    static startTimer(label) {
        console.time?.(label);
    }

    static endTimer(label) {
        console.timeEnd?.(label);
    }

    static getOrCreateNotificationContainer() {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000; pointer-events: none;';
            document.body.appendChild(container);
        }
        return container;
    }

    static createNotificationElement(message, type) {
        this.ensureNotificationStyles();
        const notification = document.createElement('div');
        const color = this.NOTIFICATION_COLORS[type] || this.NOTIFICATION_COLORS.info;
        
        notification.style.cssText = `
            background: ${color}; color: ${type === 'warning' ? '#000' : 'white'};
            padding: 12px 20px; border-radius: 4px; margin-bottom: 10px; max-width: 300px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); pointer-events: auto;
            animation: slideIn 0.3s ease-out; font-weight: 500;
        `;
        notification.textContent = message;
        return notification;
    }

    static ensureNotificationStyles() {
        if (document.getElementById('notification-styles')) return;
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        `;
        document.head.appendChild(style);
    }

    static animateNotification(notification, duration) {
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.parentNode?.removeChild(notification), 300);
        }, duration);
    }
}

// Debug-Funktionen - können in utils.js oder separat hinzugefügt werden
window.debugSearch = {
    // Test verschiedene Suchbegriffe
    testSearch: function(searchTerm = 'Schneid Amal') {
        /* console.log(`\n=== TEST SUCHE: "${searchTerm}" ===`); */
        
        if (window.app && window.app.handleSearch) {
            const results = window.app.handleSearch(searchTerm);
            
            setTimeout(() => {
                const visibleCards = document.querySelectorAll('.tenant-card:not([style*="display: none"])').length;
                /* console.log(`Sichtbare Mieter-Karten: ${visibleCards}`); */
                
                if (results && results.length > 0) {
                    /* console.log('Erste 5 Treffer:'); */
                    results.slice(0, 5).forEach((tenant, index) => {
                      /*   console.log(`${index + 1}. ${tenant.name} (${tenant.street}) - ${tenant.portfolio}`); */
                    });
                }
            }, 500);
            
            return results;
        } else {
         /*    console.error('App oder handleSearch nicht verfügbar'); */
        }
    },
    
    // Analysiere Suchfeld-Status
    analyzeSearchField: function() {
        const searchInput = document.getElementById('searchInput');
       /*  console.log('Suchfeld-Status:', {
            element: searchInput,
            value: searchInput?.value,
            placeholder: searchInput?.placeholder,
            disabled: searchInput?.disabled
        }); */
    },
    
    // Setze Suchfeld und trigger Suche
    setSearch: function(searchTerm) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = searchTerm;
            const event = new Event('input', { bubbles: true });
            searchInput.dispatchEvent(event);
        }
    }
};



/* console.log('Debug-Funktionen verfügbar:');
console.log('- debugSearch.testSearch("Suchbegriff")');
console.log('- debugSearch.analyzeSearchField()');
console.log('- debugSearch.setSearch("Suchbegriff")'); */

window.Utils = Utils;