class PDFBetreffModule {
    constructor(pdfGenerator) {
        this.pdf = pdfGenerator;
    }

    addMahnSubject(doc, tenant, mahnstufe, margin, yPosition) {
        try {
            const mahnstufeConfig = PDFUtils.getMahnstufeConfig(mahnstufe);

            // *** NEU: Speichere Mahnstufen-Daten für E-Mail-Verwendung ***
            this.saveMahnstufenDataForEmail(tenant.id, mahnstufe, mahnstufeConfig);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);

            const ersteBetreffszeile = this.createObjektBetreff(tenant);
            doc.text(ersteBetreffszeile, margin, yPosition);
            yPosition += 4;

            const zweiteBetreffszeile = this.createMahnBetreff(mahnstufeConfig);
            doc.text(zweiteBetreffszeile, margin, yPosition);
            yPosition += 10;

            return yPosition;

        } catch (error) {
            console.error('Fehler in addMahnSubject:', error);
            return this.addFallbackSubject(doc, tenant, margin, yPosition);
        }
    }

    // *** NEU: Speichert Mahnstufen-Daten für E-Mail-Verwendung ***
    saveMahnstufenDataForEmail(tenantId, mahnstufe, mahnstufeConfig) {
        try {
            const key = `pdf_mahnstufe_data_${tenantId}`;
            const dataWithTimestamp = {
                mahnstufe: mahnstufe,
                mahnstufeName: mahnstufeConfig.name,
                mahnstufenShortName: mahnstufeConfig.shortName,
                mahnstufenConfig: mahnstufeConfig,
                timestamp: Date.now()
            };
            sessionStorage.setItem(key, JSON.stringify(dataWithTimestamp));
            console.log(`📋 [MAHNSTUFE-DATA] Gespeichert für ${tenantId}:`, dataWithTimestamp);
        } catch (error) {
            console.error('Fehler beim Speichern der Mahnstufen-Daten:', error);
        }
    }

    // *** NEU: Lädt Mahnstufen-Daten für E-Mail-Verwendung ***
    static loadMahnstufenDataForEmail(tenantId) {
        try {
            const key = `pdf_mahnstufe_data_${tenantId}`;
            const stored = sessionStorage.getItem(key);
            if (stored) {
                const data = JSON.parse(stored);
                const now = Date.now();
                const fiveMinutes = 5 * 60 * 1000;
                
                if (now - data.timestamp < fiveMinutes) {
                    console.log(`📋 [MAHNSTUFE-DATA] Geladen für ${tenantId}:`, data);
                    return data;
                } else {
                    sessionStorage.removeItem(key);
                    console.log(`📋 [MAHNSTUFE-DATA] Abgelaufen für ${tenantId}, entfernt`);
                }
            }
            return null;
        } catch (error) {
            console.error('Fehler beim Laden der Mahnstufen-Daten:', error);
            return null;
        }
    }

    createObjektBetreff(tenant) {
        try {
            const objektName = PDFUtils.sanitizeText(
                tenant.street || tenant.objekt || 'Objekt unbekannt'
            );
            const tenantId = PDFUtils.sanitizeText(tenant.id || 'ID unbekannt');

            return `Objekt: ${objektName}, ${tenantId}`;

        } catch (error) {
            console.error('Fehler in createObjektBetreff:', error);
            return `Objekt: ${tenant.street || 'Unbekannt'}, ${tenant.id || 'ID'}`;
        }
    }

    createMahnBetreff(mahnstufeConfig) {
        try {
            const mahnstufeName = PDFUtils.sanitizeText(
                mahnstufeConfig.name || 'Zahlungserinnerung'
            );

            return `${mahnstufeName}`;

        } catch (error) {
            console.error('Fehler in createMahnBetreff:', error);
            return 'Zahlungserinnerung';
        }
    }

    addFallbackSubject(doc, tenant, margin, yPosition) {
        try {
            // *** NEU: Auch bei Fallback speichern ***
            const fallbackConfig = { name: 'Zahlungserinnerung', shortName: 'ZE' };
            this.saveMahnstufenDataForEmail(tenant.id, 'E', fallbackConfig);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);

            doc.text(`Objekt: ${tenant.street || 'Unbekannt'}, ${tenant.id || 'ID'}`, margin, yPosition);
            doc.text('Zahlungserinnerung', margin, yPosition + 4);

            return yPosition + 10;

        } catch (fallbackError) {
            console.error('Fallback in addMahnSubject fehlgeschlagen:', fallbackError);
            return yPosition + 10;
        }
    }

    createExtendedSubject(tenant, mahnstufe) {
        try {
            const mahnstufeConfig = PDFUtils.getMahnstufeConfig(mahnstufe);
            const objektName = tenant.street || tenant.objekt || 'Objekt unbekannt';
            const portfolioInfo = tenant.portfolio ? ` (Portfolio: ${tenant.portfolio})` : '';

            return {
                objektBetreff: `Objekt: ${objektName}, ${tenant.id}`,
                mahnBetreff: `${mahnstufeConfig.name}${portfolioInfo}`,
                fullSubject: `${mahnstufeConfig.name} - ${objektName}${portfolioInfo}`
            };

        } catch (error) {
            console.error('Fehler in createExtendedSubject:', error);
            return {
                objektBetreff: `Objekt: ${tenant.street || 'Unbekannt'}, ${tenant.id}`,
                mahnBetreff: 'Zahlungserinnerung',
                fullSubject: 'Zahlungserinnerung'
            };
        }
    }

    createEmailSubject(tenant, mahnstufe) {
        try {
            const mahnstufeConfig = PDFUtils.getMahnstufeConfig(mahnstufe);
            const objektName = tenant.street || tenant.objekt || 'Objekt';
            const portfolioInfo = tenant.portfolio ? ` [${tenant.portfolio}]` : '';

            return `${mahnstufeConfig.name} - ${objektName} - ${tenant.id}${portfolioInfo}`;

        } catch (error) {
            console.error('Fehler in createEmailSubject:', error);
            return `Zahlungserinnerung - ${tenant.street || 'Objekt'} - ${tenant.id}`;
        }
    }

    createFileNameSubject(tenant, mahnstufe) {
        try {
            const mahnstufeConfig = PDFUtils.getMahnstufeConfig(mahnstufe);
            const objektName = PDFUtils.createSafeFileName(tenant.street || tenant.objekt || 'Objekt');
            const tenantName = PDFUtils.createSafeFileName(tenant.name || tenant.name1 || 'Mieter');
            const tenantId = PDFUtils.createSafeFileName(tenant.id || 'ID');
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

            return `${mahnstufeConfig.shortName}_${objektName}_${tenantName}_${tenantId}_${dateStr}`;

        } catch (error) {
            console.error('Fehler in createFileNameSubject:', error);
            return `ZE_${tenant.id || 'Mieter'}_${new Date().toISOString().slice(0, 10)}`;
        }
    }

    validateSubjectData(tenant, mahnstufe) {
        const issues = [];

        if (!tenant.id) {
            issues.push('Mieter-ID fehlt');
        }

        if (!tenant.street && !tenant.objekt) {
            issues.push('Objekt-Bezeichnung fehlt');
        }

        if (!mahnstufe || mahnstufe < 1 || mahnstufe > 3) {
            issues.push('Ungültige Mahnstufe');
        }

        if (issues.length > 0) {
            console.warn('Betreff-Validierung:', issues.join(', '));
        }

        return issues;
    }
}

window.PDFBetreffModule = PDFBetreffModule;