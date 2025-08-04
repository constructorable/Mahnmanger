class TenantManagerConfig {
    static get CACHE_TIMEOUT() { return 5000; }
    static get DEFAULT_MAHNSTUFE() { return 1; }
    static get DEFAULT_PORTFOLIO() { return 'Unbekanntes Portfolio'; }
    static get DEFAULT_ANREDE() { return 'Sehr geehrte Damen und Herren,'; }
    static get DEFAULT_MAHNGEBUEHR() { return 10.00; }
    static get VERSION() { return '3.2'; }
}

class TenantUtils {
    static extractPLZ(hausort) {
        const match = hausort?.match(/^\d{5}/);
        return match?.[0] || '';
    }

    static extractCity(hausort) {
        if (!hausort) return '';
        const plz = this.extractPLZ(hausort);
        return hausort.replace(plz, '').trim();
    }

    static buildTenantName(record) {
        const name1 = record['name1'] || '';
        const name2 = record['name2'] || '';
        if (name1 && name2) return `${name1}, ${name2}`;
        return name1 || name2 || 'Unbekannter Mieter';
    }

    static hasAnwaltAssigned(anwaltName) {
        if (!anwaltName) return false;
        return anwaltName.trim() !== '';
    }


    static hasValidBankData(bankData) {
        if (!bankData) return false;
        return !!(
            (bankData.iban && bankData.iban.length > 10) ||
            (bankData.bic && bankData.bic.length > 3) ||
            (bankData.bank && bankData.bank.length > 2)
        );
    }

    static calculateRecordDifference(record) {
        const sollAmount = Utils.parseAmount(record['soll']);
        const habenAmount = Utils.parseAmount(record['haben']);
        return habenAmount - sollAmount;
    }

    // NEU: Mahngebühren aus Fließtext extrahieren
    static extractMahngebuehrenFromText(text) {
        if (!text || typeof text !== 'string') {
            console.log('Keine Mahngebühren-Text gefunden -> Standard 10,00€');
            return TenantManagerConfig.DEFAULT_MAHNGEBUEHR;
        }

        // Suche nach verschiedenen Zahlenmustern
        const patterns = [
            /(\d+[.,]\d{2})/g,  // z.B. "10,50" oder "10.50"
            /(\d+[.,]\d{1})/g,  // z.B. "7,5" oder "7.5"
            /(\d+)/g            // z.B. "10"
        ];

        for (const pattern of patterns) {
            const matches = text.match(pattern);
            if (matches && matches.length > 0) {
                // Nimm die erste gefundene Zahl
                const numberStr = matches[0].replace(',', '.');
                const parsed = parseFloat(numberStr);

                if (!isNaN(parsed) && parsed > 0 && parsed <= 999.99) {
                    console.log(`✅ Mahngebühr extrahiert: "${text}" -> ${parsed}€`);
                    return parsed;
                }
            }
        }

        console.log(`⚠️ Keine gültige Mahngebühr in: "${text}" -> Standard ${TenantManagerConfig.DEFAULT_MAHNGEBUEHR}€`);
        return TenantManagerConfig.DEFAULT_MAHNGEBUEHR;
    }
}






class TenantManager {
    constructor() {
        this.tenants = new Map();
        this.portfolios = new Map();
        this.currentPortfolioFilter = null;
        this.currentAnwaltFilter = null; // Falls nicht vorhanden
        this.currentSchuldenFilter = null; // HIER verschieben
        this.version = TenantManagerConfig.VERSION;
        this.statisticsCache = null;
        this.lastCacheUpdate = 0;
        this.csvMahngebuehrenCache = new Map();
        this.customPostAddresses = new Map();
        this.customNames = new Map();
        this.customAnreden = new Map();

        this.loadCustomPostAddressesFromStorage();
        this.loadCustomNamesFromStorage();
        this.loadCustomAnredenFromStorage();
    }


clearSchuldenFilter() {
    this.currentSchuldenFilter = null;
    this.invalidateCache();
    console.log('Schulden-Filter gelöscht'); // Debug hinzufügen
}

setSchuldenFilter(schuldenType) {
    this.currentSchuldenFilter = schuldenType;
    this.invalidateCache();
    console.log('Schulden-Filter gesetzt:', schuldenType); // Debug hinzufügen
}

    // NEU: Anreden-Management
    setCustomAnreden(tenantId, anrede1, anrede2) {
        this.customAnreden.set(tenantId, {
            anrede1: anrede1.trim(),
            anrede2: anrede2.trim(),
            isCustom: true,
            savedAt: new Date().toISOString()
        });

        // Aktualisiere auch den Tenant direkt
        const tenant = this.tenants.get(tenantId);
        if (tenant) {
            tenant.anrede1 = anrede1.trim();
            tenant.anrede2 = anrede2.trim();
        }

        this.saveCustomAnredenToStorage();
        console.log(`Benutzerdefinierte Anreden gesetzt und gespeichert für ${tenantId}`);
    }

    resetAnreden(tenantId) {
        this.customAnreden.delete(tenantId);

        // Setze ursprüngliche Anreden zurück (aus CSV-Daten)
        const tenant = this.tenants.get(tenantId);
        if (tenant && tenant.records.length > 0) {
            const originalRecord = tenant.records[0];
            tenant.anrede1 = originalRecord.anrede1 || '';
            tenant.anrede2 = originalRecord.anrede2 || '';
        }

        this.saveCustomAnredenToStorage();
        console.log(`Anreden für ${tenantId} auf Standard zurückgesetzt`);
    }

    hasCustomAnreden(tenantId) {
        return this.customAnreden.has(tenantId);
    }

    getCustomAnreden(tenantId) {
        return this.customAnreden.get(tenantId);
    }

    // NEU: LocalStorage für Anreden
    saveCustomAnredenToStorage() {
        try {
            const data = {
                anreden: Array.from(this.customAnreden.entries()),
                version: this.version,
                savedAt: new Date().toISOString()
            };
            localStorage.setItem('mahnmanager_custom_anreden', JSON.stringify(data));
            console.log(`${this.customAnreden.size} benutzerdefinierte Anreden gespeichert`);
        } catch (error) {
            console.error('Fehler beim Speichern der Anreden:', error);
        }
    }

    loadCustomAnredenFromStorage() {
        try {
            const data = localStorage.getItem('mahnmanager_custom_anreden');
            if (data) {
                const parsed = JSON.parse(data);
                this.customAnreden = new Map(parsed.anreden || []);
               
            }
        } catch (error) {
            console.error('Fehler beim Laden der Anreden:', error);
            this.customAnreden = new Map();
        }
    }

    clearCustomAnredenStorage() {
        localStorage.removeItem('mahnmanager_custom_anreden');
        this.customAnreden.clear();
        console.log('Alle benutzerdefinierten Anreden gelöscht');
    }

    setCustomNames(tenantId, name1, name2) {
        this.customNames.set(tenantId, {
            name1: name1.trim(),
            name2: name2.trim(),
            isCustom: true,
            savedAt: new Date().toISOString()
        });

        // Aktualisiere auch den Tenant direkt
        const tenant = this.tenants.get(tenantId);
        if (tenant) {
            tenant.name1 = name1.trim();
            tenant.name2 = name2.trim();
            tenant.name = name1.trim(); // Hauptname
        }

        this.saveCustomNamesToStorage();
        console.log(`Benutzerdefinierte Namen gesetzt und gespeichert für ${tenantId}`);
    }

    saveCustomNamesToStorage() {
        try {
            const data = {
                names: Array.from(this.customNames.entries()),
                version: this.version,
                savedAt: new Date().toISOString()
            };
            localStorage.setItem('mahnmanager_custom_names', JSON.stringify(data));
            console.log(`${this.customNames.size} benutzerdefinierte Namen gespeichert`);
        } catch (error) {
            console.error('Fehler beim Speichern der Namen:', error);
        }
    }

    loadCustomNamesFromStorage() {
        try {
            const data = localStorage.getItem('mahnmanager_custom_names');
            if (data) {
                const parsed = JSON.parse(data);
                this.customNames = new Map(parsed.names || []);
                /* console.log(`${this.customNames.size} benutzerdefinierte Namen geladen`); */
            }
        } catch (error) {
            console.error('Fehler beim Laden der Namen:', error);
            this.customNames = new Map();
        }
    }

    clearCustomNamesStorage() {
        localStorage.removeItem('mahnmanager_custom_names');
        this.customNames.clear();
        console.log('Alle benutzerdefinierten Namen gelöscht');
    }

    resetNames(tenantId) {
        this.customNames.delete(tenantId);

        // Setze ursprüngliche Namen zurück (aus CSV-Daten)
        const tenant = this.tenants.get(tenantId);
        if (tenant && tenant.records.length > 0) {
            const originalRecord = tenant.records[0];
            tenant.name1 = originalRecord.name1 || '';
            tenant.name2 = originalRecord.name2 || '';
            tenant.name = tenant.name1;
        }

        this.saveCustomNamesToStorage();
        console.log(`Namen für ${tenantId} auf Standard zurückgesetzt`);
    }

    hasCustomNames(tenantId) {
        return this.customNames.has(tenantId);
    }

    getCustomNames(tenantId) {
        return this.customNames.get(tenantId);
    }


    loadCustomPostAddressesFromStorage() {
        try {
            const data = localStorage.getItem('mahnmanager_custom_post_addresses');
            if (data) {
                const parsed = JSON.parse(data);
                this.customPostAddresses = new Map(parsed.addresses || []);
                /* console.log(`${this.customPostAddresses.size} benutzerdefinierte Postadressen geladen`); */
            }
        } catch (error) {
            console.error('Fehler beim Laden der Postadressen:', error);
            this.customPostAddresses = new Map();
        }
    }

    clearCustomPostAddressesStorage() {
        localStorage.removeItem('mahnmanager_custom_post_addresses');
        this.customPostAddresses.clear();
        console.log('Alle benutzerdefinierten Postadressen gelöscht');
    }


    processTenantData(data) {
        this.tenants.clear();
        this.portfolios.clear();

        data.forEach(record => {
            const tenantId = record.oemn || record.id;

            if (!this.tenants.has(tenantId)) {
                const tenant = {
                    id: tenantId,
                    name: record.name1 || record.name || '',
                    name1: record.name1 || '',
                    name2: record.name2 || '',
                    anrede1: record.anrede1 || '',
                    anrede2: record.anrede2 || '',
                    // NEU: E-Mail-Felder hinzufügen
                    email01: record.email01 || '',
                    email02: record.email02 || '',
                    street: record.hausstr || record.street || '',
                    city: record.hausort || record.city || '',
                    plz: record.plz || '',
                    mieterstr: record.mieterstr || '',
                    mieterort: record.mieterort || '',
                    iban: record.iban || '',
                    bic: record.bic || '',
                    ktoinh: record.ktoinh || record.kontoinhaber || '',
                    bank: record.bank || '',
                    portfolio: record.portfolioname || 'Standard',
                    records: [],
                    selected: false,
                    mahnstufe: 1,
                    hasAnwalt: Boolean(record.hasAnwalt || (record.anwaltname && record.anwaltname.trim() !== '')),
                    anwaltName: record.anwaltName || record.anwaltname || '',
                    mahngebuehrenText: record.mahngebuehren || ''
                };

                this.tenants.set(tenantId, tenant);

                // KORREKTUR: Portfolio korrekt hinzufügen
                this.addToPortfolio(tenant.portfolio);
            }

            const tenant = this.tenants.get(tenantId);
            const recordWithStatus = {
                ...record,
                enabled: true,
                id: Utils.generateUniqueId(),
                tenantId: tenantId
            };

            tenant.records.push(recordWithStatus);
        });

        // OPTIMIERUNG: Anwalt-Daten final überprüfen und korrigieren
        this.tenants.forEach((tenant, tenantId) => {
            const hasAnwaltRecord = tenant.records.some(record =>
                record.anwaltname && record.anwaltname.trim() !== ''
            );

            if (hasAnwaltRecord && !tenant.hasAnwalt) {
                tenant.hasAnwalt = true;
                const anwaltRecord = tenant.records.find(r => r.anwaltname && r.anwaltname.trim() !== '');
                tenant.anwaltName = anwaltRecord.anwaltname;
            }
        });

        // OPTIMIERUNG: Wiederherstellung benutzerdefinierter Daten
        this.restoreCustomData();

        console.log(`TenantManager: ${this.tenants.size} Tenants verarbeitet`);
    }

    // NEUE HILFSFUNKTION
    restoreCustomData() {
        // Namen wiederherstellen
        this.customNames.forEach((customName, tenantId) => {
            const tenant = this.tenants.get(tenantId);
            if (tenant) {
                tenant.name1 = customName.name1;
                tenant.name2 = customName.name2;
                tenant.name = customName.name1;
            }
        });

        // Anreden wiederherstellen
        this.customAnreden.forEach((customAnrede, tenantId) => {
            const tenant = this.tenants.get(tenantId);
            if (tenant) {
                tenant.anrede1 = customAnrede.anrede1;
                tenant.anrede2 = customAnrede.anrede2;
            }
        });
    }

    setCustomPostAddress(tenantId, street, city, plz) {
        this.customPostAddresses.set(tenantId, {
            street: street.trim(),
            city: city.trim(),
            plz: plz.trim(),
            isCustom: true,
            savedAt: new Date().toISOString()
        });

        // Sofort im LocalStorage speichern
        this.saveCustomPostAddressesToStorage();
        console.log(`Benutzerdefinierte Postadresse gesetzt und gespeichert für ${tenantId}`);
    }

    getPostAddress(tenantId) {
        // Prüfe zuerst benutzerdefinierte Adresse aus LocalStorage
        if (this.customPostAddresses.has(tenantId)) {
            return this.customPostAddresses.get(tenantId);
        }

        // Fallback: Original Mieter-Postadresse
        const tenant = this.tenants.get(tenantId);
        if (tenant) {
            return {
                street: tenant.mieterstr || tenant.street,
                city: tenant.mieterort || tenant.city,
                plz: tenant.plz,
                isCustom: false
            };
        }

        return null;
    }

    resetPostAddress(tenantId) {
        this.customPostAddresses.delete(tenantId);

        // Sofort im LocalStorage speichern
        this.saveCustomPostAddressesToStorage();
        console.log(`Postadresse für ${tenantId} auf Standard zurückgesetzt und gespeichert`);
    }

    saveCustomPostAddressesToStorage() {
        try {
            const data = {
                addresses: Array.from(this.customPostAddresses.entries()),
                version: this.version,
                savedAt: new Date().toISOString()
            };
            localStorage.setItem('mahnmanager_custom_post_addresses', JSON.stringify(data));
            console.log(`${this.customPostAddresses.size} benutzerdefinierte Postadressen gespeichert`);
        } catch (error) {
            console.error('Fehler beim Speichern der Postadressen:', error);
        }
    }

    hasCustomPostAddress(tenantId) {
        return this.customPostAddresses.has(tenantId);
    }

    getCustomPostAddressesInfo() {
        return {
            count: this.customPostAddresses.size,
            tenants: Array.from(this.customPostAddresses.keys()),
            storageSize: this.calculatePostAddressStorageSize()
        };
    }

    calculatePostAddressStorageSize() {
        try {
            const data = localStorage.getItem('mahnmanager_custom_post_addresses');
            return data ? Math.round(data.length / 1024 * 100) / 100 : 0; // KB
        } catch {
            return 0;
        }
    }

    exportData() {
        const data = {
            tenants: Array.from(this.tenants.entries()),
            portfolios: Array.from(this.portfolios.entries()),
            currentPortfolioFilter: this.currentPortfolioFilter,
            csvMahngebuehrenCache: Array.from(this.csvMahngebuehrenCache.entries()),
            customPostAddresses: Array.from(this.customPostAddresses.entries()), // NEU
            exportDate: new Date().toISOString(),
            version: this.version
        };

        if (mahnstufen) {
            data.mahnstufen = Array.from(mahnstufen.tenantMahnstufen.entries());
            data.individualMahngebuehren = Array.from(mahnstufen.individualMahngebuehren.entries());
        }

        return JSON.stringify(data, null, 2);
    }


    createTenantFromRecord(record) {
        const bankData = this.extractBankData(record);
        return {
            id: record['oemn'],
            name: TenantUtils.buildTenantName(record),
            name1: record['name1'] || '',
            name2: record['name2'] || '',
            anrede1: record['anrede1'] || '',
            anrede2: record['anrede2'] || '',
            // NEU: E-Mail-Felder hinzufügen
            email01: record['email01'] || '',
            email02: record['email02'] || '',
            street: record['hausstr'] || '',
            plz: TenantUtils.extractPLZ(record['hausort']),
            city: TenantUtils.extractCity(record['hausort']),
            address: `${record['hausstr']}, ${record['hausort']}`,
            portfolio: record['portfolioname'] || TenantManagerConfig.DEFAULT_PORTFOLIO,
            bankData,
            iban: bankData.iban,
            bic: bankData.bic,
            bank: bankData.bank,
            ktoinh: bankData.kontoinhaber,
            kontoinhaber: bankData.kontoinhaber,
            anwaltName: record['anwaltname'] || '',
            hasAnwalt: TenantUtils.hasAnwaltAssigned(record['anwaltname']),
            csvMahngebuehr: TenantManagerConfig.DEFAULT_MAHNGEBUEHR,
            mahngebuehrenText: record['mahngebuehren'] || '',
            csvMahngebuehrOriginal: record['mahngebuehren'] || '',
            records: [],
            totalDifference: 0,
            selected: false,
            mahnstufe: TenantManagerConfig.DEFAULT_MAHNSTUFE,
            lastMahnungDate: null,
            mahnungsHistory: [],
            createdAt: new Date(),
            lastUpdated: new Date()
        };
    }
    extractBankData(record) {
        return {
            iban: record['iban'] || '',
            bic: record['bic'] || '',
            bank: record['bank'] || '',
            kontoinhaber: record['ktoinh'] || ''
        };
    }

    initializeMahnstufe(tenantId) {
        if (typeof mahnstufen !== 'undefined' && mahnstufen.initializeTenants) {
            mahnstufen.initializeTenants([tenantId]);
        }
    }

    // NEU: Mahngebühren aus CSV initialisieren
    initializeMahngebuehrenFromCSV(tenantId, record) {
        try {
            const mahngebuehrenText = record['mahngebuehren'];
            const extractedAmount = TenantUtils.extractMahngebuehrenFromText(mahngebuehrenText);

            // Speichere die CSV-Mahngebühr im Tenant
            const tenant = this.tenants.get(tenantId);
            if (tenant) {
                tenant.csvMahngebuehr = extractedAmount;
                tenant.mahngebuehrenText = mahngebuehrenText || '';
                tenant.csvMahngebuehrOriginal = mahngebuehrenText || '';
            }

            // Cache für schnellen Zugriff
            this.csvMahngebuehrenCache.set(tenantId, extractedAmount);

            // Setze die extrahierte Mahngebühr als Standard für das Mahnstufen-System
            if (typeof mahnstufen !== 'undefined' && mahnstufen.setCSVMahngebuehr) {
                mahnstufen.setCSVMahngebuehr(tenantId, extractedAmount);
            }

            console.log(`📋 CSV-Mahngebühr für ${tenantId} initialisiert: ${extractedAmount}€ (aus: "${mahngebuehrenText}")`);

        } catch (error) {
            console.error(`❌ Fehler beim Initialisieren der CSV-Mahngebühren für ${tenantId}:`, error);

            // Fallback
            const tenant = this.tenants.get(tenantId);
            if (tenant) {
                tenant.csvMahngebuehr = TenantManagerConfig.DEFAULT_MAHNGEBUEHR;
                this.csvMahngebuehrenCache.set(tenantId, TenantManagerConfig.DEFAULT_MAHNGEBUEHR);
            }
        }
    }

    // NEU: Mahngebühren bei weiteren Records aktualisieren
    updateMahngebuehrenFromCSV(tenantId, record) {
        try {
            const tenant = this.tenants.get(tenantId);
            const mahngebuehrenText = record['mahngebuehren'];

            // Nur aktualisieren wenn sich der Text geändert hat
            if (tenant && tenant.csvMahngebuehrOriginal !== mahngebuehrenText) {
                console.log(`🔄 Aktualisiere Mahngebühr für ${tenantId}: "${tenant.csvMahngebuehrOriginal}" -> "${mahngebuehrenText}"`);
                this.initializeMahngebuehrenFromCSV(tenantId, record);
            }
        } catch (error) {
            console.error(`❌ Fehler beim Aktualisieren der CSV-Mahngebühren für ${tenantId}:`, error);
        }
    }

    addRecordToTenant(tenantId, record) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) return;

        const recordWithStatus = {
            ...record,
            id: Utils.generateUniqueId(`${tenantId}_pos`),
            enabled: true,
            createdAt: new Date()
        };

        tenant.records.push(recordWithStatus);

        const difference = TenantUtils.calculateRecordDifference(record);
        tenant.totalDifference += difference;

        if (record.mahngebuehren && !tenant.csvMahngebuehr) {
            const cleanValue = parseFloat(record.mahngebuehren.replace(/[€,]/g, '.').replace(/\s/g, ''));
            if (!isNaN(cleanValue)) {
                tenant.csvMahngebuehr = cleanValue;
            }
        }

        if (tenant.totalDifference < 0) {
            tenant.selected = true;
        }

        tenant.lastUpdated = new Date();
    }

    calculateTenantTotal(tenant) {
        return tenant.records
            .filter(record => record.enabled)
            .reduce((total, record) => {
                return total + TenantUtils.calculateRecordDifference(record);
            }, 0);
    }

    // NEU: CSV-Mahngebühr abrufen
    // REPLACE: Nur die getCSVMahngebuehr Funktion
    getCSVMahngebuehr(tenantId) {
        // Cache prüfen
        if (this.csvMahngebuehrenCache.has(tenantId)) {
            return this.csvMahngebuehrenCache.get(tenantId);
        }

        // CSV-Daten direkt prüfen
        if (window.app?.csvData) {
            const record = window.app.csvData.find(r => r.oemn === tenantId && r.mahngebuehren);
            if (record) {
                const cleanValue = parseFloat(record.mahngebuehren.replace(/[€,]/g, '.').replace(/\s/g, ''));
                if (!isNaN(cleanValue)) {
                    this.csvMahngebuehrenCache.set(tenantId, cleanValue);
                    return cleanValue;
                }
            }
        }

        // Tenant prüfen (fallback)
        const tenant = this.tenants.get(tenantId);
        if (tenant && typeof tenant.csvMahngebuehr === 'number') {
            return tenant.csvMahngebuehr;
        }

        return TenantManagerConfig.DEFAULT_MAHNGEBUEHR;
    }
    // NEU: CSV-Mahngebühr setzen (für manuelle Überschreibung)
    setCSVMahngebuehr(tenantId, amount) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) return false;

        const validAmount = parseFloat(amount);
        if (isNaN(validAmount) || validAmount < 0 || validAmount > 999.99) {
            console.error(`❌ Ungültige Mahngebühr für ${tenantId}: ${amount}`);
            return false;
        }

        tenant.csvMahngebuehr = validAmount;
        this.csvMahngebuehrenCache.set(tenantId, validAmount);
        tenant.lastUpdated = new Date();
        this.invalidateCache();

        console.log(`✅ CSV-Mahngebühr für ${tenantId} manuell gesetzt: ${validAmount}€`);
        return true;
    }

    // NEU: Mahngebühren-Text abrufen
    getMahngebuehrenText(tenantId) {
        const tenant = this.tenants.get(tenantId);
        return tenant?.mahngebuehrenText || '';
    }

    // NEU: Statistiken für CSV-Mahngebühren
    getCSVMahngebuehrenStatistics() {
        const stats = {
            totalTenants: this.tenants.size,
            tenantsWithCSVMahngebuehr: 0,
            tenantsWithCustomText: 0,
            averageAmount: 0,
            minAmount: Number.MAX_VALUE,
            maxAmount: 0,
            standardAmount: 0,
            amounts: new Map()
        };

        let totalAmount = 0;

        this.tenants.forEach((tenant, tenantId) => {
            const csvAmount = this.getCSVMahngebuehr(tenantId);

            if (csvAmount > 0) {
                stats.tenantsWithCSVMahngebuehr++;
                totalAmount += csvAmount;

                stats.minAmount = Math.min(stats.minAmount, csvAmount);
                stats.maxAmount = Math.max(stats.maxAmount, csvAmount);

                // Häufigkeit der Beträge
                const key = csvAmount.toFixed(2);
                stats.amounts.set(key, (stats.amounts.get(key) || 0) + 1);
            }

            if (tenant.mahngebuehrenText && tenant.mahngebuehrenText.trim()) {
                stats.tenantsWithCustomText++;
            }

            if (csvAmount === TenantManagerConfig.DEFAULT_MAHNGEBUEHR) {
                stats.standardAmount++;
            }
        });

        stats.averageAmount = stats.tenantsWithCSVMahngebuehr > 0 ?
            totalAmount / stats.tenantsWithCSVMahngebuehr : 0;

        if (stats.minAmount === Number.MAX_VALUE) stats.minAmount = 0;

        return stats;
    }

    getTenantBankData(tenantId) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) return null;

        if (TenantUtils.hasValidBankData(tenant.bankData)) {
            return tenant.bankData;
        }

        const fallbackBankData = {
            iban: tenant.iban,
            bic: tenant.bic,
            bank: tenant.bank,
            kontoinhaber: tenant.ktoinh || tenant.kontoinhaber
        };

        if (TenantUtils.hasValidBankData(fallbackBankData)) {
            return fallbackBankData;
        }

        const recordWithBankData = tenant.records?.find(record =>
            record.iban || record.bic || record.bank || record.ktoinh
        );

        if (recordWithBankData) {
            return {
                iban: recordWithBankData.iban,
                bic: recordWithBankData.bic,
                bank: recordWithBankData.bank,
                kontoinhaber: recordWithBankData.ktoinh
            };
        }

        return null;
    }

    updateTenantBankData(tenantId, newBankData) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) return false;

        tenant.bankData = { ...newBankData };
        tenant.iban = newBankData.iban || '';
        tenant.bic = newBankData.bic || '';
        tenant.bank = newBankData.bank || '';
        tenant.ktoinh = newBankData.kontoinhaber || '';
        tenant.kontoinhaber = newBankData.kontoinhaber || '';
        tenant.lastUpdated = new Date();

        this.invalidateCache();
        return true;
    }

    getTenantAnrede(tenantId) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) return TenantManagerConfig.DEFAULT_ANREDE;

        const { anrede1, anrede2 } = tenant;

        if (anrede1 && anrede2) return `${anrede1},\n${anrede2},`;
        if (anrede1) return `${anrede1},`;
        if (anrede2) return `${anrede2},`;

        return TenantManagerConfig.DEFAULT_ANREDE;
    }

    getTenantStatus(totalDifference) {
        if (totalDifference < 0) return { class: 'debt', text: 'Schulden' };
        if (totalDifference > 0) return { class: 'credit', text: 'Guthaben' };
        return { class: 'neutral', text: 'Ausgeglichen' };
    }

    getTenantMahnStatus(tenantId) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) return null;

        const totalDifference = this.calculateTenantTotal(tenant);
        const mahnstufe = mahnstufen?.getMahnstufe(tenantId) || tenant.mahnstufe;
        const mahnstufenConfig = mahnstufen?.getMahnstufeConfig(mahnstufe);

        return {
            hasDebt: totalDifference < 0,
            debtAmount: Math.abs(totalDifference),
            mahnstufe,
            mahnstufenConfig,
            lastMahnungDate: tenant.lastMahnungDate,
            mahnungsCount: tenant.mahnungsHistory.length,
            csvMahngebuehr: this.getCSVMahngebuehr(tenantId) // NEU
        };
    }

    registerMahnung(tenantId, mahnstufe, amount) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) return false;

        const mahnungEntry = {
            date: new Date(),
            mahnstufe,
            amount,
            csvMahngebuehr: this.getCSVMahngebuehr(tenantId), // NEU
            id: Utils.generateUniqueId('mahnung')
        };

        tenant.lastMahnungDate = mahnungEntry.date;
        tenant.mahnungsHistory.push(mahnungEntry);
        tenant.mahnstufe = mahnstufe;
        tenant.lastUpdated = new Date();

        this.invalidateCache();
        console.log(`📧 Mahnung registriert für ${tenant.name} (CSV-Gebühr: ${mahnungEntry.csvMahngebuehr}€)`);
        return true;
    }

    setTenantMahnstufe(tenantId, mahnstufe) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant || !Utils.isValidMahnstufe?.(mahnstufe)) return false;

        tenant.mahnstufe = mahnstufe;
        tenant.lastUpdated = new Date();
        mahnstufen?.setMahnstufe(tenantId, mahnstufe);
        this.invalidateCache();
        return true;
    }

    toggleCostPosition(recordId, enabled) {
        for (const [tenantId, tenant] of this.tenants) {
            const record = tenant.records.find(r => r.id === recordId);
            if (record) {
                record.enabled = enabled;
                const totalDifference = this.calculateTenantTotal(tenant);
                if (totalDifference < 0 && !tenant.selected) {
                    tenant.selected = true;
                }
                tenant.lastUpdated = new Date();
                this.invalidateCache();
                return tenantId;
            }
        }
        return null;
    }

    addToPortfolio(portfolioName) {  // KORREKTUR: Nur 1 Parameter
        if (!portfolioName) {
            console.error('Portfolio-Name ist undefined!');
            return;
        }

        if (!this.portfolios.has(portfolioName)) {
            this.portfolios.set(portfolioName, {
                name: portfolioName,
                tenantIds: new Set(),
                tenantCount: 0,
                createdAt: new Date(),
                lastUpdated: new Date()
            });
        }

        // Portfolio wird nur erstellt, Tenants werden nicht hinzugefügt
        // (Das passiert automatisch über getFilteredTenants)
    }

    setPortfolioFilter(portfolioName) {
        this.currentPortfolioFilter = portfolioName;
        this.invalidateCache();
    }

    clearPortfolioFilter() {
        this.currentPortfolioFilter = null;
        this.invalidateCache();
    }

    setAnwaltFilter(anwaltType) {
        this.currentAnwaltFilter = anwaltType;
        this.invalidateCache();
    }

    clearAnwaltFilter() {
        this.currentAnwaltFilter = null;
        this.invalidateCache();
    }

    getCurrentPortfolioFilter() {
        return this.currentPortfolioFilter;
    }

    // tenantManager.js - BUGFIX
    // Alternative: Vollständige Portfolio-Statistiken einbauen
    // Temporärer Debug-Code in getAllPortfolios()
    getAllPortfolios() {
        const result = Array.from(this.portfolios.entries())
            .map(([name, portfolio]) => {
                console.log(`Portfolio ${name}:`, {
                    tenantIds: portfolio.tenantIds,
                    size: portfolio.tenantIds.size,
                    array: Array.from(portfolio.tenantIds)
                });

                return {
                    name: name,
                    tenantCount: portfolio.tenantIds.size,
                    tenantIds: portfolio.tenantIds
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        console.log('Final portfolios result:', result);
        return result;
    }

    getPortfolioStatistics() {
        const stats = {};

        this.portfolios.forEach((portfolio, name) => {
            const tenants = Array.from(portfolio.tenantIds)
                .map(id => this.tenants.get(id))
                .filter(Boolean);

            let tenantsWithDebt = 0;
            let totalDebt = 0;
            let totalCSVMahngebuehren = 0; // NEU

            tenants.forEach(tenant => {
                const total = this.calculateTenantTotal(tenant);
                if (total < 0) {
                    tenantsWithDebt++;
                    totalDebt += Math.abs(total);
                }
                totalCSVMahngebuehren += this.getCSVMahngebuehr(tenant.id); // NEU
            });

            stats[name] = {
                totalTenants: tenants.length,
                tenantsWithDebt,
                totalDebt,
                totalCSVMahngebuehren, // NEU
                averageCSVMahngebuehr: tenants.length > 0 ? totalCSVMahngebuehren / tenants.length : 0 // NEU
            };
        });

        return stats;
    }


    getFilteredTenants() {
        const allTenants = Array.from(this.tenants.values());
        let filtered = allTenants;

        // Portfolio-Filter
        if (this.currentPortfolioFilter) {
            console.log('Portfolio-Filter aktiv:', this.currentPortfolioFilter);
            const beforeCount = filtered.length;
            filtered = filtered.filter(tenant => {
                const match = tenant.portfolio === this.currentPortfolioFilter;
                return match;
            });
        }

        // Anwalt-Filter
        if (this.currentAnwaltFilter) {
            console.log('Anwalt-Filter aktiv:', this.currentAnwaltFilter);
            const beforeCount = filtered.length;
            if (this.currentAnwaltFilter === 'WITH_ANWALT') {
                filtered = filtered.filter(tenant => tenant.hasAnwalt === true);
            } else if (this.currentAnwaltFilter === 'WITHOUT_ANWALT') {
                filtered = filtered.filter(tenant => tenant.hasAnwalt !== true);
            }
            console.log(`Anwalt-Filter: ${beforeCount} -> ${filtered.length}`);
        }

        // GEÄNDERT: Schulden-Betrag-Filter
        if (this.currentSchuldenFilter !== null && this.currentSchuldenFilter !== '') {
            const minSchuldenBetrag = parseFloat(this.currentSchuldenFilter) || 0;
            console.log('Schulden-Filter aktiv: Min.', minSchuldenBetrag, '€');

            const beforeCount = filtered.length;
            filtered = filtered.filter(tenant => {
                const totalDifference = this.calculateTenantTotal(tenant);
                // Nur Mieter mit Schulden >= eingegebenem Betrag
                return totalDifference <= -minSchuldenBetrag; // Negativ = Schulden
            });
            console.log(`Schulden-Filter: ${beforeCount} -> ${filtered.length}`);
        }

        return filtered;
    }

    // Optional: Explizite filterTenants-Methode zur TenantManager-Klasse hinzufügen
    filterTenants(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            return this.getAllTenants();
        }

        const search = searchTerm.toLowerCase().trim();
        const allTenants = this.getAllTenants();

        return allTenants.filter(tenant => {
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
    }
    filterTenantsAdvanced(options = {}) {
        const {
            searchTerm = '', mahnstufe = null, hasDebt = null, selected = null,
            portfolio = null, hasAnwalt = null, anwaltName = null,
            csvMahngebuehrMin = null, csvMahngebuehrMax = null // NEU
        } = options;

        let result = new Map();
        this.getFilteredTenants().forEach(tenant => {
            result.set(tenant.id, tenant);
        });

        if (searchTerm?.trim()) {
            result = this.filterTenants(searchTerm);
        }

        const filtered = new Map();
        result.forEach((tenant, tenantId) => {
            if (!this.matchesFilters(tenant, tenantId, {
                mahnstufe, hasDebt, selected, portfolio, hasAnwalt, anwaltName,
                csvMahngebuehrMin, csvMahngebuehrMax // NEU
            })) return;

            filtered.set(tenantId, tenant);
        });

        return filtered;
    }

    matchesFilters(tenant, tenantId, filters) {
        const {
            mahnstufe, hasDebt, selected, portfolio, hasAnwalt, anwaltName,
            csvMahngebuehrMin, csvMahngebuehrMax // NEU
        } = filters;

        if (mahnstufe !== null) {
            const currentMahnstufe = mahnstufen?.getMahnstufe(tenantId) || tenant.mahnstufe;
            if (currentMahnstufe !== mahnstufe) return false;
        }

        if (hasDebt !== null) {
            const tenantHasDebt = this.calculateTenantTotal(tenant) < 0;
            if (tenantHasDebt !== hasDebt) return false;
        }

        if (selected !== null && tenant.selected !== selected) return false;
        if (portfolio !== null && tenant.portfolio !== portfolio) return false;
        if (hasAnwalt !== null && tenant.hasAnwalt !== hasAnwalt) return false;

        if (anwaltName !== null && anwaltName.trim() !== '') {
            if (!tenant.hasAnwalt || !tenant.anwaltName ||
                !tenant.anwaltName.toLowerCase().includes(anwaltName.toLowerCase())) {
                return false;
            }
        }

        // NEU: Filter nach CSV-Mahngebühren
        if (csvMahngebuehrMin !== null || csvMahngebuehrMax !== null) {
            const csvMahngebuehr = this.getCSVMahngebuehr(tenantId);

            if (csvMahngebuehrMin !== null && csvMahngebuehr < csvMahngebuehrMin) return false;
            if (csvMahngebuehrMax !== null && csvMahngebuehr > csvMahngebuehrMax) return false;
        }

        return true;
    }

    selectAllTenants() {
        return this.bulkSelectTenants(() => true);
    }

    deselectAllTenants() {
        return this.bulkDeselectTenants(() => true);
    }

    selectAllTenantsWithDebt() {
        return this.bulkSelectTenants(tenant => this.calculateTenantTotal(tenant) < 0);
    }

    selectAllTenantsWithAnwalt() {
        return this.bulkSelectTenants(tenant => tenant.hasAnwalt);
    }

    selectAllTenantsWithoutAnwalt() {
        return this.bulkSelectTenants(tenant => !tenant.hasAnwalt);
    }

    selectTenantsByMahnstufe(mahnstufe) {
        return this.bulkSelectTenants(tenant => {
            const currentMahnstufe = mahnstufen?.getMahnstufe(tenant.id) || tenant.mahnstufe;
            return currentMahnstufe === mahnstufe;
        });
    }

    // NEU: Auswahl nach CSV-Mahngebühren
    selectTenantsByCSVMahngebuehr(amount) {
        return this.bulkSelectTenants(tenant => {
            const csvMahngebuehr = this.getCSVMahngebuehr(tenant.id);
            return Math.abs(csvMahngebuehr - amount) < 0.01; // Toleranz für Fließkomma-Vergleich
        });
    }

    bulkSelectTenants(condition) {
        let count = 0;
        this.getFilteredTenants().forEach(tenant => {
            if (condition(tenant) && !tenant.selected) {
                tenant.selected = true;
                tenant.lastUpdated = new Date();
                count++;
            }
        });
        if (count > 0) this.invalidateCache();
        return count;
    }

    bulkDeselectTenants(condition) {
        let count = 0;
        this.getFilteredTenants().forEach(tenant => {
            if (condition(tenant) && tenant.selected) {
                tenant.selected = false;
                tenant.lastUpdated = new Date();
                count++;
            }
        });
        if (count > 0) this.invalidateCache();
        return count;
    }

    selectAllPositions(tenantId) {
        return this.bulkTogglePositions(tenantId, true);
    }

    deselectAllPositions(tenantId) {
        return this.bulkTogglePositions(tenantId, false);
    }

    bulkTogglePositions(tenantId, enabled) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) return 0;

        let count = 0;
        tenant.records.forEach(record => {
            if (record.enabled !== enabled) {
                record.enabled = enabled;
                count++;
            }
        });

        if (count > 0) {
            tenant.lastUpdated = new Date();
            this.invalidateCache();
        }
        return count;
    }
    getSelectedTenants() {
        return this.getFilteredTenants().filter(tenant => tenant.selected);
    }

    getTenantsWithDebt() {
        return this.getFilteredTenants().filter(tenant =>
            tenant.selected && this.calculateTenantTotal(tenant) < 0
        );
    }

    getTenantsWithAnwalt() {
        return this.getFilteredTenants().filter(tenant => tenant.hasAnwalt);
    }

    getTenantsWithoutAnwalt() {
        return this.getFilteredTenants().filter(tenant => !tenant.hasAnwalt);
    }

    getTenantsByMahnstufe(mahnstufe) {
        return this.getFilteredTenants().filter(tenant => {
            const currentMahnstufe = mahnstufen?.getMahnstufe(tenant.id) || tenant.mahnstufe;
            return currentMahnstufe === mahnstufe;
        });
    }

    // NEU: Tenants nach CSV-Mahngebühr abrufen
    getTenantsByCSVMahngebuehr(amount, tolerance = 0.01) {
        return this.getFilteredTenants().filter(tenant => {
            const csvMahngebuehr = this.getCSVMahngebuehr(tenant.id);
            return Math.abs(csvMahngebuehr - amount) <= tolerance;
        });
    }

    getStatistics() {
        const now = Date.now();
        if (this.statisticsCache && (now - this.lastCacheUpdate) < TenantManagerConfig.CACHE_TIMEOUT) {
            return this.statisticsCache;
        }

        const stats = this.calculateStatistics();
        this.statisticsCache = stats;
        this.lastCacheUpdate = now;
        return stats;
    }

    calculateStatistics() {
        const filteredTenants = this.getFilteredTenants();
        let tenantsWithDebt = 0, tenantsWithCredit = 0, totalDebtAmount = 0, totalCreditAmount = 0;
        let tenantsWithAnwalt = 0, tenantsWithAnwaltAndDebt = 0;
        const mahnstufenStats = { stufe1: 0, stufe2: 0, stufe3: 0 };

        filteredTenants.forEach(tenant => {
            const total = this.calculateTenantTotal(tenant);

            if (total < 0) {
                tenantsWithDebt++;
                totalDebtAmount += Math.abs(total);
                if (tenant.hasAnwalt) tenantsWithAnwaltAndDebt++;
            } else if (total > 0) {
                tenantsWithCredit++;
                totalCreditAmount += total;
            }

            // KORREKTUR: hasAnwalt boolean check
            if (tenant.hasAnwalt === true) {
                tenantsWithAnwalt++;
            }

            const mahnstufe = mahnstufen?.getMahnstufe(tenant.id) || tenant.mahnstufe;
            if (mahnstufe >= 1 && mahnstufe <= 3) {
                mahnstufenStats[`stufe${mahnstufe}`]++;
            }
        });

        return {
            totalTenants: filteredTenants.length,
            tenantsWithDebt,
            tenantsWithCredit,
            totalDebtAmount,
            totalCreditAmount,
            mahnstufenStats,
            tenantsWithAnwalt,  // Das ist der wichtige Wert für den Dropdown!
            tenantsWithAnwaltAndDebt,
            currentPortfolio: this.currentPortfolioFilter,
            totalPortfolios: this.portfolios.size,
            lastUpdated: new Date()
        };
    }

    invalidateCache() {
        this.statisticsCache = null;
        this.lastCacheUpdate = 0;
        // NEU: CSV-Cache bei Bedarf invalidieren
        this.csvMahngebuehrenCache.clear();
    }

    getAllTenants() {
        return this.getFilteredTenants();
    }

    getTenant(tenantId) {
        return this.tenants.get(tenantId);
    }

    reset() {
        this.tenants.clear();
        this.portfolios.clear();
        this.currentPortfolioFilter = null;
        this.csvMahngebuehrenCache.clear();
        this.invalidateCache();

        // WICHTIG: Alle benutzerdefinierten Daten bleiben erhalten!
        console.log(`TenantManager zurückgesetzt, ${this.customPostAddresses.size} Postadressen, ${this.customNames.size} Namen und ${this.customAnreden.size} Anreden bleiben erhalten`);

        if (mahnstufen) {
            mahnstufen.tenantMahnstufen.clear();
            mahnstufen.individualMahngebuehren.clear();
            mahnstufen.saveToStorage();
        }
    }

    exportData() {
        const data = {
            tenants: Array.from(this.tenants.entries()),
            portfolios: Array.from(this.portfolios.entries()),
            currentPortfolioFilter: this.currentPortfolioFilter,
            csvMahngebuehrenCache: Array.from(this.csvMahngebuehrenCache.entries()), // NEU
            exportDate: new Date().toISOString(),
            version: this.version
        };

        if (mahnstufen) {
            data.mahnstufen = Array.from(mahnstufen.tenantMahnstufen.entries());
            data.individualMahngebuehren = Array.from(mahnstufen.individualMahngebuehren.entries());
        }

        return JSON.stringify(data, null, 2);
    }

    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (!data.tenants || !Array.isArray(data.tenants)) {
                throw new Error('Ungültiges Datenformat');
            }

            this.reset();
            this.tenants = new Map(data.tenants);

            if (data.portfolios) this.portfolios = new Map(data.portfolios);
            if (data.currentPortfolioFilter) this.currentPortfolioFilter = data.currentPortfolioFilter;
            if (data.csvMahngebuehrenCache) {
                this.csvMahngebuehrenCache = new Map(data.csvMahngebuehrenCache);
            }
            if (data.customPostAddresses) { // NEU
                this.customPostAddresses = new Map(data.customPostAddresses);
            }

            if (data.mahnstufen && mahnstufen) {
                mahnstufen.tenantMahnstufen = new Map(data.mahnstufen);
                if (data.individualMahngebuehren) {
                    mahnstufen.individualMahngebuehren = new Map(data.individualMahngebuehren);
                }
                mahnstufen.saveToStorage();
            }

            console.log(`Daten importiert: ${this.tenants.size} Tenants, Version ${data.version || 'unbekannt'}`);
            return true;
        } catch (error) {
            console.error(`Fehler beim Importieren der Daten: ${error.message}`);
            return false;
        }
    }

    getSystemInfo() {
        const csvStats = this.getCSVMahngebuehrenStatistics();

        return {
            version: this.version,
            tenantCount: this.tenants.size,
            portfolioCount: this.portfolios.size,
            csvMahngebuehrenCacheSize: this.csvMahngebuehrenCache.size, // NEU
            csvMahngebuehrenStats: csvStats, // NEU
            memoryUsage: this.calculateMemoryUsage(),
            cacheStatus: {
                active: !!this.statisticsCache,
                age: this.lastCacheUpdate ? Date.now() - this.lastCacheUpdate : 0
            }
        };
    }

    calculateMemoryUsage() {
        try {
            const tenantsString = JSON.stringify(Array.from(this.tenants.entries()));
            const csvCacheString = JSON.stringify(Array.from(this.csvMahngebuehrenCache.entries())); // NEU

            const totalSize = tenantsString.length + csvCacheString.length;

            return {
                bytes: totalSize,
                kb: Math.round(totalSize / 1024),
                mb: Math.round(totalSize / 1024 / 1024 * 100) / 100,
                breakdown: { // NEU
                    tenants: Math.round(tenantsString.length / 1024),
                    csvCache: Math.round(csvCacheString.length / 1024)
                }
            };
        } catch (error) {
            return { error: 'Berechnung fehlgeschlagen' };
        }
    }

    // NEU: Debug-Funktionen für CSV-Mahngebühren
    debugCSVMahngebuehren() {
        console.log('=== CSV-MAHNGEBÜHREN DEBUG ===');
        console.log(`Total Tenants: ${this.tenants.size}`);
        console.log(`Cache Size: ${this.csvMahngebuehrenCache.size}`);

        const stats = this.getCSVMahngebuehrenStatistics();
        console.log('Statistiken:', stats);

        // Zeige erste 10 Tenants mit Details
        let count = 0;
        this.tenants.forEach((tenant, tenantId) => {
            if (count < 10) {
                const csvAmount = this.getCSVMahngebuehr(tenantId);
                console.log(`${tenantId}: ${csvAmount}€ (Text: "${tenant.mahngebuehrenText}")`);
                count++;
            }
        });

        console.log('===============================');
    }

    // NEU: Bulk-Update für CSV-Mahngebühren
    bulkUpdateCSVMahngebuehren(updates) {
        let successCount = 0;
        let errorCount = 0;

        updates.forEach(({ tenantId, amount }) => {
            if (this.setCSVMahngebuehr(tenantId, amount)) {
                successCount++;
            } else {
                errorCount++;
            }
        });

        console.log(`📊 Bulk-Update CSV-Mahngebühren: ${successCount} erfolgreich, ${errorCount} Fehler`);
        return { successCount, errorCount };
    }

    // NEU: Validierung der CSV-Mahngebühren-Daten
    validateCSVMahngebuehrenData() {
        const issues = [];

        this.tenants.forEach((tenant, tenantId) => {
            const csvAmount = this.getCSVMahngebuehr(tenantId);

            if (csvAmount === TenantManagerConfig.DEFAULT_MAHNGEBUEHR &&
                (!tenant.mahngebuehrenText || !tenant.mahngebuehrenText.trim())) {
                issues.push(`${tenantId}: Verwendet Standard-Mahngebühr ohne CSV-Text`);
            }

            if (csvAmount <= 0) {
                issues.push(`${tenantId}: Ungültige Mahngebühr: ${csvAmount}€`);
            }

            if (csvAmount > 100) {
                issues.push(`${tenantId}: Ungewöhnlich hohe Mahngebühr: ${csvAmount}€`);
            }
        });

        return issues;
    }

    // Nach den Portfolio-Filter Funktionen hinzufügen:

    setAnwaltFilter(anwaltType) {
        this.currentAnwaltFilter = anwaltType;
        this.invalidateCache();
    }

    getCurrentAnwaltFilter() {
        return this.currentAnwaltFilter;
    }

}

window.TenantManager = TenantManager;
/* console.log(`✅ TenantManager v${TenantManagerConfig.VERSION} geladen mit CSV-Mahngebühren-Support`); */
