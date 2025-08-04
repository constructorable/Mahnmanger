class AppConfig {
    static get VERSION() { return '3.2'; }
    static get PROCESSING_DELAY() { return 200; }
    static get LIBRARY_TIMEOUT() { return 10000; }
    static get SUMMARY_UPDATE_DELAY() { return 100; }
}

class AppUtils {
    static setElementText(id, text) {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    }

    static setElementStyle(id, property, value) {
        const element = document.getElementById(id);
        if (element) element.style[property] = value;
    }

    static showElement(id) {
        const element = document.getElementById(id);
        if (element) element.style.display = 'block';
    }

    static hideElement(id) {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    }

    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file, 'utf-8');
        });
    }

    static waitForLibraries() {
        return new Promise((resolve, reject) => {
            const check = () => window.jspdf ? resolve() : setTimeout(check, 100);
            setTimeout(() => reject(new Error('Bibliotheken nicht verfügbar')), AppConfig.LIBRARY_TIMEOUT);
            check();
        });
    }

    static showStatisticsSection() {
        const section = document.getElementById('statisticsSection');
        if (section) {
            section.style.display = 'block';
            section.classList.add('fade-in');
        }
    }

    static hideStatisticsSection() {
        const section = document.getElementById('statisticsSection');
        if (section) {
            section.style.display = 'none';
            section.classList.remove('fade-in');
        }
    }

    static isStatisticsSectionVisible() {
        const section = document.getElementById('statisticsSection');
        return section && section.style.display !== 'none';
    }

    static setStatisticValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;

            element.classList.add('stat-updated');
            setTimeout(() => element.classList.remove('stat-updated'), 300);
        }
    }

    static formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount || 0);
    }

    static formatNumber(number) {
        return new Intl.NumberFormat('de-DE').format(number || 0);
    }

    static createElement(tag, className = '', innerHTML = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (innerHTML) element.innerHTML = innerHTML;
        return element;
    }

    static addStatUpdateAnimation(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.transition = 'all 0.3s ease';
            element.style.transform = 'scale(1.05)';
            setTimeout(() => {
                element.style.transform = 'scale(1)';
            }, 150);
        }
    }

    static dispatchCustomEvent(eventName, detail = {}) {
        document.dispatchEvent(new CustomEvent(eventName, { detail }));
    }

/*     static logStatistics(statistics) {
        if (console && console.group) {
            console.group('📊 Statistiken Update');
            console.log('Offene Posten:', statistics?.totalOpenPositions || 0);
            console.log('Gesamtschulden:', AppUtils.formatCurrency(statistics?.totalDebtAmount || 0));
            console.log('Mieter mit Schulden:', statistics?.openTenantsCount || 0);
            console.log('Portfolios:', statistics?.portfolioStats?.length || 0);
            console.groupEnd();
        }
    }
 */
    static startPerformanceTimer(name) {
        if (performance && performance.mark) {
            performance.mark(`${name}-start`);
        }
        return Date.now();
    }

    static endPerformanceTimer(name, startTime) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        if (performance && performance.mark && performance.measure) {
            performance.mark(`${name}-end`);
            performance.measure(name, `${name}-start`, `${name}-end`);
        }

        /* console.log(`⏱️ ${name}: ${duration}ms`); */
        return duration;
    }

    static isMobileView() {
        return window.innerWidth <= 768;
    }

    static isTabletView() {
        return window.innerWidth > 768 && window.innerWidth <= 1024;
    }

    static getViewportSize() {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            isMobile: AppUtils.isMobileView(),
            isTablet: AppUtils.isTabletView(),
            isDesktop: window.innerWidth > 1024
        };
    }

    static setTooltip(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.title = text;
            element.setAttribute('data-tooltip', text);
        }
    }

    static setAriaLabel(elementId, label) {
        const element = document.getElementById(elementId);
        if (element) {
            element.setAttribute('aria-label', label);
        }
    }

    static updateMultipleStatistics(updates) {
        Object.entries(updates).forEach(([elementId, value]) => {
            AppUtils.setStatisticValue(elementId, value);
        });
    }
}

class MietmahnungApp {
    constructor() {
        this.csvData = [];
        this.tenantManager = new TenantManager();
        this.uiRenderer = new UIRenderer(this.tenantManager);
        this.pdfGenerator = new PDFGenerator(this.tenantManager);
        this.eventHandlers = new EventHandlers(this);
        this.filteredTenants = new Map();
        this.currentSearchTerm = '';
        this.isProcessing = false;
        this.dataLoaded = false;
        this.singleInvoiceCount = 0;
        this.mahnstufen = typeof mahnstufen !== 'undefined' ? mahnstufen : null;
        this.textManager = typeof textManager !== 'undefined' ? textManager : new TextManager();
        this.init();
        this.statisticsManager = new StatisticsManager(this);
    }

    getTenantsWithAnwaltCount() {
    const allTenants = this.tenantManager.getAllTenants();
    return allTenants.filter(tenant => tenant.hasAnwalt || tenant.anwaltName).length;
}

    async init() {
        try {
            await AppUtils.waitForLibraries();
            this.eventHandlers.setupEventListeners();

            setTimeout(() => {
                this.eventHandlers.setupSearchEvents();
            }, 1000);

            this.uiRenderer.setupTextEditingEvents();

            if (this.statisticsManager && !this.statisticsManager.isInitialized) {
                this.statisticsManager.init();
            }

            /* console.log('Mietmahnung Generator erfolgreich initialisiert'); */
        } catch (error) {
            console.error('Initialisierung fehlgeschlagen:', error);
            Utils.showNotification('Fehler beim Laden der Anwendung. Bitte Seite neu laden.', 'error');
        }

        setTimeout(() => {
            this.repairAnwaltData();
           /*  console.log('Anwalt-Daten automatisch repariert'); */

            if (this.statisticsManager && this.isDataLoaded()) {
                this.statisticsManager.updateStatisticsDelayed(1000);
            }
        }, 2000);
    }

    forceSetupSearchEventsDelayed() {
       /*  console.log('🔧 Force Setup Search Events (Delayed)'); */

        const setupSearch = () => {
            const searchInput = document.getElementById('searchInput');

            if (!searchInput) {
                /* console.log('⏳ Suchfeld noch nicht gefunden, warte...'); */
                setTimeout(setupSearch, 500);
                return;
            }

          /*   console.log('✅ Suchfeld gefunden, richte Events ein...'); */

            const newInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newInput, searchInput);

            newInput.addEventListener('input', function (e) {
                const searchTerm = e.target.value;
                /* console.log('🔍 GLOBAL INPUT:', searchTerm); */

                if (window.app && window.app.handleSearch) {
                    window.app.handleSearch(searchTerm);
                }
            });

            newInput.addEventListener('keyup', function (e) {
                const searchTerm = e.target.value;
               /*  console.log('🔍 GLOBAL KEYUP:', searchTerm); */

                if (window.app && window.app.handleSearch) {
                    window.app.handleSearch(searchTerm);
                }
            });

            newInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const searchTerm = e.target.value;
                 /*    console.log('🔍 GLOBAL ENTER:', searchTerm); */

                    if (window.app && window.app.handleSearch) {
                        window.app.handleSearch(searchTerm);
                    }
                }
            });

            newInput.value = 'test';
            newInput.dispatchEvent(new Event('input'));
            setTimeout(() => {
                newInput.value = '';
                newInput.dispatchEvent(new Event('input'));
            }, 100);

           /*  console.log('✅ Search Events GLOBAL eingerichtet und getestet'); */
        };

        setupSearch();
    }

    setupTextEditingEvents() {
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('text-edit-textarea')) {
                const tenantId = e.target.dataset.tenantId;
                const mahnstufe = parseInt(e.target.dataset.mahnstufe);
                const textType = e.target.dataset.textType;
                const content = e.target.value;

                this.updateCharCounter(tenantId, textType, content);
                this.textManager.setCustomText(mahnstufe, textType, content, tenantId);
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('standard-saetze-select')) {
                const satzKey = e.target.value;
                const textFieldId = e.target.dataset.textField;
                const tenantId = e.target.dataset.tenantId;

                /* console.log('Dropdown geändert:', { satzKey, textFieldId, tenantId }); */

                if (satzKey && textFieldId) {
                    this.addStandardSatzToTextarea(textFieldId, satzKey, tenantId);
                    e.target.value = '';
                }
            }

            if (e.target.name && e.target.name.startsWith('mahnstufe_')) {
                const tenantId = e.target.name.replace('mahnstufe_', '');
                setTimeout(() => {
                    this.refreshTextEditingSection(tenantId);
                }, 150);
            }
        });
    }

    addStandardSatzToTextarea(textFieldId, satzKey, tenantId) {
      /*   console.log('=== STANDARDSATZ HINZUFÜGEN ===');
        console.log('TextFieldId:', textFieldId);
        console.log('SatzKey:', satzKey);
        console.log('TenantId:', tenantId); */

        const textarea = document.getElementById(textFieldId);
        if (!textarea) {
            /* console.error('Textarea nicht gefunden:', textFieldId); */
            return;
        }

        const currentText = textarea.value;
        /* console.log('Aktueller Text:', currentText); */

        const standardSaetze = this.textManager.getStandardSaetze();
        const satz = standardSaetze[satzKey];
        /* console.log('Standardsatz:', satz); */

        if (!satz) {
            /* console.error('Standardsatz nicht gefunden für Key:', satzKey); */
            return;
        }

        const newText = this.textManager.addStandardSatzToText(currentText, satzKey);
        /* console.log('Neuer Text:', newText); */

        textarea.value = newText;

        const inputEvent = new Event('input', { bubbles: true });
        textarea.dispatchEvent(inputEvent);

     /*    console.log('Text in Textarea gesetzt und Event getriggert'); */

        setTimeout(() => {
            const mahnstufe = parseInt(textarea.dataset.mahnstufe);
            const savedTexts = this.textManager.getTextForMahnstufe(mahnstufe, tenantId);
            /* console.log('Gespeicherte Texte nach Update:', savedTexts); */
        }, 100);

    }

    toggleTextEditingSection(tenantId) {
        const section = document.getElementById(`textEditing-${tenantId}`);
        if (!section) return;

        const content = section.querySelector('.text-editing-content');
        const toggleIcon = section.querySelector('.text-editing-toggle-icon i');
        const isCollapsed = section.classList.contains('collapsed');

        if (isCollapsed) {
            section.classList.remove('collapsed');
            section.classList.add('expanded');
            content.style.display = 'block';
            toggleIcon.className = 'fas fa-chevron-down';

            setTimeout(() => {
                content.style.opacity = '1';
                content.style.transform = 'translateY(0)';
            }, 10);
        } else {
            section.classList.remove('expanded');
            section.classList.add('collapsed');
            content.style.opacity = '0';
            content.style.transform = 'translateY(-10px)';
            toggleIcon.className = 'fas fa-chevron-right';

            setTimeout(() => {
                content.style.display = 'none';
            }, 200);
        }
    }

    setupTextEditingEvents() {
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('text-edit-textarea')) {
                const tenantId = e.target.dataset.tenantId;
                const mahnstufe = parseInt(e.target.dataset.mahnstufe);
                const textType = e.target.dataset.textType;
                const content = e.target.value;

                this.updateCharCounter(tenantId, textType, content);
                this.textManager.setCustomText(mahnstufe, textType, content, tenantId);
            }
        });
    }

    resetTextsToDefault(tenantId, mahnstufe) {
        if (confirm('Möchten Sie alle Texte für diese Mahnstufe auf die Standardwerte zurücksetzen?')) {
            this.textManager.resetToDefault(mahnstufe, tenantId);
            this.refreshTextEditingSection(tenantId);
            Utils.showNotification('Texte auf Standard zurückgesetzt', 'success');
        }
    }

    previewMahntext(tenantId, mahnstufe) {
    /*     console.log('=== VORSCHAU GENERIERUNG ===');
        console.log('TenantId:', tenantId);
        console.log('Mahnstufe:', mahnstufe); */

        const tenant = this.tenantManager.getTenant(tenantId);
        if (!tenant) {
      /*       console.error('Tenant nicht gefunden'); */
            return;
        }

        const texts = this.textManager.getTextForMahnstufe(mahnstufe, tenantId);
       /*  console.log('Geladene Texte für Vorschau:', texts); */

        const totalDifference = this.tenantManager.calculateTenantTotal(tenant);
        const schuldenBetrag = Math.abs(totalDifference);
        const csvMahngebuehr = this.tenantManager.getCSVMahngebuehr(tenantId);
        const gesamtbetrag = schuldenBetrag + (mahnstufe > 1 ? csvMahngebuehr : 0);
        const zahlungsfrist = Utils.getPaymentDeadlineForMahnstufe(mahnstufe);

        const variables = {
            SCHULDEN_BETRAG: Utils.formatAmount(schuldenBetrag),
            GESAMT_BETRAG: Utils.formatAmount(gesamtbetrag),
            ZAHLUNGSFRIST: zahlungsfrist,
            MIETER_NAME: tenant.name
        };

       /*  console.log('Variablen:', variables); */

        const preview = Object.keys(texts).map(key => {
            const processedText = this.textManager.replaceVariables(texts[key], variables);
       /*      console.log(`${key} - Original:`, texts[key]);
            console.log(`${key} - Verarbeitet:`, processedText); */

            return `<div class="preview-section">
            <strong>${key.charAt(0).toUpperCase() + key.slice(1)}:</strong><br>
            ${processedText.replace(/\n/g, '<br>')}
        </div>`;
        }).join('');

        const modal = document.createElement('div');
        modal.className = 'text-preview-modal';
        modal.innerHTML = `
        <div class="text-preview-content">
            <div class="text-preview-header">
                <h3>Textvorschau - ${tenant.name}</h3>
                <button class="text-preview-close" onclick="this.closest('.text-preview-modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="text-preview-body">
                ${preview}
            </div>
        </div>
    `;
        document.body.appendChild(modal);

   /*      console.log('=== VORSCHAU ENDE ==='); */
    }

    refreshTextEditingSection(tenantId) {
        if (this.uiRenderer && this.uiRenderer.refreshTextEditingSection) {
            this.uiRenderer.refreshTextEditingSection(tenantId);
        }
    }

    updateCharCounter(tenantId, textType, content) {
        const counter = document.getElementById(`counter-${tenantId}-${textType}`);
        if (counter) {
            const maxLength = 1000;
            const currentLength = content.length;
            counter.textContent = `${currentLength}/${maxLength}`;

            if (currentLength > maxLength * 0.9) {
                counter.style.color = '#e74c3c';
            } else if (currentLength > maxLength * 0.8) {
                counter.style.color = '#f39c12';
            } else {
                counter.style.color = '#6c757d';
            }
        }
    }

async processFile(file) {
    if (!file) {
        Utils.showNotification('Keine Datei ausgewählt', 'error');
        return;
    }
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
        Utils.showNotification('Bitte wählen Sie eine CSV-Datei aus', 'error');
        return;
    }

    this.isProcessing = true;
    
    try {
        // Loading-Screen anzeigen falls nicht bereits von EventHandlers gezeigt
        if (!document.getElementById('loadingOverlay')) {
            this.eventHandlers?.showLoadingScreen();
        }

       /*  console.log('Neue CSV-Datei wird verarbeitet - zurücksetzen der gespeicherten Daten...'); */
        
        // Schritt 1: Initialisierung und Vorbereitung
        this.eventHandlers?.updateLoadingStep('reading');
        this.showProgress('Datei wird vorbereitet...');
        
        // Mahnstufen-Daten zurücksetzen
        if (this.mahnstufen) {
            this.mahnstufen.tenantMahnstufen.clear();
            this.mahnstufen.individualMahngebuehren.clear();
            this.mahnstufen.saveToStorage();
        }
        
        await this.simulateProcessingDelay(300);

        // Schritt 2: Datei lesen
        this.eventHandlers?.updateLoadingStep('parsing');
        this.updateProgress('CSV-Datei wird gelesen...', 15);
        
        const csvContent = await Utils.readFileContent(file);
        await this.simulateProcessingDelay(400);

        // Schritt 3: CSV analysieren und parsen
        this.updateProgress('CSV wird analysiert...', 35);
        const parseResult = CSVParser.parseCSVData(csvContent);
        await this.simulateProcessingDelay(350);

        // Schritt 4: Validierung
        this.eventHandlers?.updateLoadingStep('validation');
        this.updateProgress('Daten werden validiert...', 50);
        
        if (!parseResult || !parseResult.success) {
            const errorMsg = parseResult?.errors?.join(', ') || 'Unbekannter Fehler';
            throw new Error(`CSV-Parsing fehlgeschlagen: ${errorMsg}`);
        }

        this.csvData = parseResult.data;
        await this.simulateProcessingDelay(300);

        // Schritt 5: Datenverarbeitung
        this.eventHandlers?.updateLoadingStep('processing');
        this.updateProgress('Mieter werden verarbeitet...', 70);
        
        this.tenantManager.processTenantData(parseResult.data);
        await this.simulateProcessingDelay(600);

        this.updateProgress('Benutzeroberfläche wird aufgebaut...', 85);

        // Schritt 6: UI-Rendering
        this.eventHandlers?.updateLoadingStep('rendering');
        this.showFileInfo(file, parseResult.data.length);
        this.showDataOverview();
        
        await this.simulateProcessingDelay(200);
        this.updateProgress('Rendering wird abgeschlossen...', 95);
        
        this.renderCurrentView(true);
        this.dataLoaded = true;
        
        this.updateProgress('Verarbeitung abgeschlossen', 100);
        await this.simulateProcessingDelay(300);

        // Loading-Screen ausblenden mit Erfolgs-Animation
        if (this.eventHandlers) {
            await this.eventHandlers.hideLoadingScreen(500);
        }

        // Erfolgs-Notification nach dem Loading-Screen
/*         setTimeout(() => {
            const tenantCount = parseResult.data.length;
            const message = `✅ ${tenantCount} Mieter erfolgreich aus "${file.name}" geladen`;
            Utils.showNotification(message, 'success');
            
            // Zusätzliche Statistiken anzeigen
            const statistics = this.tenantManager.getStatistics();
            if (statistics.tenantsWithDebt > 0) {
                setTimeout(() => {
                    Utils.showNotification(
                        `📊 ${statistics.tenantsWithDebt} Mieter mit offenen Forderungen gefunden`, 
                        'info'
                    );
                }, 1500);
            }
        }, 200); */

    } catch (error) {
        /* console.error('Fehler beim Verarbeiten der Datei:', error); */
        
        // Loading-Screen sofort ausblenden bei Fehler
        if (this.eventHandlers) {
            await this.eventHandlers.hideLoadingScreen(0);
        }
        
        // Detaillierte Fehler-Notification
        let errorMessage = error.message;
        if (error.message.includes('CSV-Parsing')) {
            errorMessage = `❌ CSV-Datei konnte nicht verarbeitet werden: ${error.message}`;
        } else if (error.message.includes('Validierung')) {
            errorMessage = `⚠️ Datenvalidierung fehlgeschlagen: ${error.message}`;
        } else {
            errorMessage = `🔧 Verarbeitungsfehler: ${error.message}`;
        }
        
        Utils.showNotification(errorMessage, 'error');
        
        // Benutzer-freundliche Hilfe anbieten
        setTimeout(() => {
            Utils.showNotification(
                '💡 Tipp: Überprüfen Sie das CSV-Format und versuchen Sie es erneut', 
                'info'
            );
        }, 3000);
        
    } finally {
        this.hideProgress();
        this.isProcessing = false;
    }
}

simulateProcessingDelay(baseMs) {
    return new Promise(resolve => {
        // Variiert die Delay-Zeit um ±30% für realistisches Verhalten
        const variation = baseMs * 0.3;
        const actualMs = baseMs + (Math.random() * variation * 2 - variation);
        setTimeout(resolve, Math.max(100, actualMs));
    });
}

    togglePostAddressEditor(tenantId) {
        const editor = document.getElementById(`postEditor-${tenantId}`);
        if (editor) {
            const isVisible = editor.style.display !== 'none';
            editor.style.display = isVisible ? 'none' : 'block';

            if (!isVisible) {
                const streetInput = document.getElementById(`street-${tenantId}`);
                if (streetInput) streetInput.focus();
            }
        }
    }

    savePostAddress(tenantId) {
        const street = document.getElementById(`street-${tenantId}`)?.value || '';
        const plz = document.getElementById(`plz-${tenantId}`)?.value || '';
        const city = document.getElementById(`city-${tenantId}`)?.value || '';

        if (!street.trim() || !city.trim()) {
            Utils.showNotification('Straße und Ort sind erforderlich', 'error');
            return;
        }

        this.tenantManager.setCustomPostAddress(tenantId, street, plz, city);
        this.togglePostAddressEditor(tenantId);

        this.updateTenantCard(tenantId);

        Utils.showNotification('Postadresse gespeichert', 'success');
    }

    resetPostAddress(tenantId) {
        if (confirm('Postadresse auf Standard zurücksetzen?')) {
            this.tenantManager.resetPostAddress(tenantId);
            this.togglePostAddressEditor(tenantId);

            this.updateTenantCard(tenantId);

            Utils.showNotification('Postadresse zurückgesetzt', 'success');
        }
    }

    async processCSVData(csvData) {
        try {
            if (!csvData || !Array.isArray(csvData)) {
                throw new Error(`Ungültige CSV-Daten: ${typeof csvData}`);
            }

            const startTime = performance.now();

            csvData.forEach(record => this.tenantManager.processTenantData(record));

            if (typeof mahnstufen !== 'undefined' && mahnstufen.initializeTenants) {
                const tenantIds = Array.from(this.tenantManager.tenants.keys());
                mahnstufen.initializeTenants(tenantIds);
            }

            const processingTime = performance.now() - startTime;

            this.showDataOverview();
            this.repairAnwaltData();

            if (this.statisticsManager) {

                setTimeout(() => {
                    this.statisticsManager.updateStatisticsDelayed(200);
                }, 100);
            }

            document.dispatchEvent(new CustomEvent('csvDataLoaded', {
                detail: {
                    recordCount: csvData.length,
                    tenantCount: this.tenantManager.tenants.size,
                    processingTime: processingTime
                }
            }));

           /*  console.log(`CSV-Daten verarbeitet: ${csvData.length} Datensätze, ${this.tenantManager.tenants.size} Mieter in ${processingTime.toFixed(2)}ms`); */

        } catch (error) {
  /*           console.error('Fehler beim Verarbeiten der CSV-Daten:', error); */
            Utils.showNotification(`Fehler beim Verarbeiten der CSV-Daten: ${error.message}`, 'error');
        }
    }

showFileInfo(file, recordCount) {
    // Ursprüngliche AppUtils-Calls beibehalten
    AppUtils.setElementText('fileName', file.name);
    AppUtils.setElementText('recordCount', recordCount);
    AppUtils.setElementText('tenantCount', this.tenantManager.tenants.size);
    AppUtils.showElement('fileInfo');
    
    // Erweiterte Info nur wenn Container verfügbar und noch nicht erweitert
    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo && !fileInfo.querySelector('.file-info-header')) {
        this.addFileInfoDetails(fileInfo, file, recordCount);
    }
}

addFileInfoDetails(fileInfo, file, recordCount) {
    const fileSize = Utils.formatFileSize ? Utils.formatFileSize(file.size) : `${Math.round(file.size / 1024)} KB`;
    const timestamp = new Date().toLocaleString('de-DE');
    
    // Minimale Erweiterung ohne bestehende Struktur zu überschreiben
    const detailsHtml = `
        <div class="file-info-extras" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                <span>💾 ${fileSize}</span>
                <span>🕒 ${timestamp}</span>
            </div>
        </div>
    `;
    
    fileInfo.insertAdjacentHTML('beforeend', detailsHtml);
}

showDataOverview() {
    const statistics = this.tenantManager.getStatistics();
    AppUtils.hideElement('fileInfo');
    AppUtils.hideElement('uploadSection');
    const dataOverview = document.getElementById('dataOverview');
    dataOverview.innerHTML = this.createDataOverviewHTML(statistics);
    AppUtils.showElement('dataOverview');
    
    // NEU: Standard-Filter setzen
    setTimeout(() => {
        const portfolioInput = document.getElementById('portfolioFilter');
        const anwaltInput = document.getElementById('anwaltFilter');
        
        if (portfolioInput) portfolioInput.value = 'Alle Portfolios';
        if (anwaltInput) anwaltInput.value = 'Alle Mieter';
        
        // Filter anwenden
        this.handlePortfolioFilter('ALL');
        this.handleAnwaltFilter('ALL');
    }, 50);
    
    this.setupComboboxEvents();
    this.forceSetupSearchEventsDelayed();
    
    this.uiRenderer.collapseAllStreetsAfterLoad(this.tenantManager.tenants);
    this.renderCurrentView();
    if (this.statisticsManager && this.tenantManager.tenants && this.tenantManager.tenants.size > 0) {
        setTimeout(() => {
            this.statisticsManager.updateStatisticsDelayed(200);
        }, 150);
    }
}
    repairAnwaltData() {
        if (!this.csvData || this.csvData.length === 0) return;

        const csvAnwaltNamen = new Set();

        this.csvData.forEach(row => {
            if (row.anwaltname && row.anwaltname.trim() !== '') {
                csvAnwaltNamen.add(row.name1);
            }
        });

        const allTenants = this.tenantManager.getAllTenants();
        csvAnwaltNamen.forEach(name => {
            const mieter = allTenants.find(t => t.name1 === name);
            if (mieter) {
                mieter.hasAnwalt = true;
                mieter.anwaltName = 'Anwalt zugeordnet';
            }
        });

        const stats = this.tenantManager.calculateStatistics();
        const dataOverview = document.getElementById('dataOverview');
        if (dataOverview) {
            const newHTML = this.createDataOverviewHTML(stats);
 
            dataOverview.innerHTML = newHTML;
        }

        /* console.log('✅ Anwalt-Daten automatisch repariert:', csvAnwaltNamen.size, 'Mieter'); */
    }

createDataOverviewHTML(statistics) {
    return `
    <div class="overview-header">
        <h3><i class="fas fa-chart-bar"></i> Filter</h3>
    </div>
    <div class="filter-section">
        <div class="filter-row">
            <label class="filter-label">
                <i class="fas fa-search"></i> Textsuche:
            </label>
            <input type="text" id="searchInput" class="filter-input"
                   placeholder="Name, Adresse, ID eingeben...">
        </div>
        <div class="filter-row">
            <label class="filter-label">
                <i class="fas fa-briefcase"></i> Portfolio-Filter:
            </label>
            <div class="custom-combobox">
                <input type="text" id="portfolioFilter" class="filter-select"
                       placeholder="Portfolio eingeben oder auswählen...">
                <div class="custom-dropdown" id="portfolioDropdown"></div>
            </div>
        </div>
        <div class="filter-row">
            <label class="filter-label">
                <i class="fas fa-balance-scale"></i> Anwalt-Filter:
            </label>
            <div class="custom-combobox">
                <input type="text" id="anwaltFilter" class="filter-select"
                       placeholder="Anwalt-Filter auswählen...">
                <div class="custom-dropdown" id="anwaltDropdown"></div>
            </div>
        </div>
<!-- Schulden-Filter ändern von Select zu Input -->
<!-- Schulden-Filter ändern -->
<div class="filter-row">
    <label class="filter-label">
        <i class="fas fa-euro-sign"></i>Schulden ab:
    </label>
    <input type="text" id="schuldenFilter" class="filter-input" 
           placeholder="z.B. 100,00 €" 
           title="Nur Mieter mit Schulden ab diesem Betrag anzeigen">
</div>
        <div class="action-buttons">
            <button id="selectAllBtn" class="btn btn-primary">
                <i class="fas fa-check-square"></i> Alle auswählen
            </button>
            <button id="deselectAllBtn" class="btn btn-secondary">
                <i class="fas fa-minus-square"></i> Alle abwählen
            </button>
            <button id="resetFiltersBtn" class="btn btn-warning">
                <i class="fas fa-undo"></i> Filter zurücksetzen
            </button>
        </div>
    </div>
    <div id="tenantList" class="tenant-list"></div>`;
}
setupComboboxEvents() {
    this.setupCustomCombobox('portfolioFilter', 'portfolioDropdown', [
        'Alle Portfolios',
        ...this.getPortfolioList()
    ]);
    
    this.setupCustomCombobox('anwaltFilter', 'anwaltDropdown', [
        'Alle Mieter',
        `Mit Anwalt (${this.getTenantsWithAnwaltCount()})`,
        'Ohne Anwalt'
    ]);
}

setupCustomCombobox(inputId, dropdownId, options) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    
    if (!input || !dropdown) return;
    
    // Dropdown beim Klick/Focus öffnen
    input.addEventListener('click', () => {
        if (inputId === 'anwaltFilter') {
            const updatedOptions = this.getAnwaltOptionsForCurrentPortfolio();
            this.showDropdown(dropdown, updatedOptions);
        } else {
            this.showDropdown(dropdown, options);
        }
    });
    
    input.addEventListener('focus', () => {
        if (inputId === 'anwaltFilter') {
            const updatedOptions = this.getAnwaltOptionsForCurrentPortfolio();
            this.showDropdown(dropdown, updatedOptions);
        } else {
            this.showDropdown(dropdown, options);
        }
    });
    
    // GEÄNDERT: Live-Suche in Dropdown
    input.addEventListener('input', () => {
        const searchTerm = input.value.toLowerCase();
        
        if (searchTerm === '') {
            // Alle Optionen zeigen
            const allOptions = inputId === 'anwaltFilter' ? 
                this.getAnwaltOptionsForCurrentPortfolio() : options;
            this.showDropdown(dropdown, allOptions);
        } else if (this.isValidFilterValue(input.value, options, inputId)) {
            // Bekannter Wert - Filter anwenden
            const mappedValue = this.mapToFilterValue(input.value);
            this.showFilterLoading();
            
            if (inputId === 'portfolioFilter') {
                this.handlePortfolioFilter(mappedValue);
                document.getElementById('anwaltFilter').value = '';
            } else if (inputId === 'anwaltFilter') {
                this.handleAnwaltFilter(mappedValue);
            }
            
            setTimeout(() => this.hideFilterLoading(), 1000);
        } else {
            // NEU: Suche in Optionen
            const allOptions = inputId === 'anwaltFilter' ? 
                this.getAnwaltOptionsForCurrentPortfolio() : options;
            const filteredOptions = allOptions.filter(option => 
                option.toLowerCase().includes(searchTerm)
            );
            this.showDropdown(dropdown, filteredOptions);
        }
    });
    
    // Enter-Taste für manuelle Eingabe
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const value = this.mapToFilterValue(input.value);
            this.showFilterLoading();
            
            if (inputId === 'portfolioFilter') {
                this.handlePortfolioFilter(value);
                document.getElementById('anwaltFilter').value = '';
            } else if (inputId === 'anwaltFilter') {
                this.handleAnwaltFilter(value);
            }
            
            setTimeout(() => this.hideFilterLoading(), 1000);
        }
    });
    
    // Dropdown schließen bei Klick außerhalb
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}
// NEU: Diese Funktion hinzufügen
isValidFilterValue(value, options, inputId) {
    // Prüfe ob es ein gültiger Filterwert ist
    return value === '' || 
           options.includes(value) || 
           value === 'Alle Portfolios' || 
           value === 'Alle Mieter' ||
           value.includes('Mit Anwalt') || 
           value === 'Ohne Anwalt' ||
           (inputId === 'portfolioFilter' && this.getPortfolioList().includes(value));
}

// NEU: Diese Funktion hinzufügen
getAnwaltOptionsForCurrentPortfolio() {
    const currentPortfolio = document.getElementById('portfolioFilter').value;
    const mappedPortfolio = this.mapToFilterValue(currentPortfolio);
    
    // Gefilterte Mieter für aktuelles Portfolio holen
    const filteredTenants = mappedPortfolio === 'ALL' ? 
        this.tenantManager.getAllTenants() : 
        this.tenantManager.getAllTenants().filter(t => t.portfolio === mappedPortfolio);
    
    // GEÄNDERT: Anwalt-Count anders berechnen
    const anwaltCount = filteredTenants.filter(t => {
        // Prüfe ob Mieter Anwalt hat (über Records oder Properties)
        return t.anwalt || t.anwaltname || 
               (t.records && t.records.some(r => r.anwalt || r.anwaltname));
    }).length;
    
    const options = ['Alle Mieter'];
    if (anwaltCount > 0) {
        options.push(`Mit Anwalt (${anwaltCount})`);
        options.push('Ohne Anwalt');
    } else {
        options.push('Ohne Anwalt (alle)');
    }
    
    return options;
}
// NEU: Diese 2 Funktionen hinzufügen
showFilterLoading() {
    // Verhindere doppeltes Loading
    if (document.getElementById('filterLoadingOverlay')) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'filter-loading-overlay';
    overlay.id = 'filterLoadingOverlay';
    overlay.innerHTML = '<div class="filter-spinner"></div>';
    
    // Initial unsichtbar
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease-in-out';
    
    document.body.appendChild(overlay);
    
    // Smooth Fade-In nach dem Hinzufügen
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
    });
}
hideFilterLoading() {
    const overlay = document.getElementById('filterLoadingOverlay');
    if (!overlay) return;
    
    // Smooth Fade-Out
    overlay.style.opacity = '0';
    
    // Nach Animation entfernen
    setTimeout(() => {
        overlay.remove();
    }, 300); // 300ms = Transition-Dauer
}


// NEU: Diese Funktion hinzufügen
mapToFilterValue(displayText) {
    if (displayText === 'Alle Portfolios' || displayText === 'Alle Mieter') return 'ALL';
    if (displayText.includes('Mit Anwalt')) return 'WITH_ANWALT';
    if (displayText === 'Ohne Anwalt') return 'WITHOUT_ANWALT';
    return displayText; // Portfolio-Namen bleiben gleich
}
showDropdown(dropdown, options) {
    dropdown.innerHTML = options.map(option => 
        `<div class="custom-dropdown-item" data-value="${option}">${option}</div>`
    ).join('');
    
    dropdown.style.display = 'block';
    
    // Click-Handler für Optionen
    dropdown.querySelectorAll('.custom-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const input = dropdown.previousElementSibling;
            input.value = e.target.dataset.value;
            dropdown.style.display = 'none';
            
            // NEU: Filter sofort anwenden
            input.dispatchEvent(new Event('input'));
        });
    });
}

getPortfolioList() {
    const allTenants = this.tenantManager.getAllTenants();
    const portfolios = [...new Set(allTenants.map(t => t.portfolio || 'Standard'))];
    return portfolios.sort();
}
getPortfolioOptions() {
    const allTenants = this.tenantManager.getAllTenants();
    const portfolioCounts = {};
    allTenants.forEach(tenant => {
        const portfolio = tenant.portfolio || 'Standard';
        portfolioCounts[portfolio] = (portfolioCounts[portfolio] || 0) + 1;
    });
    return Object.entries(portfolioCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([portfolio, count]) => {
            const escaped = AppUtils.escapeHtml(portfolio);
            return `<option value="${escaped}">${escaped} (${count} Mieter)</option>`;
        })
        .join('');
}

resetAllFilters() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    const portfolioFilter = document.getElementById('portfolioFilter');
    if (portfolioFilter) portfolioFilter.value = 'ALL';
    this.tenantManager.clearPortfolioFilter();
    
    const anwaltFilter = document.getElementById('anwaltFilter');
    if (anwaltFilter) anwaltFilter.value = 'ALL';
    this.tenantManager.clearAnwaltFilter();
    
    // NEU: Schulden-Filter zurücksetzen
    const schuldenFilter = document.getElementById('schuldenFilter');
    if (schuldenFilter) schuldenFilter.value = '';  // Leerer String statt 'ALL'
    this.tenantManager.clearSchuldenFilter();
    
    this.renderCurrentView();
    this.updateSummary();
}

renderCurrentView(isInitialLoad = false) {
    if (this.isRendering) {
        return;
    }
    
    this.isRendering = true;
    
    if (!this.tenantManager || this.tenantManager.tenants.size === 0) {
        this.isRendering = false;
        return;
    }
    
    try {
        const filteredTenants = this.tenantManager.getFilteredTenants();
        
        const filteredMap = new Map();
        filteredTenants.forEach(tenant => {
            filteredMap.set(tenant.id, tenant);
        });
        
        let finalTenants = filteredMap;
        
        if (this.currentSearchTerm && this.currentSearchTerm.trim() !== '') {
            this.isRendering = false;
            this.handleSearch(this.currentSearchTerm);
            return;
        }
        
        requestAnimationFrame(() => {
            try {
                this.uiRenderer.renderTenantList(finalTenants, isInitialLoad);
                this.updateSummaryThrottled();
            } finally {
                this.isRendering = false;
            }
        });
        
    } catch (error) {
        this.isRendering = false;
    }
}

    updateSummaryThrottled() {
        clearTimeout(this.summaryUpdateTimeout);
        this.summaryUpdateTimeout = setTimeout(() => {
            this.updateSummary();
            this.updateActionButton();
        }, AppConfig.SUMMARY_UPDATE_DELAY);
    }

    updateSummary() {
        if (!this.tenantManager) return;
        const statistics = this.tenantManager.getStatistics();
        const summaryElement = document.getElementById('summaryContent');
        if (summaryElement && this.uiRenderer) {
            summaryElement.innerHTML = this.uiRenderer.createSummaryContent(statistics, this.singleInvoiceCount);
        }
    }

    handleSearch(searchTerm) {
        /* console.log(`=== SEARCH EXECUTION: "${searchTerm}" ===`); */

        this.currentSearchTerm = searchTerm;

        if (!searchTerm || searchTerm.trim() === '') {
         /*    console.log('Empty search - showing all tenants'); */
            this.currentSearchTerm = '';
            this.renderCurrentView();
            return;
        }

        const search = searchTerm.toLowerCase().trim();
        const allTenants = this.tenantManager.getAllTenants();
        /* console.log(`Searching through ${allTenants.length} tenants`); */

        const filteredTenants = allTenants.filter(tenant => {
            const searchableFields = [
                tenant.name,
                tenant.name1,
                tenant.name2,
                tenant.street,
                tenant.city,
                tenant.mieterstr,
                tenant.mieterort,
                tenant.id,
                tenant.portfolio
            ].filter(field => field && typeof field === 'string');

            const fullText = searchableFields.join(' ').toLowerCase();
            const searchWords = search.split(/\s+/);
            return searchWords.every(word =>
                word.length > 0 && fullText.includes(word)
            );
        });

     /*    console.log(`Search results: ${filteredTenants.length}/${allTenants.length}`); */

        const filteredMap = new Map();
        filteredTenants.forEach(tenant => {
            filteredMap.set(tenant.id, tenant);
        });

        try {
            this.uiRenderer.renderTenantList(filteredMap);
            this.updateSummaryThrottled();
            /* console.log('✅ UI updated successfully'); */
        } catch (error) {
           /*  console.error('❌ Error updating UI:', error); */
        }

        return filteredTenants;
    }

    handleAnwaltFilter(anwaltType) {
        if (anwaltType === '' || anwaltType === 'ALL') {
            this.tenantManager.clearAnwaltFilter();
        } else {
            this.tenantManager.setAnwaltFilter(anwaltType);
        }
        this.renderCurrentView();
        this.updateSummary();
    }

handleSchuldenFilter(formattedBetrag) {
   /*  console.log('🎯 handleSchuldenFilter aufgerufen:', formattedBetrag); */
    
    // Extrahiere numerischen Wert
    const betrag = this.eventHandlers.parseSchuldenValue(formattedBetrag);
    
    this.showFilterLoading();
    const startTime = Date.now();
    
    setTimeout(() => {
        if (betrag === 0 || !formattedBetrag.trim()) {
            this.tenantManager.clearSchuldenFilter();
        } else {
            this.tenantManager.setSchuldenFilter(betrag); // Numerischen Wert verwenden
        }
        
        this.renderCurrentView();
        this.updateSummary();
        
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(1000 - elapsedTime, 0);
        
        setTimeout(() => {
            this.hideFilterLoading();
        }, remainingTime);
        
    }, 50);
}


    handlePortfolioFilter(portfolioName) {
        if (portfolioName === '' || portfolioName === 'ALL') {
            this.tenantManager.clearPortfolioFilter();
        } else {
            this.tenantManager.setPortfolioFilter(portfolioName);
        }
        this.renderCurrentView();
        this.updateSummary();
    }

    toggleTenantExpansion(tenantId) {
        const tenantCard = document.querySelector(`[data-tenant-id="${tenantId}"]`);
        const details = document.getElementById(`details-${tenantId}`);
        const expandIcon = tenantCard?.querySelector('.expand-indicator i');

        if (!tenantCard || !details) return;

        const isExpanded = tenantCard.classList.contains('expanded');
        tenantCard.classList.toggle('expanded');
        details.style.display = isExpanded ? 'none' : 'block';

        if (expandIcon) {
            expandIcon.className = `fas fa-chevron-${isExpanded ? 'down' : 'up'}`;
        }

        if (!isExpanded) {
            setTimeout(() => details.classList.add('expanded'), 10);
        } else {
            details.classList.remove('expanded');
        }
    }

    toggleTenantSelection(tenantId, selected) {
        const tenant = this.tenantManager.getTenant(tenantId);
        if (tenant) {
            tenant.selected = selected;
            this.updateActionButton();
        }
    }

    toggleCostPosition(recordId, enabled) {
        const tenantId = this.tenantManager.toggleCostPosition(recordId, enabled);
        if (tenantId) {
            this.updateTenantCard(tenantId);
            this.updateActionButton();
        }
    }

    selectAllTenants() {
        this.tenantManager.selectAllTenants();
        this.renderCurrentView();
    }

    deselectAllTenants() {
        this.tenantManager.deselectAllTenants();
        this.renderCurrentView();
    }

    selectAllPositions(tenantId) {
        this.tenantManager.selectAllPositions(tenantId);
        this.updateTenantCard(tenantId);
    }

    deselectAllPositions(tenantId) {
        this.tenantManager.deselectAllPositions(tenantId);
        this.updateTenantCard(tenantId);
    }

    selectAllInStreet(streetName) {
        this.updateStreetSelection(streetName, true);
    }

    deselectAllInStreet(streetName) {
        this.updateStreetSelection(streetName, false);
    }

    updateStreetSelection(streetName, selected) {
        const streetContainer = document.querySelector(`[data-street="${streetName}"]`);
        if (!streetContainer) return;

        streetContainer.querySelectorAll('.tenant-checkbox').forEach(checkbox => {
            checkbox.checked = selected;
            const tenant = this.tenantManager.getTenant(checkbox.dataset.tenantId);
            if (tenant) tenant.selected = selected;
        });
        this.updateActionButton();
    }

    async generateAllInvoicesForStreet(streetName) {
        const streetTenants = this.getStreetTenantsWithDebt(streetName);

        if (streetTenants.length === 0) {
            return Utils.showNotification(`Keine Mieter mit Schulden in ${streetName} gefunden`, 'warning');
        }

        if (!confirm(`${streetTenants.length} Mahnungen für ${streetName} erstellen?`)) return;

        await this.generateBulkPDFs(streetTenants, `Mahnungen für ${streetName}`,
            () => Utils.showNotification(`${streetTenants.length} Mahnungen für ${streetName} erstellt!`, 'success'));
    }

async generateSelectedInvoicesForStreet(streetName) {
    try {
       /*  console.log(`🔍 Generiere ausgewählte Mahnungen für ${streetName}...`); */
        const selectedTenantsInStreet = this.getSelectedTenantsInStreetWithDebt(streetName);
        if (selectedTenantsInStreet.length === 0) {
            Utils.showNotification(`Keine ausgewählten Mieter mit Schulden in ${streetName} gefunden`, 'warning');
            return;
        }
        
        // GEÄNDERT: Schönes Modal statt confirm()
        const confirmed = await this.showConfirmModal(
            'Mahnungen erstellen',
            `${selectedTenantsInStreet.length} ausgewählte Mahnungen für ${streetName} erstellen?`,
            selectedTenantsInStreet.map(t => `• ${t.name}`).join('\n')
        );
        
        if (!confirmed) return;
        
        await this.generateBulkPDFs(
            selectedTenantsInStreet,
            `Ausgewählte Mahnungen für ${streetName}`,
            () => {
                Utils.showNotification(
                    `${selectedTenantsInStreet.length} ausgewählte Mahnungen für ${streetName} erstellt!`,
                    'success'
                );
            }
        );
    } catch (error) {
        /* console.error(`Fehler bei ausgewählten Mahnungen für ${streetName}:`, error); */
        Utils.showNotification(`Fehler bei der PDF-Erstellung: ${error.message}`, 'error');
    }
}

// NEU: Diese Funktion hinzufügen
showConfirmModal(title, message, details = '') {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'mailsend-modal';
        modal.innerHTML = `
            <div class="mailsend-modal-content" style="max-width: 450px;">
                <div class="mailsend-modal-header">
                    <h3 class="mailsend-modal-title"><i class="fas fa-question-circle"></i> ${title}</h3>
                    <button class="mailsend-modal-close" onclick="this.closest('.mailsend-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="mailsend-modal-body">
                    <p style="margin-bottom: ${details ? '15px' : '20px'}; color: #333; font-size: 16px;">${message}</p>
                    ${details ? `<div style="background: #f8f9fa; padding: 15px; border-radius: 4px; font-size: 15px; color: #333; max-height: 350px; overflow-y: auto; white-space: pre-line; margin-bottom: 20px; line-height: 1.4;">${details.replace(/• /g, '')}</div>` : ''}
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button class="btn btn-secondary" data-choice="cancel" style="background: #6c757d; border-color: #6c757d;">
                            <i class="fas fa-times"></i> Abbrechen
                        </button>
                        <button class="btn btn-primary" data-choice="confirm" style="background: #5f7d95; border-color: #5f7d95;">
                            <i class="fas fa-check"></i> Erstellen
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'block';

        modal.addEventListener('click', (e) => {
            const choice = e.target.closest('[data-choice]')?.getAttribute('data-choice');
            if (choice) {
                modal.remove();
                resolve(choice === 'confirm');
            }
        });

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
                resolve(false);
            }
        };
        document.addEventListener('keydown', handleEscape);
    });
}

getSelectedTenantsInStreetWithDebt(streetName) {
    try {
        const streetContainer = document.querySelector(`[data-street="${streetName}"]`);
        if (!streetContainer) {
            /* console.warn(`Straßen-Container für ${streetName} nicht gefunden`); */
            return [];
        }
        const selectedTenants = [];

        streetContainer.querySelectorAll('.tenant-checkbox:checked').forEach(checkbox => {
            const tenantId = checkbox.dataset.tenantId;
            const tenant = this.tenantManager.getTenant(tenantId);

            if (tenant) {
                const totalDifference = this.tenantManager.calculateTenantTotal(tenant);
                if (totalDifference < 0) {
                    selectedTenants.push(tenant);
                }
            }
        });
       /*  console.log(`📋 ${selectedTenants.length} ausgewählte Mieter mit Schulden in ${streetName}`); */
        return selectedTenants;

    } catch (error) {
       /*  console.error(`Fehler in getSelectedTenantsInStreetWithDebt für ${streetName}:`, error); */
        return [];
    }
}

    getStreetTenantsWithDebt(streetName) {
        const streetContainer = document.querySelector(`[data-street="${streetName}"]`);
        if (!streetContainer) return [];

        const tenants = [];
        streetContainer.querySelectorAll('.tenant-checkbox').forEach(checkbox => {
            const tenant = this.tenantManager.getTenant(checkbox.dataset.tenantId);
            if (tenant && this.tenantManager.calculateTenantTotal(tenant) < 0) {
                tenants.push(tenant);
            }
        });
        return tenants;
    }

    updateTenantCard(tenantId) {
        const tenant = this.tenantManager.getTenant(tenantId);
        if (!tenant) {
            /* console.warn(`Tenant ${tenantId} nicht gefunden für Update`); */
            return;
        }

        const tenantCard = document.querySelector(`[data-tenant-id="${tenantId}"]`);
        if (!tenantCard) {
            /* console.warn(`Tenant-Card für ${tenantId} nicht im DOM gefunden`); */
            return;
        }

        try {

            const totalDifference = this.tenantManager.calculateTenantTotal(tenant);
            const enabledCount = tenant.records.filter(r => r.enabled).length;
            const totalCount = tenant.records.length;
            const address = `${tenant.street}, ${tenant.plz} ${tenant.city}`;

            const masterDataTable = tenantCard.querySelector('.master-data-table');
            if (masterDataTable) {
                masterDataTable.innerHTML = this.uiRenderer.createMasterDataRows(
                    tenant, totalDifference, address, enabledCount
                );
            }

            const debtElement = tenantCard.querySelector('.tenant-debt');
            if (debtElement) {
                const debtAmount = Math.abs(totalDifference);
                const debtClass = UIRendererUtils.getColorClass(totalDifference);
                debtElement.className = `tenant-debt ${debtClass}`;
                debtElement.innerHTML = this.uiRenderer.formatDebtAmount(totalDifference, debtAmount);
            }

            const countElement = tenantCard.querySelector('.position-count');
            if (countElement) {
                countElement.innerHTML = `${UIRendererUtils.createIcon('tasks')} ${enabledCount}/${totalCount}`;
            }

            /* console.log(`✅ Tenant-Card für ${tenantId} erfolgreich aktualisiert`); */

        } catch (error) {
           /*  console.error(`Fehler beim Aktualisieren der Tenant-Card für ${tenantId}:`, error); */
        }
    }

    updateTenantCardDisplay(tenantCard, totalDifference, enabledCount, totalCount) {
        const debtElement = tenantCard.querySelector('.tenant-debt');
        const countElement = tenantCard.querySelector('.position-count');

        if (debtElement) {
            const debtAmount = Math.abs(totalDifference);
            const debtClass = totalDifference < 0 ? 'has-debt' : totalDifference > 0 ? 'no-debt' : 'neutral';
            const icon = totalDifference < 0 ? 'minus-circle' : totalDifference > 0 ? 'plus-circle' : 'equals';
            const sign = totalDifference > 0 ? '+' : '';

            debtElement.className = `tenant-debt ${debtClass}`;
            debtElement.innerHTML = totalDifference === 0
                ? '<i class="fas fa-equals"></i> 0,00 €'
                : `<i class="fas fa-${icon}"></i> ${sign}${Utils.formatAmount(debtAmount)}`;
        }

        if (countElement) {
            countElement.innerHTML = `<i class="fas fa-tasks"></i> ${enabledCount}/${totalCount}`;
        }
    }

    updateTenantPositions(tenantCard, tenant) {
        tenant.records.forEach(record => {
            const positionElement = tenantCard.querySelector(`[data-record-id="${record.id}"]`);
            if (positionElement) {
                const checkbox = positionElement.querySelector('.position-checkbox');
                if (checkbox) checkbox.checked = record.enabled;
                positionElement.classList.toggle('disabled', !record.enabled);
            }
        });
    }

    updateActionButton() {
        const selectedCount = this.tenantManager.getSelectedTenants().length;
        const generateButton = document.getElementById('generateSelectedButton');
        if (!generateButton) return;

        generateButton.disabled = selectedCount === 0;

        if (selectedCount === 0) {
            generateButton.innerHTML = '<i class="fas fa-file-invoice"></i> Mieter auswählen';
        } else {
            const currentPortfolio = this.tenantManager.getCurrentPortfolioFilter();
            const portfolioText = currentPortfolio ? ` (${currentPortfolio})` : '';
            generateButton.innerHTML = `<i class="fas fa-file-invoice-dollar"></i> ${selectedCount} Mahnung(en) erstellen${portfolioText}`;
        }
    }

    async generateSelectedInvoices() {
        if (this.isProcessing) return;

        const tenantsWithDebt = this.tenantManager.getTenantsWithDebt();
        if (tenantsWithDebt.length === 0) {
            return Utils.showNotification('Keine Mieter mit Schulden ausgewählt.', 'warning');
        }

        const currentPortfolio = this.tenantManager.getCurrentPortfolioFilter();
        const portfolioText = currentPortfolio ? ` aus Portfolio "${currentPortfolio}"` : '';

        if (!confirm(`${tenantsWithDebt.length} Mahnungen${portfolioText} werden erstellt.\n\nFortfahren?`)) return;

        await this.generateBulkPDFs(tenantsWithDebt, 'PDF-Generierung',
            (results) => {
                this.showSummary(this.singleInvoiceCount);
                const portfolioInfo = currentPortfolio ? ` (Portfolio: ${currentPortfolio})` : '';
                Utils.showNotification(`${results.successful} Mahnungen wurden in den Download-Ordner gespeichert!${portfolioInfo}`, 'success');
            });
    }

    async generateSingleInvoice(tenantId) {
        try {
            let tenant = this.getTenantByAllMethods(tenantId);

            if (!tenant) {
                /* console.error('Tenant nicht gefunden:', tenantId); */
                Utils.showNotification('Mieter nicht gefunden', 'error');
                return;
            }

            if (!this.validateTenantForPDF(tenant)) return;

         /*    console.log(`Generiere PDF für ${tenantId} mit individuellen Texten`); */

            const result = await this.pdfGenerator.generatePDFForTenant(tenant);

            if (result?.success) {
                const mahnstufe = mahnstufen.getMahnstufe(tenantId);
                const mahnstufeName = mahnstufen.getMahnstufeConfig(mahnstufe).name;
                Utils.showNotification(`${mahnstufeName} für ${tenant.name} erstellt`, 'success');
            } else {
                throw new Error('PDF-Generierung fehlgeschlagen');
            }
        } catch (error) {
            /* console.error('Fehler bei Einzelmahnung:', error); */
            Utils.showNotification(`PDF-Erstellung fehlgeschlagen: ${error.message}`, 'error');
        }
    }

    getTenantByAllMethods(tenantId) {
        let tenant;

        if (this.tenantManager.getTenant) {
            tenant = this.tenantManager.getTenant(tenantId);
        }

        if (!tenant) {
            const allTenants = this.tenantManager.getAllTenants();
            if (Array.isArray(allTenants)) {
                tenant = allTenants.find(t => t.id === tenantId);
            } else if (allTenants instanceof Map) {
                tenant = allTenants.get(tenantId);
            } else if (typeof allTenants === 'object') {
                tenant = allTenants[tenantId];
            }
        }

        if (!tenant && this.tenantManager.tenants) {
            if (this.tenantManager.tenants instanceof Map) {
                tenant = this.tenantManager.tenants.get(tenantId);
            } else if (typeof this.tenantManager.tenants === 'object') {
                tenant = this.tenantManager.tenants[tenantId];
            }
        }

        return tenant;
    }

    validateTenantForPDF(tenant) {
        if (!tenant.records || tenant.records.length === 0) {
            Utils.showNotification('Keine Rechnungsdaten für diesen Mieter verfügbar', 'error');
            return false;
        }

        const enabledRecords = tenant.records.filter(r => r.enabled);
        if (enabledRecords.length === 0) {
            Utils.showNotification('Keine aktiven Positionen für diesen Mieter ausgewählt', 'warning');
            return false;
        }

        const totalDifference = this.tenantManager.calculateTenantTotal(tenant);
        if (totalDifference >= 0) {
            Utils.showNotification('Dieser Mieter hat keine Schulden', 'info');
            return false;
        }

        return true;
    }

    updateProgress(message, percentage) {
    // Ursprüngliche Progress-Bar aktualisieren
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
    
    if (progressText) {
        progressText.textContent = message;
    }
    
    // Loading-Screen Progress-Bar synchronisieren
    const loadingProgress = document.getElementById('loadingProgress');
    if (loadingProgress) {
        loadingProgress.style.width = `${percentage}%`;
    }
    
   /*  console.log(`📊 Fortschritt: ${percentage}% - ${message}`); */
}

    async generateBulkPDFs(tenants, progressPrefix, onSuccess) {
        this.isProcessing = true;
        try {
            this.showProgress(`${progressPrefix} gestartet...`, 0);
            const results = await this.pdfGenerator.generateBulkInvoices(tenants, (current, total, message) => {
                this.updateProgress(message, (current / total) * 100);
            });

            this.hideProgress();
            if (results.successful > 0) {
                this.singleInvoiceCount += results.successful;
                onSuccess(results);
            }

            if (results.failed > 0) {
                Utils.showNotification(`${results.successful} erstellt, ${results.failed} Fehler aufgetreten.`, 'warning');
               /*  console.error('PDF-Generierung Fehler:', results.errors); */
            }
        } catch (error) {
           /*  console.error('Fehler bei PDF-Generierung:', error); */
            Utils.showNotification('Fehler bei der PDF-Generierung: ' + error.message, 'error');
        } finally {
            this.isProcessing = false;
            this.hideProgress();
        }
    }

    showProgress(text, percentage) {
        AppUtils.showElement('progressSection');
        AppUtils.setElementStyle('progressFill', 'width', `${percentage}%`);
        AppUtils.setElementText('progressText', text);
    }

    updateProgress(text, percentage) {
        AppUtils.setElementStyle('progressFill', 'width', `${percentage}%`);
        AppUtils.setElementText('progressText', text);
    }

    hideProgress() {
        AppUtils.hideElement('progressSection');
    }

    showSummary(generatedCount = 0) {
        const statistics = this.tenantManager.getStatistics();
        const summaryContent = document.getElementById('summaryContent');
        if (summaryContent && this.uiRenderer) {
            summaryContent.innerHTML = this.uiRenderer.createSummaryContent(statistics, generatedCount);
            AppUtils.showElement('summarySection');
        }
    }

    resetApplication() {
        if (!confirm('Möchten Sie eine neue CSV-Datei laden? Alle aktuellen Daten gehen verloren.')) return;

        this.csvData = [];
        this.tenantManager.reset();
        this.filteredTenants = new Map();
        this.currentSearchTerm = '';
        this.dataLoaded = false;
        this.singleInvoiceCount = 0;

        if (this.mahnstufen) {
            this.mahnstufen.tenantMahnstufen.clear();
            this.mahnstufen.saveToStorage();
        }

        ['dataOverview', 'actionsSection', 'progressSection', 'summarySection', 'fileInfo'].forEach(id => AppUtils.hideElement(id));
        AppUtils.showElement('uploadSection');

        ['csvFileInput', 'searchInput'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });

        Utils.showNotification('Anwendung wurde zurückgesetzt.', 'info');
    }

    collapseAllTenants() {
        document.querySelectorAll('.tenant-card.expanded').forEach(card => {
            this.toggleTenantExpansion(card.dataset.tenantId);
        });
    }

    isDataLoaded() { return this.dataLoaded; }
    hasUnsavedChanges() { return false; }

    showCustomPostAddressesInfo() {
        const info = this.tenantManager.getCustomPostAddressesInfo();
        const message = `
Benutzerdefinierte Postadressen:
- Anzahl: ${info.count}
- Speicherplatz: ${info.storageSize} KB
- Mieter: ${info.tenants.join(', ')}

Diese Adressen bleiben beim CSV-Upload erhalten.
        `;
        alert(message);
    }

    clearAllCustomPostAddresses() {
        if (confirm(`Möchten Sie alle ${this.tenantManager.customPostAddresses.size} benutzerdefinierten Postadressen löschen?`)) {
            this.tenantManager.clearCustomPostAddressesStorage();

            this.tenantManager.tenants.forEach((tenant, tenantId) => {
                this.updateTenantCard(tenantId);
            });

            Utils.showNotification('Alle benutzerdefinierten Postadressen gelöscht', 'success');
        }
    }

    resetApplication(includingPostAddresses = false) {
        try {
            this.csvData = [];
            this.filteredTenants.clear();
            this.currentSearchTerm = '';
            this.dataLoaded = false;
            this.singleInvoiceCount = 0;

            if (this.tenantManager) {
                this.tenantManager.reset();
            }

            if (this.mahnstufen) {
                this.mahnstufen.tenantMahnstufen.clear();
                this.mahnstufen.individualMahngebuehren.clear();
                this.mahnstufen.saveToStorage();
            }

            if (includingPostAddresses && this.tenantManager) {
                this.tenantManager.clearCustomPostAddressesStorage();
            }

            const fileInfo = document.getElementById('fileInfo');
            if (fileInfo) fileInfo.style.display = 'none';

            const dataOverview = document.getElementById('dataOverview');
            if (dataOverview) dataOverview.style.display = 'none';

            const actionsSection = document.getElementById('actionsSection');
            if (actionsSection) actionsSection.style.display = 'none';

            const summarySection = document.getElementById('summarySection');
            if (summarySection) summarySection.style.display = 'none';

            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';

            const csvFileInput = document.getElementById('csvFileInput');
            if (csvFileInput) csvFileInput.value = '';

            const addressInfo = includingPostAddresses ? ' (inkl. Postadressen)' : '';
            /* console.log(`Anwendung wurde zurückgesetzt${addressInfo}`); */
            Utils.showNotification(`Anwendung wurde zurückgesetzt${addressInfo}`, 'success');

        } catch (error) {
           /*  console.error('Fehler beim Zurücksetzen der Anwendung:', error); */
            Utils.showNotification('Fehler beim Zurücksetzen', 'error');
        }
    }

    toggleNameEditor(tenantId) {
        const editor = document.getElementById(`nameEditor-${tenantId}`);
        if (editor) {
            const isVisible = editor.style.display !== 'none';
            editor.style.display = isVisible ? 'none' : 'block';

            if (!isVisible) {
                const name1Input = document.getElementById(`name1-${tenantId}`);
                if (name1Input) name1Input.focus();
            }
        }
    }

    saveNames(tenantId) {
        const name1 = document.getElementById(`name1-${tenantId}`)?.value || '';
        const name2 = document.getElementById(`name2-${tenantId}`)?.value || '';

        if (!name1.trim()) {
            Utils.showNotification('Name 1 ist erforderlich', 'error');
            return;
        }

        this.tenantManager.setCustomNames(tenantId, name1, name2);
        this.toggleNameEditor(tenantId);
        this.updateTenantCard(tenantId);
        Utils.showNotification('Namen gespeichert', 'success');
    }

    resetNames(tenantId) {
        if (confirm('Namen auf Standard zurücksetzen?')) {
            this.tenantManager.resetNames(tenantId);
            this.toggleNameEditor(tenantId);
            this.updateTenantCard(tenantId);
            Utils.showNotification('Namen zurückgesetzt', 'success');
        }
    }

    toggleAnredeEditor(tenantId) {
        const editor = document.getElementById(`anredeEditor-${tenantId}`);
        if (editor) {
            const isVisible = editor.style.display !== 'none';
            editor.style.display = isVisible ? 'none' : 'block';

            if (!isVisible) {
                const anrede1Input = document.getElementById(`anrede1-${tenantId}`);
                if (anrede1Input) anrede1Input.focus();
            }
        }
    }

    saveAnreden(tenantId) {
        const anrede1 = document.getElementById(`anrede1-${tenantId}`)?.value || '';
        const anrede2 = document.getElementById(`anrede2-${tenantId}`)?.value || '';

        this.tenantManager.setCustomAnreden(tenantId, anrede1, anrede2);
        this.toggleAnredeEditor(tenantId);
        this.updateTenantCard(tenantId);
        Utils.showNotification('Anreden gespeichert', 'success');
    }

    resetAnreden(tenantId) {
        if (confirm('Anreden auf Standard zurücksetzen?')) {
            this.tenantManager.resetAnreden(tenantId);
            this.toggleAnredeEditor(tenantId);
            this.updateTenantCard(tenantId);
            Utils.showNotification('Anreden zurückgesetzt', 'success');
        }
    }

}

let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new MietmahnungApp();
    window.app = app;
});

if (document.readyState !== 'loading') {
    app = new MietmahnungApp();
    window.app = app;
}

window.addEventListener('error', (e) => {
  /*   console.error('Globaler Fehler:', e.error); */
    Utils.showNotification?.('Ein unerwarteter Fehler ist aufgetreten.', 'error');
});

window.addEventListener('unhandledrejection', (e) => {
    /* console.error('Unbehandelte Promise-Rejection:', e.reason); */
    Utils.showNotification?.('Ein Fehler bei der Datenverarbeitung ist aufgetreten.', 'error');
});

/* console.log(`MietmahnungApp v${AppConfig.VERSION} geladen`); */

function debugPostAddresses() {
    const info = window.app.tenantManager.getCustomPostAddressesInfo();
/*     console.log('=== POSTADRESS DEBUG ===');
    console.log('Anzahl:', info.count);
    console.log('Tenants:', info.tenants);
    console.log('Storage Size:', info.storageSize, 'KB');
    console.log('Alle Adressen:', Array.from(window.app.tenantManager.customPostAddresses.entries()));
    console.log('========================'); */
}

function clearPostAddresses() {
    window.app.clearAllCustomPostAddresses();
}

window.addEventListener('DOMContentLoaded', () => {

    setTimeout(() => {
        if (window.app && document.getElementById('searchInput')) {
           /*  console.log('🚨 BACKUP: Search Events setup'); */
            window.app.forceSetupSearchEventsDelayed();
        }
    }, 3000);
});

document.addEventListener('csvDataLoaded', () => {
    setTimeout(() => {
        if (window.app && window.app.forceSetupSearchEventsDelayed) {
            /* console.log('🚨 BACKUP: Search Events nach CSV-Upload'); */
            window.app.forceSetupSearchEventsDelayed();
        }
    }, 1000);
});