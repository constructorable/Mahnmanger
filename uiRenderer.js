// Fügen Sie am Anfang der uiRenderer.js hinzu:
class UIBatcher {
    constructor() {
        this.pending = false;
        this.callbacks = [];
    }

    batch(callback) {
        this.callbacks.push(callback);
        if (!this.pending) {
            this.pending = true;
            requestAnimationFrame(() => {
                this.callbacks.forEach(cb => cb());
                this.callbacks = [];
                this.pending = false;
            });
        }
    }
}

const uiBatcher = new UIBatcher();

class UIRendererConfig {
    static get MOBILE_BREAKPOINT() { return 768; }
    static get DEFAULT_STREET() { return 'Unbekannte Straße'; }
    static get MAX_TEXT_LENGTH() { return 500; }
    static get STORAGE_PREFIX() { return 'mahnmanager_usertext_'; }

    static get STAT_ICONS() {
        return {
            'users': 'users',
            'clipboard-list': 'clipboard-list',
            'euro-sign-debt': 'euro-sign',
            'euro-sign-ok': 'check-circle',
            'exclamation-triangle': 'exclamation-triangle'
        };
    }

    static get STAT_COLORS() {
        return {
            'users': '--info-color',
            'clipboard-list': '--warning-color',
            'euro-sign-debt': '--dark-color',
            'euro-sign-ok': '--success-color',
            'exclamation-triangle': '--accent-color'
        };
    }

    static get TEXT_POSITIONS() {
        return {
            'after-table': 'Nach Tabelle',
            'before-bank': 'Vor Bankdaten',
            'before-closing': 'Vor Grußformel'
        };
    }
}

class UIRendererUtils {
    static isMobile() {
        return window.innerWidth <= UIRendererConfig.MOBILE_BREAKPOINT;
    }

    static escapeForSelector(streetName) {
        return streetName.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
    }

    static calculateRecordAmounts(record) {
        const sollAmount = Utils.parseAmount(record['soll']);
        const habenAmount = Utils.parseAmount(record['haben']);
        return { sollAmount, habenAmount, difference: habenAmount - sollAmount };
    }

    static formatIBAN(iban) {
        if (!iban) return '';
        return iban.replace(/(.{4})/g, '$1 ').trim();
    }

    static getColorClass(value) {
        if (value < 0) return 'has-debt';
        if (value > 0) return 'no-debt';
        return 'neutral';
    }

    static createIcon(iconClass, title = '') {
        return `<i class="fas fa-${iconClass}"${title ? ` title="${title}"` : ''}></i>`;
    }
}

class UIRenderer {
    constructor(tenantManager) {
        this.tenantManager = tenantManager;
        this.collapsedStreets = new Set();
        this.autoCollapseOnLoad = true;
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

        // Textbearbeitungssektion aktualisieren
        this.refreshTextEditingSection(tenantId);
    }


    groupTenantsByStreet(tenants) {
        const grouped = {};

        if (tenants instanceof Map) {
            tenants.forEach(tenant => {
                const street = tenant.street || 'Unbekannte Straße';

                // ✅ KORREKTUR: Verwende Array statt Map
                if (!grouped[street]) {
                    grouped[street] = [];
                }
                grouped[street].push(tenant);
            });
        } else if (Array.isArray(tenants)) {
            tenants.forEach(tenant => {
                const street = tenant.street || 'Unbekannte Straße';

                if (!grouped[street]) {
                    grouped[street] = [];
                }
                grouped[street].push(tenant);
            });
        }

        return grouped;
    }




    createQuickActionButtons(streetName, hasTenantsWithDebt, isCollapsed = false) {
        const escapedStreet = Utils.escapeHtml(streetName);

        return `
        <button class="btn btn-small quick-action-btn generate-btn ${!hasTenantsWithDebt ? 'disabled' : ''}"
                onclick="app.generateAllInvoicesForStreet('${escapedStreet}')"
                title="Alle Mahnungen für ${escapedStreet} erstellen"
                ${!hasTenantsWithDebt ? 'disabled' : ''}>
            ${UIRendererUtils.createIcon('file-invoice-dollar')}
        </button>
       
        <button class="btn btn-small quick-action-btn generate-selected-btn"
                onclick="app.generateSelectedInvoicesForStreet('${escapedStreet}')"
                title="Nur ausgewählte Mahnungen für ${escapedStreet} erstellen"
                style="background-color: #e6ebef; color: white;">
            ${UIRendererUtils.createIcon('bullseye')}
        </button>
       
        <button class="btn btn-small quick-action-btn select-all-btn"
                onclick="app.selectAllInStreet('${escapedStreet}')"
                title="Alle Mieter in ${escapedStreet} auswählen">
            ${UIRendererUtils.createIcon('check-square')}
        </button>
       
        <button class="btn btn-small quick-action-btn deselect-all-btn"
                onclick="app.deselectAllInStreet('${escapedStreet}')"
                title="Alle Mieter in ${escapedStreet} abwählen">
            ${UIRendererUtils.createIcon('minus-square')}
        </button>
    `;
    }
    // In uiRenderer.js - CSS-Styles erweitern:
    getAdditionalStyles() {
        return `
        .generate-selected-btn {
            background-color: #28a745 !important;
            color: white !important;
        }
        
        .generate-selected-btn:hover {
            background-color: #218838 !important;
            transform: translateY(-1px);
        }
        
        .generate-selected-btn:disabled {
            background-color: #6c757d !important;
            cursor: not-allowed;
            opacity: 0.6;
        }
    `;
    }



    createStatCard(icon, value, label) {
        const colorType = icon === 'euro-sign' && value.includes('-') || parseFloat(value.toString().replace(/[^\d.,]/g, '').replace(',', '.')) > 0 ? 'euro-sign-debt' : icon;
        const colorVar = UIRendererConfig.STAT_COLORS[colorType] || '--primary-color';

        return `
        <div class="stat-card" style="border-left: 4px solid var(${colorVar});">
            <div class="stat-icon" style="color: var(${colorVar});">
                ${UIRendererUtils.createIcon(icon)}
            </div>
            <div class="stat-content">
                <div class="stat-value">${value}</div>
                <div class="stat-label">${label}</div>
            </div>
        </div>`;
    }





    createStreetActionButtons(streetName, hasDebtors) {
        return `
        <button class="btn btn-small street-select-all" onclick="app.selectAllInStreet('${streetName}')">
            ${UIRendererUtils.createIcon('check-square')} Alle auswählen
        </button>
        <button class="btn btn-small street-deselect-all" onclick="app.deselectAllInStreet('${streetName}')">
            ${UIRendererUtils.createIcon('square')} Alle abwählen
        </button>
        ${hasDebtors ? `
            <button class="btn btn-small btn-primary street-generate-all" 
                    onclick="app.generateAllInvoicesForStreet('${streetName}')" 
                    title="Alle Mahnungen für ${streetName} erstellen">
                ${UIRendererUtils.createIcon('file-invoice-dollar')} Alle Mahnungen
            </button>
        ` : ''}`;
    }

    createTenantListHeader() {
        const headers = ['', '', 'Mietschulden', 'Mieter-ID', 'Positionen', 'Aktion', ''];
        const icons = ['', '', 'credit-card', 'id-card', 'list', 'cogs', ''];

        return `
        <div class="tenant-list-header">
            ${headers.map((header, i) => `
                <div>${icons[i] ? UIRendererUtils.createIcon(icons[i]) + ' ' : ''}${header}</div>
            `).join('')}
        </div>`;
    }

    createCollapsibleTenantCard(tenantId, tenant) {
        const totalDifference = this.tenantManager.calculateTenantTotal(tenant);
        const enabledCount = tenant.records.filter(r => r.enabled).length;
        const hasDebt = totalDifference < 0;
        const currentMahnstufe = mahnstufen?.getMahnstufe(tenantId) || 1;
        const mahnstufenConfig = mahnstufen?.getMahnstufeConfig(currentMahnstufe);

        return `
        <div class="tenant-card" data-tenant-id="${tenantId}">
            <div class="tenant-header" onclick="app.toggleTenantExpansion('${tenantId}')">
                ${this.createTenantHeaderContent(tenantId, tenant, totalDifference, enabledCount, hasDebt, mahnstufenConfig)}
            </div>
            <div class="tenant-details" id="details-${tenantId}">
                ${this.createTenantMasterData(tenant)}
                ${this.createCostPositionsSection(tenantId, tenant)}
            </div>
        </div>`;
    }

    createTenantHeaderContent(tenantId, tenant, totalDifference, enabledCount, hasDebt, mahnstufenConfig) {
        const debtAmount = Math.abs(totalDifference);
        const debtClass = UIRendererUtils.getColorClass(totalDifference);
        const csvMahngebuehr = window.app?.tenantManager?.getCSVMahngebuehr?.(tenantId) || 10.00;

        return `
       <input type="checkbox" class="tenant-checkbox" data-tenant-id="${tenantId}" 
              ${tenant.selected ? 'checked' : ''} onclick="event.stopPropagation()">
       <div class="tenant-name">
           ${UIRendererUtils.createIcon('user')} ${Utils.escapeHtml(tenant.name)}
           ${mahnstufenConfig ? `
               <span class="mahnstufe-current" style="background-color: ${mahnstufenConfig.color};" title="${mahnstufenConfig.name}">
                   ${UIRendererUtils.createIcon(mahnstufenConfig.icon)} ${mahnstufenConfig.shortName}
               </span>
           ` : ''}
           ${tenant.hasAnwalt ? `
               <span class="anwalt-badge" title="Fall beim Anwalt">
                   ${UIRendererUtils.createIcon('balance-scale')} Anwalt
               </span>
           ` : ''}
           <span class="csv-mahngebuehr-badge" title="CSV-Mahngebühr: ${Utils.formatAmount(csvMahngebuehr)}">
               ${UIRendererUtils.createIcon('euro-sign')} ${Utils.formatAmount(csvMahngebuehr)}
           </span>
       </div>
       <div class="tenant-debt ${debtClass}">
           ${this.formatDebtAmount(totalDifference, debtAmount)}
       </div>
       <div class="tenant-id-display">${UIRendererUtils.createIcon('hashtag')} ${Utils.escapeHtml(tenantId)}</div>
       <div class="position-count">${UIRendererUtils.createIcon('tasks')} ${enabledCount}/${tenant.records.length}</div>
       <div class="tenant-action">
           ${this.createTenantActionButton(tenantId, hasDebt, mahnstufenConfig)}
       </div>
       <div class="expand-indicator" onclick="event.stopPropagation(); app.toggleTenantExpansion('${tenantId}')">
           ${UIRendererUtils.createIcon('chevron-down')}
       </div>`;
    }

    formatDebtAmount(totalDifference, debtAmount) {
        if (totalDifference < 0) return Utils.formatAmount(debtAmount);
        if (totalDifference > 0) return '+' + Utils.formatAmount(debtAmount);
        return `${UIRendererUtils.createIcon('equals')} 0,00 €`;
    }

    createTenantActionButton(tenantId, hasDebt, mahnstufenConfig) {
        if (hasDebt) {
            const title = mahnstufenConfig ? mahnstufenConfig.name + ' erstellen' : 'Mahnung erstellen';
            return `
        <button class="btn-single-invoice enabled"
                onclick="event.stopPropagation(); window.mailSend.showActionModal('${tenantId}')"
                title="${title}">
            ${UIRendererUtils.createIcon('file-invoice')}
        </button>`;
        }
        return `<span class="no-debt-indicator" title="Keine Schulden vorhanden">
        ${UIRendererUtils.createIcon('check-circle')}
    </span>`;
    }

    createTenantMasterData(tenant) {
        const totalDifference = this.tenantManager.calculateTenantTotal(tenant);
        const enabledCount = tenant.records.filter(r => r.enabled).length;
        const address = `${tenant.street}, ${tenant.plz} ${tenant.city}`;

        return `
    <div class="tenant-master-data">
        <div class="master-data-header">
            <h4 class="master-data-title">
                ${UIRendererUtils.createIcon('database')} Stammdaten
                ${tenant.hasAnwalt ? this.createAnwaltBadge(true) : ''}
            </h4>
            <button class="single-invoice-btn btn-icon" 
                    onclick="window.app.generateSingleInvoice('${tenant.id}')"
                    title="Einzelrechnung erstellen">
                ${UIRendererUtils.createIcon('file-invoice')}
            </button>
        </div>
        <div class="master-data-table">
            ${this.createMasterDataRows(tenant, totalDifference, address, enabledCount)}
        </div>
        <div class="mahnstufe-section">
            ${mahnstufen?.createMahnstufeSelector ? mahnstufen.createMahnstufeSelector(tenant.id) :
                `<div class="mahnstufe-fallback">Mahnstufe: ${tenant.mahnstufe}</div>`}
        </div>
    </div>`;
    }


    createTextEditingSection(tenantId) {
        const currentMahnstufe = mahnstufen?.getMahnstufe(tenantId) || 1;
        const mahnstufenConfig = mahnstufen?.getMahnstufeConfig(currentMahnstufe);
        const texts = window.app.textManager.getTextForMahnstufe(currentMahnstufe, tenantId);

        return `
    <div class="text-editing-section collapsed" id="textEditing-${tenantId}">
        <div class="text-editing-header" onclick="window.app.toggleTextEditingSection('${tenantId}')">
            <h4 class="text-editing-title">
                <span class="text-editing-toggle-icon">
                    ${UIRendererUtils.createIcon('chevron-right')}
                </span>
                ${UIRendererUtils.createIcon('edit')} ${mahnstufenConfig?.name || 'Mahntext'} bearbeiten
            </h4>
            <div class="text-editing-controls" onclick="event.stopPropagation();">
                <button class="btn btn-small" onclick="window.app.resetTextsToDefault('${tenantId}', ${currentMahnstufe})" title="Auf Standard zurücksetzen">
                    ${UIRendererUtils.createIcon('undo')} Standard
                </button>
                <button class="btn btn-small" onclick="window.app.previewMahntext('${tenantId}', ${currentMahnstufe})" title="Vorschau anzeigen">
                    ${UIRendererUtils.createIcon('eye')} Vorschau
                </button>
            </div>
        </div>
        <div class="text-editing-content" style="display: none;">
            ${this.createTextEditFields(tenantId, currentMahnstufe, texts)}
        </div>
    </div>`;
    }

    createTextEditFields(tenantId, mahnstufe, texts) {
        const fields = [
            { key: 'einleitung', label: 'Einleitung', icon: 'align-left' },
            { key: 'zahlungsfrist', label: 'Zahlungsfrist', icon: 'calendar-alt' }
        ];

        if (mahnstufe === 3) {
            fields.push({ key: 'kuendigungstext', label: 'Kündigungstext', icon: 'exclamation-triangle' });
        }

        fields.push({ key: 'haupttext', label: 'Haupttext', icon: 'paragraph', hasDropdown: true });

        return fields.map(field => {
            const textValue = texts[field.key] || '';
            const charCount = textValue.length;
            const maxLength = 1000;

            let dropdownHtml = '';
            if (field.hasDropdown) {
                const standardSaetze = window.textManager.getStandardSaetze();
                dropdownHtml = `
            <div class="standard-saetze-dropdown">
                <label class="dropdown-label">
                    ${UIRendererUtils.createIcon('plus-circle')} Standardsatz hinzufügen:
                </label>
                <div class="standard-saetze-buttons">
                    <button type="button" class="btn btn-small standard-satz-btn" 
                            onclick="window.app.addStandardSatzToTextarea('textEdit-${tenantId}-${field.key}', 'satz1', '${tenantId}')">
                        ${UIRendererUtils.createIcon('plus')} Satz 1
                    </button>
                    <button type="button" class="btn btn-small standard-satz-btn" 
                            onclick="window.app.addStandardSatzToTextarea('textEdit-${tenantId}-${field.key}', 'satz2', '${tenantId}')">
                        ${UIRendererUtils.createIcon('plus')} Satz 2
                    </button>
                    <button type="button" class="btn btn-small standard-satz-btn" 
                            onclick="window.app.addStandardSatzToTextarea('textEdit-${tenantId}-${field.key}', 'satz3', '${tenantId}')">
                        ${UIRendererUtils.createIcon('plus')} Satz 3
                    </button>
                </div>
                <div class="standard-saetze-preview">
                    <div><strong>Satz 1:</strong> ${standardSaetze.satz1}</div>
                    <div><strong>Satz 2:</strong> ${standardSaetze.satz2}</div>
                    <div><strong>Satz 3:</strong> ${standardSaetze.satz3}</div>
                </div>
            </div>`;
            }

            return `
        <div class="text-edit-field">
            <label class="text-edit-label">
                ${UIRendererUtils.createIcon(field.icon)} ${field.label}
                <span class="char-counter" id="counter-${tenantId}-${field.key}">${charCount}/${maxLength}</span>
            </label>
            <textarea 
                class="text-edit-textarea" 
                id="textEdit-${tenantId}-${field.key}"
                data-tenant-id="${tenantId}"
                data-mahnstufe="${mahnstufe}"
                data-text-type="${field.key}"
                maxlength="${maxLength}"
                rows="${field.key === 'kuendigungstext' ? 6 : 4}"
                placeholder="Standard-${field.label} verwenden..."
            >${textValue}</textarea>
            ${dropdownHtml}
            <div class="text-variables-info">
                Verfügbare Variablen: {SCHULDEN_BETRAG}, {GESAMT_BETRAG}, {ZAHLUNGSFRIST}, {MIETER_NAME}
            </div>
        </div>`;
        }).join('');
    }

    setupTextEditingEvents() {
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('text-edit-textarea')) {
                const tenantId = e.target.dataset.tenantId;
                const mahnstufe = parseInt(e.target.dataset.mahnstufe);
                const textType = e.target.dataset.textType;
                const content = e.target.value;

                this.updateCharCounter(tenantId, textType, content);
                textManager.setCustomText(mahnstufe, textType, content, tenantId);
            }
        });
    }

    updateCharCounter(tenantId, textType, content) {
        const counter = document.getElementById(`counter-${tenantId}-${textType}`);
        if (counter) {
            const maxLength = textType === 'anrede' ? 200 : 1000;
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

    resetTextsToDefault(tenantId, mahnstufe) {
        if (confirm('Möchten Sie alle Texte für diese Mahnstufe auf die Standardwerte zurücksetzen?')) {
            textManager.resetToDefault(mahnstufe, tenantId);
            this.refreshTextEditingSection(tenantId);

        }
    }

    previewMahntext(tenantId, mahnstufe) {
        const tenant = this.tenantManager.getTenant(tenantId);
        if (!tenant) return;

        const texts = textManager.getTextForMahnstufe(mahnstufe, tenantId);
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

        const preview = Object.keys(texts).map(key => {
            const processedText = textManager.replaceVariables(texts[key], variables);
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
                        ${UIRendererUtils.createIcon('times')}
                    </button>
                </div>
                <div class="text-preview-body">
                    ${preview}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    refreshTextEditingSection(tenantId) {
        const section = document.getElementById(`textEditing-${tenantId}`);
        if (!section) return;

        const currentMahnstufe = mahnstufen?.getMahnstufe(tenantId) || 1;
        const mahnstufenConfig = mahnstufen?.getMahnstufeConfig(currentMahnstufe);
        const texts = window.app.textManager.getTextForMahnstufe(currentMahnstufe, tenantId);
        const isExpanded = section.classList.contains('expanded');

        const headerTitle = section.querySelector('.text-editing-title');
        if (headerTitle) {
            headerTitle.innerHTML = `
            <span class="text-editing-toggle-icon">
                ${UIRendererUtils.createIcon(isExpanded ? 'chevron-down' : 'chevron-right')}
            </span>
            ${UIRendererUtils.createIcon('edit')} ${mahnstufenConfig?.name || 'Mahntext'} bearbeiten
        `;
        }

        const standardBtn = section.querySelector('.text-editing-controls .btn:first-child');
        const previewBtn = section.querySelector('.text-editing-controls .btn:last-child');

        if (standardBtn) {
            standardBtn.onclick = () => window.app.resetTextsToDefault(tenantId, currentMahnstufe);
        }

        if (previewBtn) {
            previewBtn.onclick = () => window.app.previewMahntext(tenantId, currentMahnstufe);
        }

        const contentDiv = section.querySelector('.text-editing-content');
        if (contentDiv) {
            contentDiv.innerHTML = this.createTextEditFields(tenantId, currentMahnstufe, texts);
        }

        console.log(`Textbearbeitungssektion für ${tenantId} auf Mahnstufe ${currentMahnstufe} aktualisiert`);
    }

    createMasterDataRows(tenant, totalDifference, address, enabledCount) {
        const postAddress = window.app?.tenantManager?.getPostAddress?.(tenant.id);
        const hasCustomAddress = window.app?.tenantManager?.hasCustomPostAddress?.(tenant.id);
        const hasCustomNames = window.app?.tenantManager?.hasCustomNames?.(tenant.id);
        const hasCustomAnreden = window.app?.tenantManager?.hasCustomAnreden?.(tenant.id);
        const rows = [
            ['id-badge', 'ID:', tenant.id],
            ['user', 'Name 1:', this.createNameDisplay(tenant.id, tenant.name1, 'name1', hasCustomNames), 'name-field'],
            ['user-friends', 'Name 2:', this.createNameDisplay(tenant.id, tenant.name2, 'name2', hasCustomNames), 'name-field'],
            ['comments', 'Anrede 1:', this.createAnredeDisplay(tenant.id, tenant.anrede1, 'anrede1', hasCustomAnreden), 'anrede-field'],
            ['comments', 'Anrede 2:', this.createAnredeDisplay(tenant.id, tenant.anrede2, 'anrede2', hasCustomAnreden), 'anrede-field'],
            ['road', 'Immobilie:', address],
            ['map-pin', 'PLZ/Ort:', `${tenant.plz} ${tenant.city}`],
            ['envelope', 'Postadresse:', this.createPostAddressDisplay(tenant.id, postAddress, hasCustomAddress), 'post-address'],
            // NEU: E-Mail-Felder hinzufügen
            ['at', 'E-Mail 1:', tenant.email01 || '-'],
            ['at', 'E-Mail 2:', tenant.email02 || '-'],
            ['user-tie', 'Kontoinhaber:', tenant.ktoinh || tenant.kontoinhaber || '-'],
            ['university', 'Bank:', tenant.bank || '-'],
            ['credit-card', 'IBAN:', UIRendererUtils.formatIBAN(tenant.iban) || '-'],
            ['exchange-alt', 'BIC:', tenant.bic || '-'],
            ['calculator', 'Differenz:', Utils.formatAmount(totalDifference), UIRendererUtils.getColorClass(totalDifference)],
            ['list-ol', 'Positionen:', `${enabledCount}/${tenant.records.length}`]
        ];

        if (tenant.hasAnwalt) {
            rows.push(['balance-scale', 'Anwalt:', 'Ja', 'anwalt-status']);
        }

        return rows.map(([icon, label, value, cssClass = '']) => {
            // KORREKTUR: Prüfe auf alle HTML-Felder
            const isHTMLField = cssClass === 'post-address' || cssClass === 'name-field' || cssClass === 'anrede-field';
            const displayValue = isHTMLField ? value : Utils.escapeHtml(value?.toString() || '');

            return `
        <div class="master-data-label">${UIRendererUtils.createIcon(icon)} ${label}</div>
        <div class="master-data-value ${cssClass}">${displayValue}</div>
        `;
        }).join('');
    }

    createAnredeDisplay(tenantId, currentAnrede, anredeType, hasCustomAnreden) {
        const anredeValue = currentAnrede || '-';
        const customBadge = hasCustomAnreden ?
            '<span class="custom-anrede-badge" title="Benutzerdefinierte Anrede"> </span>' : '';

        return `
    <div class="anrede-container">
        <span class="anrede-text">${Utils.escapeHtml(anredeValue)} ${customBadge}</span>
        <button class="btn btn-small edit-anrede-btn" 
                onclick="window.app.toggleAnredeEditor('${tenantId}')" 
                title="Anreden bearbeiten">
            ${UIRendererUtils.createIcon('edit')}
        </button>
    </div>
    <div class="anrede-editor" id="anredeEditor-${tenantId}" style="display: none;">
        <div class="anrede-form">
            <textarea 
                   class="anrede-input" 
                   id="anrede1-${tenantId}" 
                   placeholder="Anrede 1 (z.B. Sehr geehrte Frau Müller)"
                   rows="2">${Utils.escapeHtml(window.app?.tenantManager?.getTenant(tenantId)?.anrede1 || '')}</textarea>
            <textarea 
                   class="anrede-input" 
                   id="anrede2-${tenantId}" 
                   placeholder="Anrede 2 (z.B. sehr geehrter Herr Müller)"
                   rows="2">${Utils.escapeHtml(window.app?.tenantManager?.getTenant(tenantId)?.anrede2 || '')}</textarea>
            <div class="anrede-actions">
                <button class="btn btn-small btn-primary" 
                        onclick="window.app.saveAnreden('${tenantId}')">
                    ${UIRendererUtils.createIcon('save')} Speichern
                </button>
                <button class="btn btn-small btn-secondary" 
                        onclick="window.app.resetAnreden('${tenantId}')">
                    ${UIRendererUtils.createIcon('undo')} Standard
                </button>
                <button class="btn btn-small" 
                        onclick="window.app.toggleAnredeEditor('${tenantId}')">
                    ${UIRendererUtils.createIcon('times')} Abbrechen
                </button>
            </div>
        </div>
    </div>`;
    }

    createNameDisplay(tenantId, currentName, nameType, hasCustomNames) {
        const nameValue = currentName || '';
        const customBadge = hasCustomNames ?
            '<span class="custom-name-badge" title="Benutzerdefinierter Name"> </span>' : '';

        return `
    <div class="name-container">
        <span class="name-text">${Utils.escapeHtml(nameValue)} ${customBadge}</span>
        <button class="btn btn-small edit-name-btn" 
                onclick="window.app.toggleNameEditor('${tenantId}')" 
                title="Namen bearbeiten">
            ${UIRendererUtils.createIcon('edit')}
        </button>
    </div>
    <div class="name-editor" id="nameEditor-${tenantId}" style="display: none;">
        <div class="name-form">
            <input type="text" 
                   class="name-input" 
                   id="name1-${tenantId}" 
                   placeholder="Name 1" 
                   value="${Utils.escapeHtml(window.app?.tenantManager?.getTenant(tenantId)?.name1 || '')}">
            <input type="text" 
                   class="name-input" 
                   id="name2-${tenantId}" 
                   placeholder="Name 2" 
                   value="${Utils.escapeHtml(window.app?.tenantManager?.getTenant(tenantId)?.name2 || '')}">
            <div class="name-actions">
                <button class="btn btn-small btn-primary" 
                        onclick="window.app.saveNames('${tenantId}')">
                    ${UIRendererUtils.createIcon('save')} Speichern
                </button>
                <button class="btn btn-small btn-secondary" 
                        onclick="window.app.resetNames('${tenantId}')">
                    ${UIRendererUtils.createIcon('undo')} Standard
                </button>
                <button class="btn btn-small" 
                        onclick="window.app.toggleNameEditor('${tenantId}')">
                    ${UIRendererUtils.createIcon('times')} Abbrechen
                </button>
            </div>
        </div>
    </div>`;
    }

    createPostAddressDisplay(tenantId, postAddress, hasCustomAddress) {
        if (!postAddress) return '-';

        const addressText = `${postAddress.street}, ${postAddress.plz} ${postAddress.city}`;
        const customBadge = hasCustomAddress ?
            '<span class="custom-address-badge" title="Benutzerdefinierte Adresse"> </span>' : '';

        return `
    <div class="post-address-container">
        <span class="post-address-text">${Utils.escapeHtml(addressText)} ${customBadge}</span>
        <button class="btn btn-small edit-address-btn" 
                onclick="window.app.togglePostAddressEditor('${tenantId}')" 
                title="Postadresse bearbeiten">
            ${UIRendererUtils.createIcon('edit')}
        </button>
    </div>
    <div class="post-address-editor" id="postEditor-${tenantId}" style="display: none;">
        <div class="address-form">
            <input type="text" 
                   class="address-input" 
                   id="street-${tenantId}" 
                   placeholder="Straße" 
                   value="${Utils.escapeHtml(postAddress.street)}">
            <div class="address-row">
                <input type="text" 
                       class="address-input plz-input" 
                       id="plz-${tenantId}" 
                       placeholder="PLZ" 
                       value="${Utils.escapeHtml(postAddress.plz)}">
                <input type="text" 
                       class="address-input city-input" 
                       id="city-${tenantId}" 
                       placeholder="Ort" 
                       value="${Utils.escapeHtml(postAddress.city)}">
            </div>
            <div class="address-actions">
                <button class="btn btn-small btn-primary" 
                        onclick="window.app.savePostAddress('${tenantId}')">
                    ${UIRendererUtils.createIcon('save')} Speichern
                </button>
                <button class="btn btn-small btn-secondary" 
                        onclick="window.app.resetPostAddress('${tenantId}')">
                    ${UIRendererUtils.createIcon('undo')} Standard
                </button>
                <button class="btn btn-small" 
                        onclick="window.app.togglePostAddressEditor('${tenantId}')">
                    ${UIRendererUtils.createIcon('times')} Abbrechen
                </button>
            </div>
        </div>
    </div>`;
    }

    createAnwaltBadge(hasAnwalt) {
        if (!hasAnwalt) return '';
        return `
        <span class="anwalt-badge" title="Fall beim Anwalt">
            ${UIRendererUtils.createIcon('balance-scale')} Anwalt
        </span>`;
    }

    createCostPositionsSection(tenantId, tenant) {
        return `
    <div class="cost-positions-section">
        ${this.createPositionActions(tenantId, tenant)}
        ${this.createCostPositionsTable(tenant)}
        ${this.createTextEditingSection(tenantId)}
    </div>`;
    }

    createPositionActions(tenantId, tenant) {
        const enabledCount = tenant.records.filter(r => r.enabled).length;
        const totalDifference = this.tenantManager.calculateTenantTotal(tenant);

        return `
        <div class="position-actions">
            <div class="position-bulk-actions">
                <button class="btn btn-small" onclick="app.selectAllPositions('${tenantId}'); event.stopPropagation();">
                    ${UIRendererUtils.createIcon('check-square')} Alle auswählen
                </button>
                <button class="btn btn-small" onclick="app.deselectAllPositions('${tenantId}'); event.stopPropagation();">
                    ${UIRendererUtils.createIcon('square')} Alle abwählen
                </button>
            </div>
            <div class="position-summary">
           
                <span class="total-amount">Aktuelle Summe: ${Utils.formatAmount(totalDifference)}</span>
            </div>
        </div>`;
    }

    createCostPositionsTable(tenant) {
        const headers = ['', 'Zeitraum', 'Kostenart', 'Soll', 'Ist', 'Differenz'];
        const icons = ['', 'calendar-alt', 'tags', '', '', 'calculator'];

        let html = `
        <div class="cost-positions-header">
            ${headers.map((header, i) => `
                <div${i === 5 ? ' class="right"' : ''}>${icons[i] ? UIRendererUtils.createIcon(icons[i]) + ' ' : ''}${header}</div>
            `).join('')}
        </div>`;

        const sortedRecords = [...tenant.records].sort((a, b) => a['inter'].localeCompare(b['inter']));
        html += sortedRecords.map(record => this.createCostPositionRow(record)).join('');
        return html;
    }

    createCostPositionRow(record) {
        const { sollAmount, habenAmount, difference } = UIRendererUtils.calculateRecordAmounts(record);
        const diffClass = UIRendererUtils.getColorClass(difference);
        const diffIcon = difference === 0 ? UIRendererUtils.createIcon('equals') + ' ' : '';

        return `
        <div class="cost-position ${!record.enabled ? 'disabled' : ''}" data-record-id="${record.id}">
            <input type="checkbox" class="position-checkbox" data-record-id="${record.id}"
                   ${record.enabled ? 'checked' : ''}
                   onchange="window.app.toggleCostPosition('${record.id}', this.checked)"
                   onclick="event.stopPropagation()">
            <div class="position-period">${Utils.escapeHtml(PDFUtils.formatZeitraum(record['inter']))}</div>
            <div class="position-type">${Utils.escapeHtml(record['kostenart'])}</div>
            <div class="position-amount soll">${Utils.formatAmount(sollAmount)}</div>
            <div class="position-amount ist">${Utils.formatAmount(habenAmount)}</div>
            <div class="position-amount diff ${diffClass}">${diffIcon}${Utils.formatAmount(difference)}</div>
        </div>`;
    }

    createTenantCardMobile(tenantId, tenant) {
        const totalDifference = this.tenantManager.calculateTenantTotal(tenant);
        const hasDebt = totalDifference < 0;
        const csvMahngebuehr = window.app?.tenantManager?.getCSVMahngebuehr?.(tenantId) || 10.00;

        return `
       <div class="tenant-card mobile" data-tenant-id="${tenantId}">
           <div class="tenant-header mobile" onclick="app.toggleTenantExpansion('${tenantId}')">
               <input type="checkbox" class="tenant-checkbox" data-tenant-id="${tenantId}" 
                      ${tenant.selected ? 'checked' : ''} onclick="event.stopPropagation()">
               <div class="tenant-info-mobile">
                   <div class="tenant-name-mobile">
                       ${UIRendererUtils.createIcon('user')} ${Utils.escapeHtml(tenant.name)}
                       <span class="csv-mahngebuehr-badge-mobile" title="CSV-Mahngebühr">
                           ${UIRendererUtils.createIcon('euro-sign')} ${Utils.formatAmount(csvMahngebuehr)}
                       </span>
                   </div>
                   <div class="tenant-details-mobile">
                       <span>${UIRendererUtils.createIcon('hashtag')} ${Utils.escapeHtml(tenantId)}</span>
                       <span class="tenant-debt ${hasDebt ? 'has-debt' : 'no-debt'}">
                           ${UIRendererUtils.createIcon(hasDebt ? 'exclamation-circle' : 'check-circle')} 
                           ${Utils.formatAmount(Math.abs(totalDifference))}
                       </span>
                   </div>
               </div>
               <div class="expand-indicator" onclick="event.stopPropagation(); app.toggleTenantExpansion('${tenantId}')">
                   ${UIRendererUtils.createIcon('chevron-down')}
               </div>
           </div>
           <div class="tenant-details" id="details-${tenantId}">
               ${this.createTenantMasterData(tenant)}
               ${this.createCostPositionsSection(tenantId, tenant)}
           </div>
       </div>`;
    }

    createGlobalCollapseControls() {
        return `
        <div class="global-collapse-controls">
            <div class="collapse-control-group">
                <button class="btn btn-small collapse-all-btn" onclick="app.uiRenderer.toggleAllStreets(true)">
                    ${UIRendererUtils.createIcon('compress-alt')} Alle einklappen
                </button>
                <button class="btn btn-small expand-all-btn" onclick="app.uiRenderer.toggleAllStreets(false)">
                    ${UIRendererUtils.createIcon('expand-alt')} Alle ausklappen
                </button>
            </div>
            <div class="auto-collapse-toggle">
                <label class="checkbox-label">
                    <input type="checkbox" id="autoCollapseCheckbox" ${this.autoCollapseOnLoad ? 'checked' : ''}
                           onchange="app.uiRenderer.setAutoCollapseOnLoad(this.checked)">
                    <span class="checkmark">${UIRendererUtils.createIcon('check')}</span>
                    Automatisch einklappen beim Laden
                </label>
            </div>
        </div>`;
    }

    createSummaryContent(statistics, generatedCount = 0) {
        const items = [
            ['users', statistics.totalTenants, 'Mieter'],
            ['exclamation-triangle', statistics.tenantsWithDebt, 'Mit Schulden'],
            ['check-circle', statistics.tenantsWithCredit, 'Mit Guthaben'],
            ['euro-sign', Utils.formatAmount(statistics.totalDebtAmount), 'Gesamtrückstand'],
            ['layer-group', statistics.totalPortfolios, 'Portfolios gesamt'],
            ['file-invoice-dollar', generatedCount, 'Erstellte Mahnungen']
        ];

        let html = items.map(([icon, value, label]) => `
        <div class="summary-item">
            <div class="summary-value">${UIRendererUtils.createIcon(icon)} ${value}</div>
            <div class="summary-label">${label}</div>
        </div>`).join('');

        if (statistics.currentPortfolio) {
            html += `
            <div class="summary-item">
                <div class="summary-value">${UIRendererUtils.createIcon('briefcase')} ${Utils.escapeHtml(statistics.currentPortfolio)}</div>
                <div class="summary-label">Aktuelles Portfolio</div>
            </div>`;
        }

        if (mahnstufen) {
            const stats = mahnstufen.getMahnstufeStatistics();
            const mahnstufenItems = [
                ['info-circle', stats.stufe1, 'Zahlungserinnerungen'],
                ['exclamation-triangle', stats.stufe2, '1. Mahnungen'],
                ['ban', stats.stufe3, '2. Mahnungen']
            ];

            html += mahnstufenItems.map(([icon, value, label]) => `
            <div class="summary-item">
                <div class="summary-value">${UIRendererUtils.createIcon(icon)} ${value}</div>
                <div class="summary-label">${label}</div>
            </div>`).join('');
        }

        return html;
    }

    toggleStreetCollapse(streetName) {
        const wasCollapsed = this.collapsedStreets.has(streetName);
        if (wasCollapsed) {
            this.collapsedStreets.delete(streetName);
        } else {
            this.collapsedStreets.add(streetName);
        }

        const streetContainer = document.querySelector(`[data-street="${UIRendererUtils.escapeForSelector(streetName)}"]`);
        const header = streetContainer?.previousElementSibling;
        if (!header) return;

        const collapseIcon = header.querySelector('.collapse-icon i');
        const actionButtons = header.querySelectorAll('.street-select-all, .street-deselect-all, .street-generate-all');

        if (this.collapsedStreets.has(streetName)) {
            streetContainer.style.display = 'none';
            collapseIcon.className = 'fas fa-chevron-right';
            header.classList.add('collapsed');
            actionButtons.forEach(btn => btn.disabled = true);
        } else {
            streetContainer.style.display = 'block';
            collapseIcon.className = 'fas fa-chevron-down';
            header.classList.remove('collapsed');
            actionButtons.forEach(btn => btn.disabled = false);
        }
    }

    toggleAllStreets(collapse = null) {
        document.querySelectorAll('.street-group-header').forEach(header => {
            const streetName = header.querySelector('.street-name')?.textContent?.replace('📍 ', '').trim();
            if (!streetName) return;

            const isCollapsed = this.collapsedStreets.has(streetName);
            const shouldToggle = collapse === null || (collapse && !isCollapsed) || (!collapse && isCollapsed);

            if (shouldToggle) this.toggleStreetCollapse(streetName);
        });
    }

    collapseAllStreetsAfterLoad(tenants) {
        this.collapsedStreets.clear();
        if (this.autoCollapseOnLoad) {
            const streetNames = new Set([...tenants.values()].map(tenant => tenant.street || UIRendererConfig.DEFAULT_STREET));
            streetNames.forEach(street => this.collapsedStreets.add(street));
        }
    }

    setAutoCollapseOnLoad(enabled) {
        this.autoCollapseOnLoad = enabled;
    }

    renderTenantList(filteredTenants, isInitialLoad = false) {
        const tenantList = document.getElementById('tenantList');
        const tenantCount = filteredTenants.size;

        if (tenantCount === 0) {
            tenantList.innerHTML = '<div class="text-center text-muted" style="padding: 40px;">' +
                UIRendererUtils.createIcon('search') + ' Keine Mieter gefunden.</div>';
            return;
        }

        if (isInitialLoad) this.collapseAllStreetsAfterLoad(filteredTenants);

        const htmlParts = [this.createGlobalCollapseControls()];
        const streetGroups = this.groupTenantsByStreet(filteredTenants);
        const sortedStreets = Object.keys(streetGroups).sort();

        sortedStreets.forEach(streetName => {
            const streetTenants = streetGroups[streetName];
            const isCollapsed = this.collapsedStreets.has(streetName);

            htmlParts.push(
                this.createStreetGroupHeader(streetName, streetTenants),
                `<div class="street-group-container" data-street="${Utils.escapeHtml(streetName)}" 
                 style="display: ${isCollapsed ? 'none' : 'block'};">`
            );

            if (!UIRendererUtils.isMobile()) {
                htmlParts.push(this.createTenantListHeader());
            }

            streetTenants.forEach((tenant, index) => {
                htmlParts.push(UIRendererUtils.isMobile() ?
                    this.createTenantCardMobile(tenant.id, tenant) :
                    this.createCollapsibleTenantCard(tenant.id, tenant)
                );
            });

            htmlParts.push('</div>');
        });

        tenantList.innerHTML = htmlParts.join('');
        this.setupAllUserTextEvents();
    }


    createUserTextSection(tenantId) {
        return `
       <div class="user-text-section" style="margin: 15px 0; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; overflow: hidden;">
           <div style="padding: 12px;">
               <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                   <h4 style="margin: 0; font-size: 14px; color: #495057; display: flex; align-items: center; gap: 8px;">
                       ${UIRendererUtils.createIcon('edit')} 
                       Individueller Text (optional)
                       <span id="textCounter-${tenantId}" style="font-size: 11px; color: #7f8c8d; font-weight: normal;">0/${UIRendererConfig.MAX_TEXT_LENGTH}</span>
                   </h4>
                   <div style="display: flex; gap: 5px;">
                       <button type="button" class="btn btn-small" id="clearTextBtn-${tenantId}" title="Text löschen">
                           ${UIRendererUtils.createIcon('trash')}
                       </button>
                   </div>
               </div>
               <textarea 
                   id="userCustomText-${tenantId}" 
                   class="user-custom-text"
                   data-tenant-id="${tenantId}"
                   placeholder="Individueller Text nur für ${tenantId} (optional)..."
                   maxlength="${UIRendererConfig.MAX_TEXT_LENGTH}"
                   style="width: 100%; min-height: 70px; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; font-family: Arial, sans-serif; font-size: 12px; resize: vertical; line-height: 1.4; box-sizing: border-box;"
               ></textarea>
               <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; font-size: 11px; color: #6c757d;">
                   <div style="display: flex; align-items: center; gap: 5px;">
                       <label>Position:</label>
                       <select id="textPosition-${tenantId}" class="text-position-select" data-tenant-id="${tenantId}" style="padding: 2px 6px; font-size: 11px; border: 1px solid #ced4da; border-radius: 3px;">
                           ${Object.entries(UIRendererConfig.TEXT_POSITIONS).map(([value, label]) => `
                               <option value="${value}" ${value === 'before-closing' ? 'selected' : ''}>${label}</option>
                           `).join('')}
                       </select>
                   </div>
               </div>
           </div>
       </div>`;
    }

    // In uiRenderer.js - fügen Sie diese komplette Methode zur UIRenderer-Klasse hinzu:

    createStreetGroupHeader(streetName, streetTenants) {
        try {
            const isCollapsed = this.collapsedStreets.has(streetName);
            const stats = this.calculateStreetStatistics(streetTenants);
            const postenStats = this.calculatePostenStatistics(streetTenants);
            const portfolios = this.getPortfoliosForStreet(streetTenants);
            const escapedStreet = Utils.escapeHtml(streetName);

            return `
        <div class="street-group-card ${isCollapsed ? 'collapsed' : ''}"
             onclick="app.uiRenderer.toggleStreetCollapse('${escapedStreet}')">
            <div class="street-card-header">
                <div class="street-title-section">
                    <span class="collapse-icon">
                        ${UIRendererUtils.createIcon(`chevron-${isCollapsed ? 'right' : 'down'}`)}
                    </span>
                    <div class="street-title-content">
                        <h4 class="street-name">
                            ${UIRendererUtils.createIcon('map-marker-alt')} ${escapedStreet}
                        </h4>
                        <div class="street-header-info">
                            ${this.createPortfolioDisplay(portfolios)}
                            <div class="posten-summary">
                                <span class="tenant-count">
                                    ${UIRendererUtils.createIcon('users')} ${stats.totalTenants} Mieter
                                </span>
                                <span class="posten-count">
                                    ${UIRendererUtils.createIcon('list-ul')} ${postenStats.totalPosten} Posten
                                </span>
                                <span class="posten-sum">
                                    ${UIRendererUtils.createIcon('euro-sign')} ${Utils.formatAmount(Math.abs(postenStats.totalSum))}
                                </span>
                                ${stats.tenantsWithAnwalt > 0 ? `
                                    <span class="anwalt-count">
                                        ${UIRendererUtils.createIcon('balance-scale')} ${stats.tenantsWithAnwalt} Anwalt
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="street-quick-actions" onclick="event.stopPropagation();">
                    ${this.createQuickActionButtons(escapedStreet, stats.tenantsWithDebt > 0, isCollapsed)}
                </div>
            </div>
            
        </div>`;
        } catch (error) {
            console.error('Fehler in createStreetGroupHeader:', error);
            return `
        <div class="street-group-card">
            <div class="street-card-header">
                <h4 class="street-name">
                    <i class="fas fa-map-marker-alt"></i> ${Utils.escapeHtml(streetName)}
                </h4>
                <p style="color: #dc3545;">Fehler beim Laden der Straßen-Daten</p>
            </div>
        </div>`;
        }
    }

    // Falls auch andere Hilfsmethoden fehlen, hier sind sie:

    // SOFORTIGE REPARATUR in uiRenderer.js:
    // Ersetzen Sie die calculateStreetStatistics Methode komplett:

    calculateStreetStatistics(streetTenants) {
        try {
            if (!streetTenants || !Array.isArray(streetTenants)) {
                console.warn('streetTenants ist kein Array:', streetTenants);
                return { totalTenants: 0, tenantsWithDebt: 0, tenantsWithAnwalt: 0 };
            }

            let totalTenants = streetTenants.length;
            let tenantsWithDebt = 0;
            let tenantsWithAnwalt = 0;

            streetTenants.forEach((tenant, index) => {
                try {
                    // ✅ KORREKTUR: Prüfe ob tenant.records existiert
                    if (!tenant || typeof tenant !== 'object') {
                        console.warn(`Tenant ${index} ist kein Objekt:`, tenant);
                        return;
                    }

                    // ✅ KORREKTUR: Nur calculateTenantTotal aufrufen wenn tenantManager verfügbar
                    if (this.tenantManager && typeof this.tenantManager.calculateTenantTotal === 'function') {

                        // ✅ KORREKTUR: Nur berechnen wenn tenant.records existiert
                        if (tenant.records && Array.isArray(tenant.records)) {
                            const totalDifference = this.tenantManager.calculateTenantTotal(tenant);

                            if (totalDifference < 0) {
                                tenantsWithDebt++;
                            }
                        } else {
                            console.warn(`Tenant ${tenant.name || index} hat keine records:`, tenant);
                        }
                    } else {
                        console.warn('tenantManager nicht verfügbar für Berechnung');
                    }

                    // ✅ KORREKTUR: Anwalt-Check mit Fallback
                    if (tenant.hasAnwalt === true) {
                        tenantsWithAnwalt++;
                    }

                } catch (error) {
                    console.error(`Fehler bei Tenant ${index} (${tenant?.name || 'unbekannt'}):`, error);
                }
            });

            const result = {
                totalTenants,
                tenantsWithDebt,
                tenantsWithAnwalt
            };

            return result;

        } catch (error) {
            console.error('Fehler in calculateStreetStatistics:', error);
            return { totalTenants: 0, tenantsWithDebt: 0, tenantsWithAnwalt: 0 };
        }
    }

    calculatePostenStatistics(streetTenants) {
        try {
            let totalPosten = 0;
            let totalSum = 0;

            streetTenants.forEach(tenant => {
                if (tenant.records && Array.isArray(tenant.records)) {
                    totalPosten += tenant.records.filter(r => r.enabled).length;
                    const tenantTotal = this.tenantManager.calculateTenantTotal(tenant);
                    totalSum += tenantTotal;
                }
            });

            return {
                totalPosten,
                totalSum
            };
        } catch (error) {
            console.error('Fehler in calculatePostenStatistics:', error);
            return { totalPosten: 0, totalSum: 0 };
        }
    }

    getPortfoliosForStreet(streetTenants) {
        try {
            const portfolios = new Set();
            streetTenants.forEach(tenant => {
                if (tenant.portfolio) {
                    portfolios.add(tenant.portfolio);
                }
            });
            return Array.from(portfolios);
        } catch (error) {
            console.error('Fehler in getPortfoliosForStreet:', error);
            return [];
        }
    }

    createPortfolioDisplay(portfolios) {
        try {
            if (!portfolios || portfolios.length === 0) return '';

            if (portfolios.length === 1) {
                return `
                <span class="street-portfolio-badge">
                    ${UIRendererUtils.createIcon('briefcase')} ${Utils.escapeHtml(portfolios[0])}
                </span>
            `;
            } else {
                return `
                <span class="street-portfolio-badge multiple">
                    ${UIRendererUtils.createIcon('briefcase')} ${portfolios.length} Portfolios
                </span>
            `;
            }
        } catch (error) {
            console.error('Fehler in createPortfolioDisplay:', error);
            return '';
        }
    }

    /* createStreetExpandedContent(stats, escapedStreet) {
        try {
            return `
            <div class="street-expanded-content">
                <div class="street-stats-detail">
                   
                    ${stats.tenantsWithAnwalt > 0 ? `<span>Mit Anwalt: ${stats.tenantsWithAnwalt}</span>` : ''}
                </div>
            </div>`;
        } catch (error) {
            console.error('Fehler in createStreetExpandedContent:', error);
            return '';
        }
    } */


    setupAllUserTextEvents() {
        document.querySelectorAll('.user-custom-text').forEach(textArea => {
            const tenantId = textArea.getAttribute('data-tenant-id');
            if (tenantId && !textArea.hasAttribute('data-events-setup')) {
                this.setupUserTextEventsForTenant(tenantId);
            }
        });
        this.setupMahngebuehrenEvents();
    }

    setupUserTextEventsForTenant(tenantId) {
        const textArea = document.getElementById(`userCustomText-${tenantId}`);
        const counter = document.getElementById(`textCounter-${tenantId}`);
        const clearBtn = document.getElementById(`clearTextBtn-${tenantId}`);
        const positionSelect = document.getElementById(`textPosition-${tenantId}`);

        if (!textArea || textArea.hasAttribute('data-events-setup')) return;
        textArea.setAttribute('data-events-setup', 'true');

        const updateCounter = () => {
            if (!counter) return;
            const length = textArea.value.length;
            counter.textContent = `${length}/${UIRendererConfig.MAX_TEXT_LENGTH}`;

            if (length > 450) counter.style.color = '#e74c3c';
            else if (length > 350) counter.style.color = '#f39c12';
            else counter.style.color = '#7f8c8d';
        };

        textArea.addEventListener('input', () => {
            updateCounter();
            this.saveUserTextForTenant(tenantId);
        });

        positionSelect?.addEventListener('change', () => {
            this.saveUserTextForTenant(tenantId);
        });

        clearBtn?.addEventListener('click', () => {
            textArea.value = '';
            updateCounter();
            this.saveUserTextForTenant(tenantId);

        });

        this.loadUserTextForTenant(tenantId);
    }

    setupMahngebuehrenEvents() {
        document.querySelectorAll('.mahngebuehren-input').forEach(input => {
            const tenantId = input.getAttribute('data-tenant-id');
            if (tenantId && !input.hasAttribute('data-events-setup')) {
                input.setAttribute('data-events-setup', 'true');

                input.addEventListener('input', () => {
                    mahnstufen?.validateMahngebuehrInput?.(input);
                });

                input.addEventListener('change', () => {
                    mahnstufen?.handleMahngebuehrChange?.(tenantId, input.value);
                });
            }
        });
    }

    saveUserTextForTenant(tenantId) {
        try {
            const textarea = document.querySelector(`textarea[data-tenant-id="${tenantId}"]`);
            const positionSelect = document.querySelector(`select[data-tenant-id="${tenantId}"]`);

            const data = {
                text: textarea?.value || '',
                position: positionSelect?.value || 'before-closing',
                timestamp: new Date().toISOString()
            };

            localStorage.setItem(`${UIRendererConfig.STORAGE_PREFIX}${tenantId}`, JSON.stringify(data));
            console.log(`Benutzertext für ${tenantId} gespeichert`);
        } catch (error) {
            console.error(`Fehler beim Speichern des Benutzertexts für ${tenantId}: ${error.message}`);
        }
    }

    loadUserTextForTenant(tenantId) {
        try {
            const saved = localStorage.getItem(`${UIRendererConfig.STORAGE_PREFIX}${tenantId}`);
            if (!saved) return;

            const data = JSON.parse(saved);
            const textarea = document.querySelector(`textarea[data-tenant-id="${tenantId}"]`);
            const positionSelect = document.querySelector(`select[data-tenant-id="${tenantId}"]`);
            const counter = document.getElementById(`textCounter-${tenantId.replace(/\./g, '\\.')}`);

            if (textarea && data.text) {
                textarea.value = data.text;
                if (counter) {
                    const length = data.text.length;
                    counter.textContent = `${length}/${UIRendererConfig.MAX_TEXT_LENGTH}`;

                    if (length > 450) counter.style.color = '#e74c3c';
                    else if (length > 350) counter.style.color = '#f39c12';
                    else counter.style.color = '#7f8c8d';
                }
            }

            if (positionSelect && data.position) {
                positionSelect.value = data.position;
            }

            console.log(`Benutzertext für ${tenantId} geladen`);
        } catch (error) {
            console.error(`Fehler beim Laden des Benutzertexts für ${tenantId}: ${error.message}`);
        }
    }

    getUserTextForTenant(tenantId) {
        const textarea = document.querySelector(`textarea[data-tenant-id="${tenantId}"]`);
        return textarea?.value?.trim() || '';
    }

    getTextPositionForTenant(tenantId) {
        const positionSelect = document.querySelector(`select[data-tenant-id="${tenantId}"]`);
        return positionSelect?.value || 'before-closing';
    }

    hasCustomTextForTenant(tenantId) {
        return this.getUserTextForTenant(tenantId).length > 0;
    }

    async addCustomTextToPDFForTenant(doc, tenant, mahnstufe, margin, pageWidth, yPosition) {
        const customText = this.getUserTextForTenant(tenant.id);

        if (!customText) {
            console.log(`Kein Text für ${tenant.id} - überspringe`);
            return yPosition;
        }

        yPosition += 2;
        console.log(`Füge Text für ${tenant.id} in PDF ein`);

        const maxWidth = pageWidth - 2 * margin;
        const requiredSpace = window.PDFUtils ? PDFUtils.calculateTextHeight(doc, customText, maxWidth, 10) + 10 : 30;
        const { height: pageHeight } = doc.internal.pageSize;

        if (window.PDFUtils?.needsNewPage?.(yPosition, requiredSpace, pageHeight, 15)) {
            console.log(`Neue Seite für benutzerdefinierten Text (${tenant.id})`);
            doc.addPage();
            yPosition = 25;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);

        if (window.PDFUtils?.addTextBlock) {
            yPosition = PDFUtils.addTextBlock(doc, customText, margin, yPosition, maxWidth);
        } else {
            doc.text(customText, margin, yPosition);
            yPosition += 15;
        }

        yPosition += 4;
        console.log(`Text eingefügt! Neue Y-Position: ${yPosition}`);
        return yPosition;
    }

    applyPaymentStatusColors() {
        if (this.colorUpdatePending) {
            /* console.log('⚠️ Farb-Update bereits geplant - überspringe'); */
            return;
        }

        this.colorUpdatePending = true;

        requestAnimationFrame(() => {
            /* console.log('Wende Zahlungsstatus-Farben an...'); */

            try {
                // 1. Kostenpositionen färben (Batch-Verarbeitung)
                const positions = document.querySelectorAll('.cost-position');
                const positionUpdates = [];

                positions.forEach((position) => {
                    const sollElement = position.querySelector('.position-amount.soll');
                    const istElement = position.querySelector('.position-amount.ist');
                    const diffElement = position.querySelector('.position-amount.diff');

                    if (sollElement && istElement && diffElement) {
                        const sollValue = parseFloat(sollElement.textContent.replace(/[^\d,.-]/g, '').replace(',', '.'));
                        const istValue = parseFloat(istElement.textContent.replace(/[^\d,.-]/g, '').replace(',', '.'));
                        const diffValue = parseFloat(diffElement.textContent.replace(/[^\d,.-]/g, '').replace(',', '.'));

                        // Sammle Updates statt sofortiger Anwendung
                        positionUpdates.push({
                            ist: { element: istElement, sollValue, istValue },
                            diff: { element: diffElement, diffValue }
                        });
                    }
                });

                // Batch-Update aller Positionen
                positionUpdates.forEach(({ ist, diff }) => {
                    // IST-Spalte
                    ist.element.classList.remove('overpaid', 'underpaid', 'fully-paid');
                    if (ist.istValue > ist.sollValue) {
                        ist.element.classList.add('overpaid');
                    } else if (ist.istValue < ist.sollValue) {
                        ist.element.classList.add('underpaid');
                    } else {
                        ist.element.classList.add('fully-paid');
                    }

                    // Differenz-Spalte
                    diff.element.classList.remove('credit', 'debt', 'has-debt', 'no-debt', 'balanced');
                    if (diff.diffValue > 0) {
                        diff.element.classList.add('credit');
                    } else if (diff.diffValue < 0) {
                        diff.element.classList.add('debt');
                    } else {
                        diff.element.classList.add('balanced');
                    }
                });

                // 2. Aktuelle Summen färben (Batch-Verarbeitung)
                const totalElements = document.querySelectorAll('.total-amount');
                const totalUpdates = [];

                totalElements.forEach(totalElement => {
                    const originalText = totalElement.textContent || totalElement.innerText;
                    totalUpdates.push({ element: totalElement, originalText });
                });

                // Batch-Update aller Summen
                totalUpdates.forEach(({ element, originalText }) => {
                    if (originalText.includes('-')) {
                        // Minus = Schulden = Rot
                        element.style.color = '#dc3545';
                        element.style.fontWeight = '700';
                        // Entferne "Guthaben" falls vorhanden
                        if (originalText.includes('Guthaben:')) {
                            element.textContent = originalText.replace('Guthaben:', '').trim();
                        }
                    } else {
                        // Kein Minus = Guthaben = Grün
                        element.style.color = '#28a745';
                        element.style.fontWeight = '700';
                        // Füge "Guthaben:" hinzu, falls noch nicht vorhanden
                        if (!originalText.includes('Guthaben:')) {
                            const parts = originalText.split('|');
                            if (parts.length > 1) {
                                const betragTeil = parts[1].trim();
                                const neuerText = parts[0] + '| Guthaben: ' + betragTeil.replace('Aktuelle Summe:', '').trim();
                                element.textContent = neuerText;
                            }
                        }
                    }
                });

              /*   console.log('Alle Farben angewendet (Positionen + Summen mit Guthaben-Text)'); */

            } catch (error) {
                console.error('Fehler beim Farb-Update:', error);
            } finally {
                this.colorUpdatePending = false;
            }
        });
    }
}

const paymentColorObserver = new MutationObserver(() => {
    if (window.app && window.app.uiRenderer) {
        setTimeout(() => {
            window.app.uiRenderer.applyPaymentStatusColors();
        }, 150);
    }
});

// Observer starten
if (document.querySelector('.tenant-list') || document.body) {
    paymentColorObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false
    });
}

function addPaymentStatusClasses() {
    /* console.log('=== Starte Farb-Klassifizierung ==='); */

    document.querySelectorAll('.cost-position').forEach((position, index) => {
        const sollElement = position.querySelector('.position-amount.soll');
        const istElement = position.querySelector('.position-amount.ist');
        const diffElement = position.querySelector('.position-amount.diff');

        if (sollElement && istElement && diffElement) {
            // Werte extrahieren (entferne €-Symbol und &nbsp;)
            const sollText = sollElement.textContent.replace(/\s/g, '').replace('€', '').replace(',', '.');
            const istText = istElement.textContent.replace(/\s/g, '').replace('€', '').replace(',', '.');
            const diffText = diffElement.textContent.replace(/\s/g, '').replace('€', '').replace(',', '.');

            const sollValue = parseFloat(sollText);
            const istValue = parseFloat(istText);
            const diffValue = parseFloat(diffText);

/*             console.log(`Position ${index + 1}:`);
            console.log(`  Soll: "${sollText}" = ${sollValue}`);
            console.log(`  Ist: "${istText}" = ${istValue}`);
            console.log(`  Diff: "${diffText}" = ${diffValue}`); */

            // IST-Spalte klassifizieren
            istElement.classList.remove('overpaid', 'underpaid', 'fully-paid');
            if (istValue > sollValue) {
                istElement.classList.add('overpaid');
               /*  console.log('  IST: overpaid (grün)'); */
            } else if (istValue < sollValue) {
                istElement.classList.add('underpaid');
               /*  console.log('  IST: underpaid (rot)'); */
            } else {
                istElement.classList.add('fully-paid');
                /* console.log('  IST: fully-paid (grau)'); */
            }

            // Differenz-Spalte klassifizieren
            diffElement.classList.remove('credit', 'debt', 'has-debt', 'no-debt', 'balanced');

            if (diffValue > 0) {
                // Positive Differenz = Guthaben = Grün
                diffElement.classList.add('credit');
                console.log('  DIFF: credit (grün) - Guthaben');
            } else if (diffValue < 0) {
                // Negative Differenz = Schulden = Rot
                diffElement.classList.add('debt');
                console.log('  DIFF: debt (rot) - Schulden');
            } else {
                // Null = Ausgeglichen = Grau
                diffElement.classList.add('balanced');
                console.log('  DIFF: balanced (grau) - Ausgeglichen');
            }
        }
    });

    /* console.log('=== Farb-Klassifizierung abgeschlossen ==='); */
}


addPaymentStatusClasses();

// Auch bei Änderungen aufrufen (z.B. nach dem Laden neuer Daten)
document.addEventListener('DOMContentLoaded', addPaymentStatusClasses);

// MutationObserver für dynamische Änderungen
const observer = new MutationObserver(() => {
    setTimeout(addPaymentStatusClasses, 100);
});

if (document.querySelector('.tenant-list')) {
    observer.observe(document.querySelector('.tenant-list'), {
        childList: true,
        subtree: true
    });
}


window.UIRenderer = UIRenderer;