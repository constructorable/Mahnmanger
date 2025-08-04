class PDFBankverbindungModule {
    constructor(pdfGenerator) {
        this.pdf = pdfGenerator;
    }

    async addBankingDetails(doc, tenant, margin, yPosition, pageWidth) {
        try {
            if (!tenant) {
                console.error('Kein Tenant-Objekt übergeben');
                return this.addDefaultBankDetails(doc, tenant, margin, yPosition, pageWidth);
            }

            if (!tenant.records || !Array.isArray(tenant.records)) {
                console.error('Tenant.records ist nicht verfügbar oder kein Array:', tenant.records);
                console.log('Verfügbare Tenant-Felder:', Object.keys(tenant));

                if (this.pdf?.tenantManager && tenant.id) {
                    const fullTenant = this.pdf.tenantManager.getTenant(tenant.id);
                    if (fullTenant && fullTenant.records) {
                        tenant.records = fullTenant.records;
                        console.log('  Records für Bankverbindung wiederhergestellt');
                    } else {
                        console.warn('⚠️ Keine Records verfügbar - verwende Standard-Bankdaten');
                        return this.addDefaultBankDetails(doc, tenant, margin, yPosition, pageWidth);
                    }
                } else {
                    return this.addDefaultBankDetails(doc, tenant, margin, yPosition, pageWidth);
                }
            }

            const bankData = this.extractBankDataFromTenant(tenant);
            if (!this.hasValidBankData(bankData)) {
                return this.addDefaultBankDetails(doc, tenant, margin, yPosition, pageWidth);
            }

            return this.renderBankDataTable(doc, bankData, tenant, margin, yPosition + 2, pageWidth);

        } catch (error) {
            console.error('Fehler in addBankingDetails:', error);
            return this.addDefaultBankDetails(doc, tenant, margin, yPosition, pageWidth);
        }
    }

    renderBankDataTable(doc, bankData, tenant, margin, yPosition, pageWidth) {
        const tableWidth = pageWidth - (2 * margin);
        const columnWidth = tableWidth / 2;
        const labelWidth = columnWidth * 0.35;
        const rowHeight = 4;
        const startY = yPosition;
        const boxOffset = 2;

        const totalDifference = this.pdf.tenantManager.calculateTenantTotal(tenant);
        const schuldenBetrag = Math.abs(totalDifference);
        const mahngebuehr = this.getIndividualMahngebuehr(tenant.id);
        const ueberweisungsbetrag = schuldenBetrag + mahngebuehr;

        const formattedBetrag = Utils.formatAmount(ueberweisungsbetrag);
        const verwendungszweck = this.createVerwendungszweck(tenant);

        // *** NEU: Speichere Daten für E-Mail-Verwendung ***
        this.saveDataForEmail(tenant.id, {
            bankData: bankData,
            schuldenBetrag: schuldenBetrag,
            mahngebuehr: mahngebuehr,
            ueberweisungsbetrag: ueberweisungsbetrag,
            verwendungszweck: verwendungszweck,
            totalDifference: totalDifference
        });

        console.log(`💳 [BANKDATEN] ${tenant.id}: Schulden=${Utils.formatAmount(schuldenBetrag)}, Gebühren=${Utils.formatAmount(mahngebuehr)}, Gesamt=${formattedBetrag}`);

        let rowCount = 0;
        if (bankData.kontoinhaber || bankData.bank) rowCount++;
        if (bankData.iban || bankData.bic) rowCount++;
        if (ueberweisungsbetrag > 0 || verwendungszweck) rowCount++;

        const totalHeight = (rowCount * (rowHeight + 1)) + 1;

        doc.setFillColor(245, 245, 245);
        doc.rect(margin - 2 + boxOffset, startY - 4, tableWidth + 4, totalHeight, 'F');

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.rect(margin - 2 + boxOffset, startY - 4, tableWidth + 4, totalHeight);

        let currentY = yPosition;

        if (bankData.kontoinhaber || bankData.bank) {
            if (bankData.kontoinhaber) {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(80, 80, 80);
                doc.text('Kontoinhaber:', margin + 3, currentY);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0, 0, 0);
                doc.text(bankData.kontoinhaber, margin + labelWidth, currentY);
            }

            if (bankData.bank) {
                const rightColumnX = margin + columnWidth;

                doc.setFont('helvetica', 'bold');
                doc.setTextColor(80, 80, 80);
                doc.text('Bank:', rightColumnX, currentY);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0, 0, 0);
                doc.text(bankData.bank, rightColumnX + (labelWidth * 0.7), currentY);
            }

            currentY += rowHeight + 1;
        }

        if (bankData.iban || bankData.bic) {
            if (bankData.iban) {
                const formattedIBAN = this.formatIBAN(bankData.iban);

                doc.setFont('helvetica', 'bold');
                doc.setTextColor(80, 80, 80);
                doc.text('IBAN:', margin + 3, currentY);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0, 0, 0);

                const availableWidth = columnWidth - labelWidth - 5;
                const ibanText = this.fitTextToWidth(doc, formattedIBAN, availableWidth, 9);
                doc.text(ibanText, margin + labelWidth, currentY);
            }

            if (bankData.bic) {
                const rightColumnX = margin + columnWidth;

                doc.setFont('helvetica', 'bold');
                doc.setTextColor(80, 80, 80);
                doc.text('BIC:', rightColumnX, currentY);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0, 0, 0);
                doc.text(bankData.bic, rightColumnX + (labelWidth * 0.7), currentY);
            }

            currentY += rowHeight + 1;
        }

        if (ueberweisungsbetrag > 0 || verwendungszweck) {
            if (ueberweisungsbetrag > 0) {
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(80, 80, 80);
                doc.text('Betrag:', margin + 3, currentY);

                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0, 0, 0);

                const betragLabelWidth = doc.getTextWidth('Betrag:') + 5;
                doc.text(formattedBetrag, margin + betragLabelWidth + 13, currentY);
            }

            if (verwendungszweck) {
                const rightColumnX = margin + columnWidth;

                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(80, 80, 80);
                doc.text('Zweck:', rightColumnX, currentY);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0, 0, 0);

                const zweckLabelWidth = doc.getTextWidth('Zweck:') + 2;
                const availableZweckWidth = columnWidth - zweckLabelWidth - 5;
                const zweckText = this.fitTextToWidth(doc, verwendungszweck, availableZweckWidth, 9);
                doc.text(zweckText, rightColumnX + zweckLabelWidth + 8, currentY);
            }

            currentY += rowHeight + 1;
        }

        return currentY + 2;
    }

    // *** NEU: Speichert PDF-Bankdaten für E-Mail-Verwendung ***
    saveDataForEmail(tenantId, data) {
        try {
            const key = `pdf_bank_data_${tenantId}`;
            const dataWithTimestamp = {
                ...data,
                timestamp: Date.now()
            };
            sessionStorage.setItem(key, JSON.stringify(dataWithTimestamp));
            console.log(`💾 [EMAIL-DATA] Gespeichert für ${tenantId}:`, dataWithTimestamp);
        } catch (error) {
            console.error('Fehler beim Speichern der E-Mail-Daten:', error);
        }
    }

    // *** NEU: Lädt PDF-Bankdaten für E-Mail-Verwendung ***
    static loadDataForEmail(tenantId) {
        try {
            const key = `pdf_bank_data_${tenantId}`;
            const stored = sessionStorage.getItem(key);
            if (stored) {
                const data = JSON.parse(stored);
                const now = Date.now();
                const fiveMinutes = 5 * 60 * 1000;
                
                if (now - data.timestamp < fiveMinutes) {
                    console.log(`💾 [EMAIL-DATA] Geladen für ${tenantId}:`, data);
                    return data;
                } else {
                    sessionStorage.removeItem(key);
                    console.log(`💾 [EMAIL-DATA] Abgelaufen für ${tenantId}, entfernt`);
                }
            }
            return null;
        } catch (error) {
            console.error('Fehler beim Laden der E-Mail-Daten:', error);
            return null;
        }
    }

    getIndividualMahngebuehr(tenantId) {
        try {
            if (typeof mahnstufen !== 'undefined' && mahnstufen.getIndividualMahngebuehr) {
                const currentMahnstufe = mahnstufen.getMahnstufe(tenantId);
                return mahnstufen.getIndividualMahngebuehr(tenantId, currentMahnstufe);
            }
            return 0;
        } catch (error) {
            console.error('Fehler beim Abrufen der Mahngebühren für Bankdaten:', error);
            return 0;
        }
    }

    fitTextToWidth(doc, text, maxWidth, fontSize) {
        doc.setFontSize(fontSize);
        const textWidth = doc.getTextWidth(text);

        if (textWidth <= maxWidth) {
            return text;
        }

        let shortenedText = text;
        while (doc.getTextWidth(shortenedText + '...') > maxWidth && shortenedText.length > 0) {
            shortenedText = shortenedText.slice(0, -1);
        }

        return shortenedText + '...';
    }

    extractBankDataFromTenant(tenant) {
        console.log('Verfügbare Tenant-Felder:', Object.keys(tenant));
        return {
            kontoinhaber: tenant.ktoinh,
            bank: tenant.bank,
            iban: tenant.iban,
            bic: tenant.bic
        };
    }

    extractBankDataFromDOM(tenantId) {
        try {
            const tenantContainer = document.querySelector(`[data-tenant-id="${tenantId}"]`);
            if (!tenantContainer) return {};

            const masterDataTable = tenantContainer.querySelector('.master-data-table');
            if (!masterDataTable) return {};

            const bankData = {};
            const labels = ['Kontoinhaber:', 'Bank:', 'IBAN:', 'BIC:'];
            const fields = ['kontoinhaber', 'bank', 'iban', 'bic'];

            labels.forEach((labelText, index) => {
                const label = Array.from(masterDataTable.querySelectorAll('.master-data-label'))
                    .find(label => label.textContent.includes(labelText));

                if (label) {
                    const value = label.nextElementSibling;
                    if (value && value.textContent.trim() !== '-') {
                        bankData[fields[index]] = value.textContent.trim();
                    }
                }
            });

            if (!bankData.kontoinhaber) {
                bankData.kontoinhaber = 'Sauer Immobilien GmbH';
            }

            return bankData;

        } catch (error) {
            console.error('Fehler beim Extrahieren aus DOM:', error);
            return {};
        }
    }

    hasValidBankData(bankData) {
        return !!(bankData.iban || bankData.bic || bankData.bank);
    }

    getDefaultBankData() {
        return {
            kontoinhaber: 'Bank not found',
            bank: 'Bank not found',
            iban: 'Bank not found',
            bic: 'Bank not found'
        };
    }

    formatIBAN(iban) {
        if (!iban) return '';
        return iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
    }

    createVerwendungszweck(tenant) {
        try {
            const mieterID = tenant.id || 'Unbekannt';
            const verwendungszweck = `Ausgleich, ${mieterID}`;
            return verwendungszweck;
        } catch (error) {
            console.error('Fehler in createVerwendungszweck:', error);
            return `Forderungsausgleich, ${tenant.id || 'Mieter'}`;
        }
    }

    addDefaultBankDetails(doc, tenant, margin, yPosition, pageWidth) {
        try {
            const defaultData = this.getDefaultBankData();

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text('FallbackUnsere Bankverbindung:', margin, yPosition);

            return this.renderBankDataTable(doc, defaultData, tenant, margin, yPosition + 2, pageWidth);

        } catch (error) {
            console.error('Fehler in addDefaultBankDetails:', error);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text('FallbackBankverbindung: DE89 3705 0299 0000 0000 00', margin, yPosition);
            return yPosition + 15;
        }
    }

    setCurrentTenant(tenant) {
        this.currentTenant = tenant;
    }
}

window.PDFBankverbindungModule = PDFBankverbindungModule;