class PDFAnredeTextModule {
    constructor(pdfGenerator) {
        this.pdf = pdfGenerator;
    }



    async addAnredeUndEinleitung(doc, tenant, mahnstufe, margin, pageWidth, yPosition) {
        try {
            const mahntext = this.generateMahntextForPDF(tenant, mahnstufe);
            const maxWidth = pageWidth - 2 * margin;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);

            yPosition = PDFUtils.addTextBlock(doc, mahntext.anrede, margin, yPosition, maxWidth);
            yPosition += 2;

            yPosition = PDFUtils.addTextBlock(doc, mahntext.einleitung, margin, yPosition, maxWidth);
            yPosition += 1;

            return yPosition;

        } catch (error) {
            console.error('Fehler in addAnredeUndEinleitung:', error);
            return yPosition + 2;
        }
    }


   async addTextNachTabelle(doc, tenant, mahnstufe, margin, pageWidth, yPosition) {
    try {
        const mahntext = this.generateMahntextForPDF(tenant, mahnstufe);
        const maxWidth = pageWidth - 2 * margin;

        yPosition += 4;

        console.log('Verarbeite Text nach Tabelle für:', tenant.id);
        console.log('Verfügbare Texte:', Object.keys(mahntext));

        doc.setFont('helvetica', 'normal');
        yPosition = PDFUtils.addTextBlock(doc, mahntext.zahlungsfrist, margin, yPosition, maxWidth);
        yPosition += 4;
        console.log('Zahlungsfrist hinzugefügt, Y-Position:', yPosition);

        if (mahnstufe === 3 && mahntext.kuendigungstext) {
            console.log('Füge Kündigungstext hinzu');
            doc.setFont('helvetica', 'bold'); 
            yPosition = PDFUtils.addTextBlock(doc, mahntext.kuendigungstext, margin, yPosition, maxWidth);
            yPosition += 4;
            doc.setFont('helvetica', 'normal'); 
        }

        if (mahntext.haupttext && mahntext.haupttext.trim()) {
            console.log('Füge Haupttext hinzu:', mahntext.haupttext);
            doc.setFont('helvetica', 'normal');
            yPosition = PDFUtils.addTextBlock(doc, mahntext.haupttext, margin, yPosition, maxWidth);
            yPosition += 6;
            console.log('Haupttext hinzugefügt, neue Y-Position:', yPosition);
        } else {
            console.log('Kein Haupttext verfügbar oder leer');
        }

        return yPosition;

    } catch (error) {
        console.error('Fehler in addTextNachTabelle:', error);
        return yPosition + 15;
    }
}
    async addSchlusstext(doc, tenant, mahnstufe, margin, pageWidth, yPosition) {
        try {
            const userData = PDFUtils.getUserData();

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text('Mit freundlichen Grüßen', margin, yPosition);
            yPosition += 6;

            doc.setFont('helvetica', 'normal');
            doc.text('Sauer Immobilien GmbH', margin, yPosition);
            yPosition += 12;

            if (userData.name) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.text(userData.name, margin, yPosition);
                yPosition += 5;
            }

            return yPosition + 5;

        } catch (error) {
            console.error('Fehler in addSchlusstext:', error);
            return yPosition + 15;
        }
    }

 generateMahntextForPDF(tenant, mahnstufe) {
    try {
        console.log(`=== PDF-TEXT-GENERIERUNG START ===`);
        console.log(`Tenant: ${tenant.id}, Mahnstufe: ${mahnstufe}`);

        const texts = window.textManager ? 
            window.textManager.getTextForMahnstufe(mahnstufe, tenant.id) : 
            this.getFallbackTexts(mahnstufe);

        console.log('Geladene Texte:', texts);
        console.log('Haupttext roh:', texts.haupttext);

        const totalDifference = this.pdf.tenantManager.calculateTenantTotal(tenant);
        const schuldenBetrag = Math.abs(totalDifference);
        const mahngebuehr = window.currentPDFMahngebuehr || 0;
        const gesamtbetrag = window.currentPDFGesamtbetrag || (schuldenBetrag + mahngebuehr);

        let zahlungsfrist;
        try {
            zahlungsfrist = PDFUtils.calculatePaymentDeadline(PDFUtils.getMahnstufeConfig(mahnstufe).zahlungsfrist);
        } catch (error) {
            zahlungsfrist = this.calculatePaymentDeadlineLocal(14);
        }

        const anrede = this.getPersonalizedAnrede(tenant);

        const variables = {
            SCHULDEN_BETRAG: Utils.formatAmount(schuldenBetrag),
            GESAMT_BETRAG: Utils.formatAmount(gesamtbetrag),
            ZAHLUNGSFRIST: zahlungsfrist,
            MIETER_NAME: tenant.name || tenant.name1 || 'Mieter'
        };

        console.log('Variablen für Ersetzung:', variables);

        const result = {
            anrede: anrede
        };

        ['einleitung', 'zahlungsfrist', 'haupttext', 'kuendigungstext'].forEach(key => {
            if (texts[key]) {
                result[key] = this.replaceVariables(texts[key], variables);
                console.log(`${key} - Original:`, texts[key]);
                console.log(`${key} - Verarbeitet:`, result[key]);
            } else {
                console.log(`${key} - Nicht verfügbar`);
            }
        });

        console.log('Finales Result für PDF:', result);
        console.log('=== PDF-TEXT-GENERIERUNG ENDE ===');
        return result;

    } catch (error) {
        console.error('Fehler bei PDF-Textgenerierung:', error);
        return this.getEmergencyFallbackText();
    }
}

    getFallbackTexts(mahnstufe) {
        const fallbackTexts = {
            1: {
                einleitung: 'bei der regelmäßigen Überprüfung Ihres Mietkontos mussten wir bedauerlicherweise einen Zahlungsrückstand in Höhe von {SCHULDEN_BETRAG} feststellen. Sicherlich ist es Ihrer Aufmerksamkeit entgangen, dass die nachfolgend genannten Beträge bereits zur Zahlung fällig geworden sind.',
                zahlungsfrist: 'Wir bitten Sie, den offenen Betrag von {SCHULDEN_BETRAG} bis zum {ZAHLUNGSFRIST} auf untenstehendes Konto zu überweisen.',
                haupttext: 'Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.'
            },
            2: {
                einleitung: 'trotz unserer Zahlungserinnerung ist die Zahlung folgender Beträge noch nicht bei uns eingegangen:',
                zahlungsfrist: 'Wir fordern Sie auf, den Gesamtbetrag von {GESAMT_BETRAG} bis zum {ZAHLUNGSFRIST} zu begleichen.',
                haupttext: 'Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.'
            },
            3: {
                einleitung: 'trotz mehrfacher Aufforderung ist die Zahlung folgender Beträge noch immer nicht erfolgt:',
                zahlungsfrist: 'Zahlen Sie den Gesamtbetrag von {GESAMT_BETRAG} bis spätestens {ZAHLUNGSFRIST}.',
                kuendigungstext: 'Vorsorglich machen wir Sie darauf aufmerksam, dass wir gemäß § 543 Abs. 2 Satz 3 BGB zur Kündigung des mit Ihnen bestehenden Mietverhältnisses berechtigt sind, wenn Sie für einen Zeitraum, der sich über mehr als zwei Fälligkeitsterminen erstreckt, mit der Entrichtung der Miete oder eines nicht unerheblichen Teiles der Miete im Verzug befinden. Sollten Sie den ausstehenden Gesamtbetrag nicht innerhalb der o. g. Frist ausgleichen, werden wir von unserem Recht der fristlosen Kündigung Gebrauch machen.',
                haupttext: 'Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.'
            }
        };
        return fallbackTexts[mahnstufe] || fallbackTexts[1];
    }


    replaceVariables(text, variables) {
        let result = text;
        Object.keys(variables).forEach(key => {
            const placeholder = `{${key}}`;
            result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), variables[key]);
        });
        return result;
    }

    calculatePaymentDeadlineLocal(tage) {
        try {
            const today = new Date();
            const zahlungsziel = new Date(today.getTime() + (tage * 24 * 60 * 60 * 1000));
            const options = {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            };
            return zahlungsziel.toLocaleDateString('de-DE', options);
        } catch (error) {
            console.error('Lokale Zahlungsziel-Berechnung fehlgeschlagen:', error);
            const days = tage || 14;
            const date = new Date();
            date.setDate(date.getDate() + days);
            return date.toLocaleDateString('de-DE');
        }
    }

    getPersonalizedAnrede(tenant) {
        try {
            if (tenant.anrede1 && tenant.anrede2) {
                return `${PDFUtils.sanitizeText(tenant.anrede1)},\n${PDFUtils.sanitizeText(tenant.anrede2)},`;
            } else if (tenant.anrede1) {
                return `${PDFUtils.sanitizeText(tenant.anrede1)},`;
            } else if (tenant.anrede2) {
                return `${PDFUtils.sanitizeText(tenant.anrede2)},`;
            }

            if (tenant.name1 && tenant.name2) {
                return `Sehr geehrte Damen und Herren,\nsehr geehrte/r ${PDFUtils.sanitizeText(tenant.name1)} und ${PDFUtils.sanitizeText(tenant.name2)},`;
            } else if (tenant.name1) {
                return `Sehr geehrte Damen und Herren,\nsehr geehrte/r ${PDFUtils.sanitizeText(tenant.name1)},`;
            } else if (tenant.name) {
                return `Sehr geehrte Damen und Herren,\nsehr geehrte/r ${PDFUtils.sanitizeText(tenant.name)},`;
            }

            return 'Sehr geehrte Damen und Herren,';

        } catch (error) {
            console.warn('Fehler bei Anrede-Generierung:', error);
            return 'Sehr geehrte Damen und Herren,';
        }
    }

    getEmergencyFallbackText() {
        return {
            anrede: 'FallbackSehr geehrte Damen und Herren,',
            einleitung: 'FallbackWir teilen Ihnen mit, dass folgende Beträge noch ausstehen:',
            haupttext: 'FallbackBitte begleichen Sie die ausstehenden Beträge zeitnah.',
            zahlungsfrist: 'FallbackWir bitten um zeitnahe Zahlung.',
            kuendigungstext: ''
        };
    }

    validateMahntextData(tenant, mahnstufe) {
        const issues = [];

        if (!tenant.name && !tenant.name1 && !tenant.anrede1) {
            issues.push('Keine Anrede-Daten verfügbar');
        }

        if (!mahnstufe || mahnstufe < 1 || mahnstufe > 3) {
            issues.push('Ungültige Mahnstufe für Text-Generierung');
        }

        if (issues.length > 0) {
            console.warn('Mahntext-Validierung:', issues.join(', '));
        }

        return issues;
    }
}

window.PDFAnredeTextModule = PDFAnredeTextModule;