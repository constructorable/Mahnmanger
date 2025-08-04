/**
 * Delete.js - Input Clear Functionality
 * Nur für searchInput mit "Alle Mieter anzeigen" Funktion
 */

class InputDeleteManager {
    constructor() {
        this.targetInputId = 'searchInput';
        this.deleteButton = null;
        this.targetInput = null;
        this.init();
    }

    init() {
        console.log('🗑️ InputDeleteManager für searchInput initialisiert...');
        this.cleanupExistingButtons();
        this.createDeleteButton();
        this.bindEvents();
    }

    cleanupExistingButtons() {
        // Entferne alle existierenden Delete-Buttons
        const existingButtons = document.querySelectorAll('.delete-input-btn');
        existingButtons.forEach(btn => btn.remove());
        
        // Entferne has-delete-btn Klasse
        const inputs = document.querySelectorAll('.has-delete-btn');
        inputs.forEach(input => input.classList.remove('has-delete-btn'));
        
        console.log('🧹 Existierende Delete-Buttons entfernt');
    }

    createDeleteButton() {
        this.targetInput = document.getElementById(this.targetInputId);
        if (!this.targetInput) {
            console.log('❌ searchInput nicht gefunden');
            return;
        }

        // Prüfe ob bereits ein Container existiert
        let container = this.targetInput.parentElement;
        if (!container.classList.contains('input-container')) {
            // Erstelle Container
            container = document.createElement('div');
            container.className = 'input-container';
            
            // Input in Container wrappen
            this.targetInput.parentNode.insertBefore(container, this.targetInput);
            container.appendChild(this.targetInput);
        } else {
            // Container existiert bereits - entferne alte Buttons
            const oldButtons = container.querySelectorAll('.delete-input-btn');
            oldButtons.forEach(btn => btn.remove());
        }

        // Erstelle neuen Delete-Button
        this.deleteButton = document.createElement('button');
        this.deleteButton.type = 'button';
        this.deleteButton.className = 'delete-input-btn hidden';
        this.deleteButton.setAttribute('data-target', this.targetInputId);
        this.deleteButton.innerHTML = '<i class="fas fa-times"></i>';
        this.deleteButton.title = 'Suche löschen und alle Mieter anzeigen';

        // Button vor Input einfügen
        container.insertBefore(this.deleteButton, this.targetInput);

        // CSS-Klasse für Input hinzufügen
        this.targetInput.classList.add('has-delete-btn');

        console.log('✅ Delete-Button für searchInput erstellt');
    }

    bindEvents() {
        if (!this.targetInput || !this.deleteButton) return;

        // Click-Event für Delete-Button
        this.deleteButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.clearInputAndShowAllTenants();
        });

        // Input-Änderungen überwachen
        ['input', 'keyup', 'change'].forEach(eventType => {
            this.targetInput.addEventListener(eventType, () => {
                this.toggleDeleteButton();
            });
        });

        // Initial check
        this.toggleDeleteButton();

        console.log('✅ Delete-Button Events gebunden');
    }

    toggleDeleteButton() {
        if (!this.targetInput || !this.deleteButton) return;

        const hasValue = this.targetInput.value && this.targetInput.value.trim() !== '';

        if (hasValue) {
            this.deleteButton.classList.remove('hidden');
        } else {
            this.deleteButton.classList.add('hidden');
        }
    }

    clearInputAndShowAllTenants() {
        if (!this.targetInput || !this.deleteButton) return;

        // Input leeren
        this.targetInput.value = '';

        // Button verstecken
        this.deleteButton.classList.add('hidden');

        // Events auslösen für andere Listener
        this.triggerEvents();

        // ✅ NEU: Alle Mieter anzeigen über StatisticsManager
        this.showAllTenants();

        // Focus setzen
        this.targetInput.focus();

        console.log('🗑️ searchInput geleert und alle Mieter werden angezeigt');
    }

    showAllTenants() {
        // Option 1: Über StatisticsManager (falls verfügbar)
        if (window.app && window.app.statisticsManager && typeof window.app.statisticsManager.showAllTenants === 'function') {
            console.log('📊 Zeige alle Mieter über StatisticsManager...');
            window.app.statisticsManager.showAllTenants();
            return;
        }

        // Option 2: Über App renderCurrentView
        if (window.app && typeof window.app.renderCurrentView === 'function') {
            console.log('📊 Zeige alle Mieter über renderCurrentView...');
            // Suchterm zurücksetzen
            window.app.currentSearchTerm = '';
            window.app.renderCurrentView();
            return;
        }

        // Option 3: Über handleSearch mit leerem String
        if (window.app && typeof window.app.handleSearch === 'function') {
            console.log('📊 Zeige alle Mieter über handleSearch...');
            window.app.handleSearch('');
            return;
        }

        console.log('⚠️ Keine Methode zum Anzeigen aller Mieter gefunden');
    }

    triggerEvents() {
        const events = ['input', 'change', 'keyup'];
        
        events.forEach(eventType => {
            const event = new Event(eventType, { 
                bubbles: true, 
                cancelable: true 
            });
            this.targetInput.dispatchEvent(event);
        });
    }

    // Public Methods
    refresh() {
        console.log('🔄 InputDeleteManager Refresh...');
        this.cleanupExistingButtons();
        this.createDeleteButton();
        this.bindEvents();
    }

    destroy() {
        if (this.deleteButton) {
            this.deleteButton.remove();
        }
        if (this.targetInput) {
            this.targetInput.classList.remove('has-delete-btn');
        }
    }
}

// Global verfügbar machen
window.InputDeleteManager = InputDeleteManager;

// Auto-Initialize
function initInputDeleteManager() {
    // Zerstöre existierende Instanz
    if (window.inputDeleteManager) {
        window.inputDeleteManager.destroy();
    }
    
    window.inputDeleteManager = new InputDeleteManager();
    console.log('✅ InputDeleteManager für searchInput initialisiert');
}

// Initialize nach DOM-Load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInputDeleteManager);
} else {
    setTimeout(initInputDeleteManager, 100);
}

// Cleanup-Funktion für bestehende Duplikate
function cleanupDuplicateButtons() {
    console.log('🧹 Bereinige doppelte Delete-Buttons...');
    
    const allButtons = document.querySelectorAll('.delete-input-btn');
    console.log(`Gefunden: ${allButtons.length} Delete-Buttons`);
    
    allButtons.forEach(btn => btn.remove());
    
    const inputs = document.querySelectorAll('.has-delete-btn');
    inputs.forEach(input => input.classList.remove('has-delete-btn'));
    
    console.log('✅ Duplikate entfernt');
    
    setTimeout(() => {
        if (window.inputDeleteManager) {
            window.inputDeleteManager.refresh();
        } else {
            window.inputDeleteManager = new InputDeleteManager();
        }
    }, 100);
}

// Sofort ausführen
cleanupDuplicateButtons();