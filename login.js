class UserConfig {
    static get STORAGE_KEY() { return 'mahnmanager_userdata'; }
    static get VERSION() { return '2.1'; }
    
    static get VALIDATION_RULES() {
        return {
            name: { minLength: 2, maxLength: 100 },
            email: { 
                regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 
                maxLength: 100 
            },
            phone: { 
                regex: /^[\+]?[\d\s\-\(\)\/]{7,30}$/, 
                minLength: 7, 
                maxLength: 30 
            }
        };
    }

    static get DEFAULT_USER_DATA() {
        return {
            name: '',
            email: '',
            phone: '',
            created: new Date().toISOString()
        };
    }

    static get FIELD_MAPPING() {
        return {
            userName: 'name',
            userEmail: 'email',
            userPhone: 'phone'
        };
    }
}

class UserUtils {
    static isValidEmail(email) {
        if (!email) return false;
        const rules = UserConfig.VALIDATION_RULES.email;
        return rules.regex.test(email) && email.length <= rules.maxLength;
    }

    static isValidPhone(phone) {
        if (!phone) return false;
        const rules = UserConfig.VALIDATION_RULES.phone;
        return rules.regex.test(phone) && phone.length >= rules.minLength && phone.length <= rules.maxLength;
    }

    static isValidName(name) {
        if (!name) return false;
        const rules = UserConfig.VALIDATION_RULES.name;
        return name.length >= rules.minLength && name.length <= rules.maxLength;
    }

    static createSafeStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('LocalStorage Fehler:', error);
            throw new Error('Daten konnten nicht gespeichert werden');
        }
    }

    static loadSafeStorage(key, defaultValue = null) {
        try {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : defaultValue;
        } catch (error) {
            console.error('Fehler beim Laden der Daten:', error);
            return defaultValue;
        }
    }

    static createIcon(iconClass) {
        return `<i class="fas fa-${iconClass}"></i>`;
    }
}

class UserManager {
    constructor() {
        this.userData = UserUtils.loadSafeStorage(UserConfig.STORAGE_KEY, UserConfig.DEFAULT_USER_DATA);
        this.modal = null;
        this.isInitialized = false;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        if (this.isInitialized) return;

        this.createUserButton();
        this.createUserModal();
        this.setupEventListeners();
        this.updatePDFContactInfo();
        this.isInitialized = true;

       /*  console.log('UserManager erfolgreich initialisiert'); */
    }

    createUserButton() {
        const header = document.querySelector('header h1');
        if (!header) return;

        const userButton = document.createElement('button');
        userButton.id = 'userProfileButton';
        userButton.className = 'btn btn-secondary user-profile-btn';
        userButton.innerHTML = `
            ${UserUtils.createIcon('user-cog')}
            <span class="user-name">${this.getUserDisplayName()}</span>
        `;
        userButton.title = 'Profil bearbeiten';

        header.appendChild(userButton);
        this.addUserButtonStyles();
    }

    createUserModal() {
        const modal = document.createElement('div');
        modal.id = 'userModal';
        modal.className = 'user-modal';
        modal.innerHTML = this.createModalHTML();

        document.body.appendChild(modal);
        this.modal = modal;
    }

    createModalHTML() {
        return `
        <div class="user-modal-content">
            <div class="user-modal-header">
                <h3>${UserUtils.createIcon('user-edit')} Benutzer-Profil</h3>
                <button class="user-modal-close" type="button">
                    ${UserUtils.createIcon('times')}
                </button>
            </div>
            <div class="user-modal-body">
                <div class="user-current-info">
                    <h4>${UserUtils.createIcon('info-circle')} Aktuelle Einstellungen</h4>
                    <p><strong>Name:</strong> <span id="currentName">${this.userData.name || 'Nicht gesetzt'}</span></p>
                    <p><strong>E-Mail:</strong> <span id="currentEmail">${this.userData.email || 'Nicht gesetzt'}</span></p>
                    <p><strong>Telefon:</strong> <span id="currentPhone">${this.userData.phone || 'Nicht gesetzt'}</span></p>
                </div>
                <form id="userForm">
                    ${this.createFormFields()}
                </form>
            </div>
            <div class="user-modal-footer">
                <button type="button" class="user-btn user-btn-secondary" id="userCancelBtn">
                    ${UserUtils.createIcon('times')} Abbrechen
                </button>
                <button type="button" class="user-btn user-btn-primary" id="userSaveBtn">
                    ${UserUtils.createIcon('save')} Speichern
                </button>
            </div>
        </div>`;
    }

    createFormFields() {
        const fields = [
            { id: 'userName', name: 'name', icon: 'user', label: 'Name / Firma', placeholder: 'Ihr Name oder Firmenname', type: 'text' },
            { id: 'userEmail', name: 'email', icon: 'envelope', label: 'E-Mail-Adresse', placeholder: 'ihre.email@beispiel.de', type: 'email' },
            { id: 'userPhone', name: 'phone', icon: 'phone', label: 'Telefonnummer', placeholder: '+49 123 456789', type: 'tel' }
        ];

        return fields.map(field => `
            <div class="user-form-group">
                <label for="${field.id}">
                    ${UserUtils.createIcon(field.icon)} ${field.label}
                </label>
                <input 
                    type="${field.type}" 
                    id="${field.id}" 
                    name="${field.name}" 
                    placeholder="${field.placeholder}"
                    value="${this.userData[field.name] || ''}"
                    maxlength="${field.name === 'phone' ? '30' : '100'}"
                >
                <div class="user-error-message">Bitte geben Sie ${field.label.toLowerCase()} ein</div>
            </div>
        `).join('');
    }

    setupEventListeners() {
        const profileBtn = document.getElementById('userProfileButton');
        if (profileBtn) {
            profileBtn.addEventListener('click', () => this.showUserModal());
        }

        if (!this.modal) return;

        this.setupModalEvents();
        this.setupFormValidation();
        this.setupKeyboardEvents();
    }

    setupModalEvents() {
        const closeBtn = this.modal.querySelector('.user-modal-close');
        const cancelBtn = this.modal.querySelector('#userCancelBtn');
        const saveBtn = this.modal.querySelector('#userSaveBtn');

        [closeBtn, cancelBtn].forEach(btn => {
            if (btn) btn.addEventListener('click', () => this.hideUserModal());
        });

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hideUserModal();
        });

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveUserData());
        }

        const form = this.modal.querySelector('#userForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveUserData();
            });
        }
    }

    setupFormValidation() {
        Object.keys(UserConfig.FIELD_MAPPING).forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (input) {
                input.addEventListener('input', () => this.validateField(fieldId));
                input.addEventListener('blur', () => this.validateField(fieldId));
            }
        });
    }

    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.style.display === 'block') {
                this.hideUserModal();
            }
        });
    }

    showUserModal() {
        if (!this.modal) return;

        this.loadDataIntoForm();
        this.updateCurrentInfo();
        this.clearValidationErrors();

        this.modal.style.display = 'block';
        document.body.style.overflow = 'hidden';

        setTimeout(() => {
            const firstInput = this.modal.querySelector('#userName');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    hideUserModal() {
        if (!this.modal) return;

        this.modal.style.display = 'none';
        document.body.style.overflow = '';
        this.clearValidationErrors();
    }

    updateCurrentInfo() {
        const updates = {
            'currentName': this.userData.name || 'Nicht gesetzt',
            'currentEmail': this.userData.email || 'Nicht gesetzt',
            'currentPhone': this.userData.phone || 'Nicht gesetzt'
        };

        Object.entries(updates).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    loadDataIntoForm() {
        Object.entries(UserConfig.FIELD_MAPPING).forEach(([fieldId, dataKey]) => {
            const input = document.getElementById(fieldId);
            if (input && this.userData[dataKey]) {
                input.value = this.userData[dataKey];
            }
        });
    }

    validateField(fieldId) {
        const input = document.getElementById(fieldId);
        const formGroup = input?.closest('.user-form-group');
        if (!input || !formGroup) return false;

        const value = input.value.trim();
        const validationMap = {
            userName: () => UserUtils.isValidName(value),
            userEmail: () => UserUtils.isValidEmail(value),
            userPhone: () => UserUtils.isValidPhone(value)
        };

        const isValid = validationMap[fieldId] ? validationMap[fieldId]() : true;
        formGroup.classList.toggle('error', !isValid);
        return isValid;
    }

    validateAllFields() {
        return Object.keys(UserConfig.FIELD_MAPPING).every(fieldId => this.validateField(fieldId));
    }

    clearValidationErrors() {
        const errorGroups = this.modal?.querySelectorAll('.user-form-group.error');
        errorGroups?.forEach(group => group.classList.remove('error'));
    }

    saveUserData() {
        if (!this.validateAllFields()) {
            return;
        }

        const formData = this.getFormData();
        const hasChanges = this.hasDataChanged(formData);

        if (!hasChanges) {
            this.hideUserModal();
            return;
        }

        try {
            this.userData = { ...formData, lastUpdated: new Date().toISOString() };
            UserUtils.createSafeStorage(UserConfig.STORAGE_KEY, this.userData);

            this.updateUserButton();
            this.updatePDFContactInfo();
            this.hideUserModal();

            console.log('Benutzerdaten gespeichert');
        } catch (error) {
            console.error('Fehler beim Speichern:', error);
        }
    }

    getFormData() {
        return Object.entries(UserConfig.FIELD_MAPPING).reduce((data, [fieldId, dataKey]) => {
            const input = document.getElementById(fieldId);
            data[dataKey] = input?.value.trim() || '';
            return data;
        }, {});
    }

    hasDataChanged(newData) {
        return Object.keys(newData).some(key => this.userData[key] !== newData[key]);
    }

    updateUserButton() {
        const button = document.getElementById('userProfileButton');
        const nameSpan = button?.querySelector('.user-name');

        if (nameSpan) {
            nameSpan.textContent = this.getUserDisplayName();
        }
    }

    getUserDisplayName() {
        return this.userData.name || 'Profil bearbeiten';
    }

    updatePDFContactInfo() {
        try {
            if (window.app?.pdfGenerator && this.hasValidUserData()) {
                this.updatePDFFooterConfig(window.app.pdfGenerator);
            }
            window.currentUserData = this.userData;
        } catch (error) {
            console.error('Fehler bei PDF-Integration:', error);
        }
    }

    updatePDFFooterConfig(pdfGenerator) {
        const { name, email, phone } = this.userData;

        if (name && email && phone) {
            pdfGenerator.footerConfig.lines[0] = `${name} | E-Mail: ${email} | Tel: ${phone}`;
            console.log('PDF-Footer mit Benutzerdaten aktualisiert');
        }
    }

    hasValidUserData() {
        return this.userData.name && this.userData.email && this.userData.phone;
    }

    getUserData() {
        return { ...this.userData };
    }

    updateUserData(data) {
        this.userData = { ...this.userData, ...data, lastUpdated: new Date().toISOString() };
        UserUtils.createSafeStorage(UserConfig.STORAGE_KEY, this.userData);
        this.updateUserButton();
        this.updatePDFContactInfo();
    }

    clearUserData() {
        if (confirm('Möchten Sie alle Benutzerdaten wirklich löschen?')) {
            this.userData = UserConfig.DEFAULT_USER_DATA;
            UserUtils.createSafeStorage(UserConfig.STORAGE_KEY, this.userData);
            this.updateUserButton();
            this.updatePDFContactInfo();
        }
    }

    exportUserData() {
        const data = JSON.stringify(this.userData, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `mahnmanager_profil_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    addUserButtonStyles() {
        if (document.getElementById('user-manager-styles')) return;

        const style = document.createElement('style');
        style.id = 'user-manager-styles';
        style.textContent = `
        .user-profile-btn {
            margin-left: auto; display: flex; align-items: center; gap: 8px;
            font-size: 14px; padding: 8px 16px; border-radius: 6px;
            border: 1px solid #ddd; background: #f8f9fa; color: #495057;
            transition: all 0.3s ease; cursor: pointer;
        }
        `;
        document.head.appendChild(style);
    }
}

window.UserManager = UserManager;

let userManager;
if (document.readyState !== 'loading') {
    userManager = new UserManager();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        userManager = new UserManager();
    });
}

window.getCurrentUser = () => userManager?.getUserData() || {};

/* console.log(`UserManager v${UserConfig.VERSION} geladen`); */