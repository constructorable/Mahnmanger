class MahnstufenConfig {
    static get MAHNSTUFEN() {
        return {
            1: {
                id: 1, name: 'Zahlungserinnerung', shortName: 'Zahlungserinnerung', color: '#557189',
                icon: 'fa-info-circle', tonfall: 'freundlich', gebuhren: 0.00,
                zahlungsfrist: 10, fristTage: 14
            },
            2: {
                id: 2, name: '1. Mahnung', shortName: '1. Mahnung', color: '#557189',
                icon: 'fa-exclamation-triangle', tonfall: 'bestimmt', gebuhren: 10.00,
                zahlungsfrist: 7, fristTage: 10
            },
            3: {
                id: 3, name: '2. Mahnung', shortName: '2. Mahnung', color: '#557189',
                icon: 'fa-ban', tonfall: 'scharf', gebuhren: 10.00,
                zahlungsfrist: 7, fristTage: 10
            }
        };
    }

    static get DEFAULT_MAHNSTUFE() { return 1; }
    static get VERSION() { return '4.1'; }
    static get MAX_GEBUEHR() { return 999.99; }
    static get STORAGE_KEY() { return 'mahnstufen_data'; }

    static get TEXT_POSITIONS() {
        return {
            'after-table': 'Nach der Tabelle',
            'before-bank': 'Vor den Bankdaten',
            'before-closing': 'Vor der Grußformel'
        };
    }
}

class MahnstufenUtils {
    static parseBetrag(betrag) {
        if (!betrag) return 0;
        const cleanStr = String(betrag).replace(/[^\d,.-]/g, '').replace(',', '.');
        const parsed = parseFloat(cleanStr);
        return isNaN(parsed) ? 0 : parsed;
    }

    static formatCurrency(betrag) {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(betrag);
    }

    static calculatePaymentDeadline(tage) {
        const zahlungsziel = new Date(Date.now() + (tage * 24 * 60 * 60 * 1000));
        return zahlungsziel.toLocaleDateString('de-DE', { 
            year: 'numeric', month: 'long', day: 'numeric' 
        });
    }

    static isValidMahnstufe(stufe) {
        return stufe >= 1 && stufe <= 3;
    }

    static isValidGebuehr(betrag) {
        return betrag >= 0 && betrag <= MahnstufenConfig.MAX_GEBUEHR;
    }

    static showNotification(message, type = 'info') {
        if (typeof Utils !== 'undefined' && Utils.showNotification) {
            Utils.showNotification(message, type);
        } else {
           /*  console.log(`[${type.toUpperCase()}] ${message}`); */
        }
    }

    static createIcon(iconClass, title = '') {
        return `<i class="fas fa-${iconClass}"${title ? ` title="${title}"` : ''}></i>`;
    }
}

class MahnstufenManager {


    initializeTenants(tenantIds) {
        if (!Array.isArray(tenantIds)) {
            /* console.error('initializeTenants: tenantIds muss ein Array sein'); */
            return;
        }

        let newTenants = 0;
        tenantIds.forEach(tenantId => {
            if (!this.tenantMahnstufen.has(tenantId)) {
                this.tenantMahnstufen.set(tenantId, this.defaultMahnstufe);
                newTenants++;
            }
        });

        if (newTenants > 0) {
            this.saveToStorage();
            /* console.log(`${newTenants} neue Mieter in Mahnstufen-System initialisiert`); */
        }
    }

    getIndividualMahngebuehr(tenantId, mahnstufe = null) {
        if (mahnstufe === 1) return 0;

        // NEU: Prüfe zuerst, ob eine individuelle Gebühr gesetzt ist
        if (this.individualMahngebuehren.has(tenantId)) {
            return this.individualMahngebuehren.get(tenantId);
        }

        // NEU: Falls keine individuelle Gebühr, verwende CSV-Mahngebühr
        if (window.app?.tenantManager?.getCSVMahngebuehr) {
            const csvMahngebuehr = window.app.tenantManager.getCSVMahngebuehr(tenantId);
            /* console.log(`Verwende CSV-Mahngebühr für ${tenantId}: ${MahnstufenUtils.formatCurrency(csvMahngebuehr)}`); */
            return csvMahngebuehr;
        }

        // Fallback auf Standard-Mahnstufen-Gebühr
        const currentMahnstufe = mahnstufe || this.getMahnstufe(tenantId);
        return this.getMahnstufeConfig(currentMahnstufe).gebuhren;
    }

    // NEU: CSV-Mahngebühren für UI-Anzeige
    getCSVMahngebuehrForDisplay(tenantId) {
        if (window.app?.tenantManager?.getCSVMahngebuehr) {
            return window.app.tenantManager.getCSVMahngebuehr(tenantId);
        }
        return 10.00;
    }

    createMahngebuehrenInput(tenantId) {
        const currentMahnstufe = this.getMahnstufe(tenantId);

        if (currentMahnstufe < 2) {
            return '<div class="mahngebuehren-input-hidden"></div>';
        }

        const currentGebuehrer = this.getIndividualMahngebuehr(tenantId, currentMahnstufe);
        const csvGebuehrer = this.getCSVMahngebuehrForDisplay(tenantId);
        const standardGebuehrer = this.getMahnstufeConfig(currentMahnstufe).gebuhren;
        const isIndividual = this.hasIndividualMahngebuehr(tenantId);

        return `
        <div class="mahngebuehren-input-container" data-tenant-id="${tenantId}">
            <div class="mahngebuehren-header">
                <label class="mahngebuehren-label">
                    ${MahnstufenUtils.createIcon('euro-sign')} 
                    Mahngebühren:
                </label>
                <div class="csv-info" style="font-size: 11px; color: #666; margin-top: 2px;">
                    Standard: ${MahnstufenUtils.formatCurrency(csvGebuehrer)}
                </div>
            </div>
            <div class="mahngebuehren-input-group">
                <div class="input-with-currency">
                    <input type="number" 
                           id="mahngebuehr-${tenantId}" 
                           class="mahngebuehren-input"
                           data-tenant-id="${tenantId}"
                           value="${currentGebuehrer.toFixed(2)}" 
                           min="0" 
                           max="${MahnstufenConfig.MAX_GEBUEHR}" 
                           step="0.01"
                           placeholder="${csvGebuehrer.toFixed(2)}"
                           onchange="mahnstufen.handleMahngebuehrChange('${tenantId}', this.value)"
                           oninput="mahnstufen.validateMahngebuehrInput(this)">
                    <span class="currency-symbol">€</span>
                </div>
                <button type="button" class="btn btn-small reset-gebuehr-btn" 
                        onclick="mahnstufen.resetMahngebuehrToCSV('${tenantId}')"
                        title="Auf CSV-Standard zurücksetzen">
                    ${MahnstufenUtils.createIcon('undo')} CSV
                </button>
            </div>
        </div>`;
    }

    // NEU: Auf CSV-Standard zurücksetzen
    resetMahngebuehrToCSV(tenantId) {
        const csvGebuehrer = this.getCSVMahngebuehrForDisplay(tenantId);
        
        this.removeIndividualMahngebuehr(tenantId);

        const input = document.getElementById(`mahngebuehr-${tenantId}`);
        if (input) {
            input.value = csvGebuehrer.toFixed(2);
            input.style.borderColor = '';
            input.style.backgroundColor = '';
        }

        this.updateMahngebuehrDisplay(tenantId);
        this.updateTotalPreview(tenantId);

        MahnstufenUtils.showNotification(
            `Mahngebühr für ${tenantId} auf CSV-Standard zurückgesetzt: ${MahnstufenUtils.formatCurrency(csvGebuehrer)}`, 
            'info'
        );
    }


    constructor() {
        this.MAHNSTUFEN = MahnstufenConfig.MAHNSTUFEN;
        this.defaultMahnstufe = MahnstufenConfig.DEFAULT_MAHNSTUFE;
        this.tenantMahnstufen = new Map();
        this.individualMahngebuehren = new Map();
    }

    setMahnstufe(tenantId, stufe) {
        if (!MahnstufenUtils.isValidMahnstufe(stufe)) {
            /* console.error('Ungültige Mahnstufe:', stufe); */
            return false;
        }

        const oldStufe = this.getMahnstufe(tenantId);
        this.tenantMahnstufen.set(tenantId, stufe);
        this.saveToStorage();

        if (oldStufe !== stufe) {
            setTimeout(() => this.refreshMahngebuehrenUI(tenantId), 100);
        }

        return true;
    }

    getMahnstufe(tenantId) {
        return this.tenantMahnstufen.get(tenantId) || this.defaultMahnstufe;
    }

    getMahnstufeConfig(stufe) {
        return this.MAHNSTUFEN[stufe] || this.MAHNSTUFEN[1];
    }

    getAllMahnstufen() {
        return Object.values(this.MAHNSTUFEN);
    }

    setIndividualMahngebuehr(tenantId, betrag) {
        const cleanBetrag = MahnstufenUtils.parseBetrag(betrag);
        if (!MahnstufenUtils.isValidGebuehr(cleanBetrag)) {
            console.error('Ungültiger Mahngebühren-Betrag:', betrag);
            return false;
        }

        this.individualMahngebuehren.set(tenantId, cleanBetrag);
        this.saveToStorage();
        console.log(`Mahngebühr für ${tenantId}: ${MahnstufenUtils.formatCurrency(cleanBetrag)}`);
        return true;
    }



    removeIndividualMahngebuehr(tenantId) {
        const removed = this.individualMahngebuehren.delete(tenantId);
        if (removed) {
            this.saveToStorage();
            console.log(`Individuelle Mahngebühr für ${tenantId} entfernt`);
        }
        return removed;
    }

    hasIndividualMahngebuehr(tenantId) {
        return this.individualMahngebuehren.has(tenantId);
    }

    calculateTotalAmountWithFees(tenantId, schuldenBetrag) {
        const currentMahnstufe = this.getMahnstufe(tenantId);
        const mahngebuehr = this.getIndividualMahngebuehr(tenantId, currentMahnstufe);
        return schuldenBetrag + mahngebuehr;
    }

    getMahngebuehrText(tenantId) {
        const currentMahnstufe = this.getMahnstufe(tenantId);
        const mahngebuehr = this.getIndividualMahngebuehr(tenantId, currentMahnstufe);

        if (mahngebuehr <= 0) return '';
        return `Zusätzlich erheben wir Mahngebühren in Höhe von ${MahnstufenUtils.formatCurrency(mahngebuehr)}.`;
    }

    createMahnstufeSelector(tenantId) {
        const currentStufe = this.getMahnstufe(tenantId);
        const options = this.getAllMahnstufen().map(stufe => `
            <label class="mahnstufe-option">
                <input type="radio" name="mahnstufe_${tenantId}" value="${stufe.id}" 
                       ${stufe.id === currentStufe ? 'checked' : ''}
                       onchange="mahnstufen.handleMahnstufeChange('${tenantId}', ${stufe.id})">
                <span class="mahnstufe-badge" style="background-color: ${stufe.color};">
                    ${MahnstufenUtils.createIcon(stufe.icon)} ${stufe.shortName}
                </span>
                <span class="mahnstufe-name">${stufe.name}</span>
            </label>
        `).join('');

        return `
        <div class="mahnstufe-selector" data-tenant-id="${tenantId}">
          
            <div class="mahnstufe-options">${options}</div>
        </div>`;
    }

  
     handleMahnstufeChange(tenantId, neueStufe) {
        if (this.setMahnstufe(tenantId, neueStufe)) {
            this.updateMahnstufeDisplay(tenantId, neueStufe);
            const tenant = window.app?.tenantManager?.getTenant(tenantId);
            const portfolioInfo = tenant?.portfolio ? ` (${tenant.portfolio})` : '';
            
            // Refresh der Textbearbeitungssektion bei Mahnstufen-Wechsel
            if (window.app?.refreshTextEditingSection) {
                window.app.refreshTextEditingSection(tenantId);
            }
            
            // Refresh der Mahngebühren-UI
            setTimeout(() => this.refreshMahngebuehrenUI(tenantId), 100);
        }
    }

    handleMahngebuehrChange(tenantId, newValue) {
        const cleanValue = MahnstufenUtils.parseBetrag(newValue);

        if (!MahnstufenUtils.isValidGebuehr(cleanValue)) {
            MahnstufenUtils.showNotification(
                `Mahngebühr muss zwischen 0,00 € und ${MahnstufenUtils.formatCurrency(MahnstufenConfig.MAX_GEBUEHR)} liegen.`, 
                'error'
            );
            return;
        }

        if (this.setIndividualMahngebuehr(tenantId, cleanValue)) {
            this.updateMahngebuehrDisplay(tenantId);
            this.updateTotalPreview(tenantId);

            const tenant = window.app?.tenantManager?.getTenant(tenantId);
            const portfolioInfo = tenant?.portfolio ? ` (${tenant.portfolio})` : '';

            MahnstufenUtils.showNotification(
                `Mahngebühr für ${tenantId}${portfolioInfo}: ${MahnstufenUtils.formatCurrency(cleanValue)}`, 
                'success'
            );
        }
    }

    validateMahngebuehrInput(inputElement) {
        const value = parseFloat(inputElement.value);
        const tenantId = inputElement.dataset.tenantId;

        if (!MahnstufenUtils.isValidGebuehr(value)) {
            inputElement.style.borderColor = '#e74c3c';
            inputElement.style.backgroundColor = '#fdf2f2';
        } else {
            inputElement.style.borderColor = '#27ae60';
            inputElement.style.backgroundColor = '#f8fff8';
        }

        this.updateTotalPreview(tenantId);
    }

    updateMahnstufeDisplay(tenantId, stufe) {
        const config = this.getMahnstufeConfig(stufe);
        const mahnstufeBadge = document.querySelector(`[data-tenant-id="${tenantId}"] .mahnstufe-current`);

        if (mahnstufeBadge) {
            mahnstufeBadge.innerHTML = `${MahnstufenUtils.createIcon(config.icon)} ${config.shortName}`;
            mahnstufeBadge.style.backgroundColor = config.color;
            mahnstufeBadge.title = config.name;
        }
    }

    updateMahngebuehrDisplay(tenantId) {
        const container = document.querySelector(`[data-tenant-id="${tenantId}"] .mahngebuehren-input-container`);
        if (!container) return;

        const currentMahnstufe = this.getMahnstufe(tenantId);
        const isIndividual = this.hasIndividualMahngebuehr(tenantId);
        const resetBtn = container.querySelector('.reset-gebuehr-btn');
        const infoSpan = container.querySelector('.standard-info');
        const standardGebuehrer = this.getMahnstufeConfig(currentMahnstufe).gebuhren;

        if (resetBtn) resetBtn.disabled = !isIndividual;

        if (infoSpan) {
            infoSpan.className = `standard-info ${isIndividual ? 'custom-active' : 'standard-active'}`;
            infoSpan.innerHTML = `
                ${isIndividual ? 
                    `${MahnstufenUtils.createIcon('user-edit')} Individuell` : 
                    `${MahnstufenUtils.createIcon('cog')} Standard`
                }
                (Standard: ${MahnstufenUtils.formatCurrency(standardGebuehrer)})
            `;
        }
    }

    updateTotalPreview(tenantId) {
        const previewElement = document.getElementById(`total-preview-${tenantId}`);
        if (!previewElement) return;

        const tenant = window.app?.tenantManager?.getTenant(tenantId);
        if (!tenant) return;

        const totalDifference = window.app.tenantManager.calculateTenantTotal(tenant);
        const schuldenBetrag = Math.abs(totalDifference);
        const currentMahnstufe = this.getMahnstufe(tenantId);
        const mahngebuehr = this.getIndividualMahngebuehr(tenantId, currentMahnstufe);
        const gesamtbetrag = schuldenBetrag + mahngebuehr;

        previewElement.innerHTML = `
            <span class="schulden-betrag">${MahnstufenUtils.formatCurrency(schuldenBetrag)}</span>
            ${mahngebuehr > 0 ? 
                ` + <span class="mahngebuehr-betrag">${MahnstufenUtils.formatCurrency(mahngebuehr)}</span>` : 
                ''
            }
            = <span class="gesamt-betrag"><strong>${MahnstufenUtils.formatCurrency(gesamtbetrag)}</strong></span>
        `;
    }

    refreshMahngebuehrenUI(tenantId) {
        const tenantCard = document.querySelector(`[data-tenant-id="${tenantId}"]`);
        if (!tenantCard) return;

        const mahngebuehrenContainer = tenantCard.querySelector('.mahngebuehren-input-container');
        const currentMahnstufe = this.getMahnstufe(tenantId);

        if (currentMahnstufe < 2) {
            if (mahngebuehrenContainer) {
                mahngebuehrenContainer.style.display = 'none';
            }
        } else {
            if (mahngebuehrenContainer) {
                mahngebuehrenContainer.style.display = 'block';
                this.updateMahngebuehrDisplay(tenantId);
                this.updateTotalPreview(tenantId);
            } else {
                this.recreateMahngebuehrenInput(tenantId);
            }
        }
    }

    recreateMahngebuehrenInput(tenantId) {
        const masterDataTable = document.querySelector(`[data-tenant-id="${tenantId}"] .master-data-table`);
        if (!masterDataTable) return;

        const existingContainer = masterDataTable.querySelector('.mahngebuehren-input-container');
        if (existingContainer) existingContainer.remove();

        const newInput = document.createElement('div');
        newInput.innerHTML = this.createMahngebuehrenInput(tenantId);
        masterDataTable.appendChild(newInput.firstElementChild);
    }

    resetMahngebuehrToDefault(tenantId) {
        const currentMahnstufe = this.getMahnstufe(tenantId);
        const standardGebuehrer = this.getMahnstufeConfig(currentMahnstufe).gebuhren;

        this.removeIndividualMahngebuehr(tenantId);

        const input = document.getElementById(`mahngebuehr-${tenantId}`);
        if (input) {
            input.value = standardGebuehrer.toFixed(2);
            input.style.borderColor = '';
            input.style.backgroundColor = '';
        }

        this.updateMahngebuehrDisplay(tenantId);
        this.updateTotalPreview(tenantId);

        MahnstufenUtils.showNotification(
            `Mahngebühr für ${tenantId} auf Standard zurückgesetzt: ${MahnstufenUtils.formatCurrency(standardGebuehrer)}`, 
            'info'
        );
    }

   

    removeTenant(tenantId) {
        const removedMahnstufe = this.tenantMahnstufen.delete(tenantId);
        const removedGebuehr = this.individualMahngebuehren.delete(tenantId);

        if (removedMahnstufe || removedGebuehr) {
            this.saveToStorage();
            console.log(`Mieter ${tenantId} aus Mahnstufen-System entfernt`);
        }

        return removedMahnstufe || removedGebuehr;
    }

    setBulkMahnstufe(stufe, tenantIds = null, portfolioName = null) {
        if (!MahnstufenUtils.isValidMahnstufe(stufe)) {
            console.error('Ungültige Mahnstufe:', stufe);
            return false;
        }

        let idsToUpdate = tenantIds || Array.from(this.tenantMahnstufen.keys());

        if (portfolioName && window.app?.tenantManager) {
            const portfolioTenants = Array.from(window.app.tenantManager.tenants.values())
                .filter(tenant => tenant.portfolio === portfolioName)
                .map(tenant => tenant.id);

            idsToUpdate = tenantIds ?
                idsToUpdate.filter(id => portfolioTenants.includes(id)) :
                portfolioTenants;
        }

        const updateCount = idsToUpdate.filter(tenantId => this.setMahnstufe(tenantId, stufe)).length;
        const portfolioInfo = portfolioName ? ` in Portfolio "${portfolioName}"` : '';
        
        MahnstufenUtils.showNotification(
            `${updateCount} Mieter${portfolioInfo} auf Mahnstufe ${this.getMahnstufeConfig(stufe).name} gesetzt.`, 
            'success'
        );

        return updateCount > 0;
    }

    getMahnstufeStatistics() {
        const stats = { stufe1: 0, stufe2: 0, stufe3: 0, total: this.tenantMahnstufen.size };
        this.tenantMahnstufen.forEach(stufe => {
            if (stufe >= 1 && stufe <= 3) {
                stats[`stufe${stufe}`]++;
            }
        });
        return stats;
    }

    getPortfolioMahnstufeStatistics(portfolioName) {
        if (!window.app?.tenantManager) {
            return { stufe1: 0, stufe2: 0, stufe3: 0, total: 0 };
        }

        const portfolioTenants = Array.from(window.app.tenantManager.tenants.values())
            .filter(tenant => tenant.portfolio === portfolioName);

        const stats = { stufe1: 0, stufe2: 0, stufe3: 0, total: portfolioTenants.length };

        portfolioTenants.forEach(tenant => {
            const mahnstufe = this.getMahnstufe(tenant.id);
            if (mahnstufe >= 1 && mahnstufe <= 3) {
                stats[`stufe${mahnstufe}`]++;
            }
        });

        return stats;
    }

    createPortfolioMahnstufeControls(portfolioName) {
        const stats = this.getPortfolioMahnstufeStatistics(portfolioName);
        const mahnstufen = this.getAllMahnstufen();

        const buttons = mahnstufen.map(stufe => `
            <button class="btn btn-small portfolio-mahnstufe-btn" 
                    style="background-color: ${stufe.color}; color: white; border: none;"
                    onclick="mahnstufen.setBulkMahnstufe(${stufe.id}, null, '${portfolioName}')"
                    title="Alle Mieter in ${portfolioName} auf ${stufe.name} setzen">
                ${MahnstufenUtils.createIcon(stufe.icon)} ${stufe.shortName} (${stats[`stufe${stufe.id}`] || 0})
            </button>
        `).join('');

        return `
        <div class="portfolio-mahnstufe-controls">
            <label class="control-label">
                ${MahnstufenUtils.createIcon('clipboard-check')} Mahnstufen für Portfolio "${portfolioName}":
            </label>
            <div class="mahnstufe-buttons">${buttons}</div>
            <div class="portfolio-stats">
                Gesamt: ${stats.total} Mieter | ZE: ${stats.stufe1} | 1. Mahnung: ${stats.stufe2} | 2. Mahnung: ${stats.stufe3}
            </div>
        </div>`;
    }

    cleanup() {
        if (!window.app?.tenantManager) return;

        const existingTenants = new Set(window.app.tenantManager.getAllTenants().map(t => t.id));
        let removedMahnstufen = 0, removedGebuehren = 0;

        this.tenantMahnstufen.forEach((stufe, tenantId) => {
            if (!existingTenants.has(tenantId)) {
                this.tenantMahnstufen.delete(tenantId);
                removedMahnstufen++;
            }
        });

        this.individualMahngebuehren.forEach((gebuehr, tenantId) => {
            if (!existingTenants.has(tenantId)) {
                this.individualMahngebuehren.delete(tenantId);
                removedGebuehren++;
            }
        });

        if (removedMahnstufen > 0 || removedGebuehren > 0) {
            this.saveToStorage();
            console.log(`Cleanup: ${removedMahnstufen} Mahnstufen, ${removedGebuehren} Gebühren entfernt`);
        }
    }

    saveToStorage() {
        try {
            const data = {
                tenantMahnstufen: Array.from(this.tenantMahnstufen.entries()),
                individualMahngebuehren: Array.from(this.individualMahngebuehren.entries()),
                timestamp: Date.now(),
                version: MahnstufenConfig.VERSION
            };
            localStorage.setItem(MahnstufenConfig.STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error('Fehler beim Speichern der Mahnstufen:', error);
        }
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem(MahnstufenConfig.STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                this.tenantMahnstufen = new Map(parsed.tenantMahnstufen || []);
                this.individualMahngebuehren = new Map(parsed.individualMahngebuehren || []);

                const currentVersion = parseFloat(parsed.version || '1.0');
                if (currentVersion < parseFloat(MahnstufenConfig.VERSION)) {
                    /* console.log(`Migriere Mahnstufen-Daten von v${currentVersion} zu v${MahnstufenConfig.VERSION}...`); */
                    this.saveToStorage();
                }

                /* console.log(`Mahnstufen-Daten geladen: ${this.tenantMahnstufen.size} Mieter, ${this.individualMahngebuehren.size} individuelle Gebühren`); */
                return true;
            }
        } catch (error) {
            console.error('Fehler beim Laden der Mahnstufen:', error);
            this.tenantMahnstufen = new Map();
            this.individualMahngebuehren = new Map();
        }
        return false;
    }

    getStyles() {
        return `
        .mahnstufe-selector {
            margin: 10px 0; padding: 15px; background: #f8f9fa; 
            border-radius: 8px; border: 1px solid #dee2e6;
        }
        `;
   }

   debugShowAllMahnstufen() {
/*        console.log('=== MAHNSTUFEN DEBUG ===');
       console.log('Anzahl Mieter:', this.tenantMahnstufen.size);
       console.log('Individuelle Gebühren:', this.individualMahngebuehren.size); */

       const stats = this.getMahnstufeStatistics();
   /*     console.log('Statistiken:', stats); */

       if (this.tenantMahnstufen.size < 20) {
           /* console.log('Alle Mahnstufen:'); */
           this.tenantMahnstufen.forEach((stufe, tenantId) => {
               const gebuehr = this.getIndividualMahngebuehr(tenantId, stufe);
              /*  console.log(`  ${tenantId}: Stufe ${stufe}, Gebühr: ${MahnstufenUtils.formatCurrency(gebuehr)}`); */
           });
       }
      /*  console.log('====================='); */
   }
}

const mahnstufen = new MahnstufenManager();

document.addEventListener('DOMContentLoaded', () => {
   mahnstufen.loadFromStorage();
   const styleSheet = document.createElement('style');
   styleSheet.textContent = mahnstufen.getStyles();
   document.head.appendChild(styleSheet);
});

if (typeof module !== 'undefined' && module.exports) {
   module.exports = MahnstufenManager;
}

/* console.log(`Mahnstufen-Manager v${MahnstufenConfig.VERSION} geladen`); */