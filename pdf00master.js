class PDFGenerator {
    constructor(tenantManager) {
        this.tenantManager = tenantManager;
        this.logoCache = new Map();
        this.initializeModules();
        this.footerConfig = this.initializeFooterConfig();
    }

    initializeFooterConfig() {
        const userData = PDFUtils.getUserData();
        return {
            lines: [
                `Sauer Immobilien GmbH | Königstraße 25-27 | 90402 Nürnberg`,
                'Tel +49 911 21491-0 | Fax +49 911 21491-99 | info@sauer-immobilien.de | www.sauer-immobilien.de',
                'GF: Claus Zechmeister, Manfred G. Launicke | Handelsregister: Registergericht Nürnberg | HR B: 18310'
            ],
            fontSize: 8,
            color: [120, 120, 120],
            lineSpacing: 1.5,
            bottomMargin: 10,
            logos: {
                ivd: {
                    url: 'https://upload.wikimedia.org/wikipedia/de/thumb/6/6c/Immobilienverband-IVD-Logo.svg/248px-Immobilienverband-IVD-Logo.svg.png?20101018185051',
                    maxWidth: 35, maxHeight: 12, leftMargin: 20, verticalOffset: -4
                },
                sauer: {
                    url: 'https://raw.githubusercontent.com/constructorable/Protokoll/refs/heads/main/Sauer-Siegel_85_small.jpg',
                    maxWidth: 40, maxHeight: 40, rightMargin: 0, verticalOffset: -8
                },
                main: {
                    url: 'https://raw.githubusercontent.com/constructorable/Protokoll/refs/heads/main/Logo.JPG',
                    maxWidth: 60, maxHeight: 20
                }
            }
        };
    }

    initializeModules() {
        this.modules = {};
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.loadModules());
        } else {
            this.loadModules();
        }
    }

    loadModules() {
        try {
            const requiredModules = [
                'PDFAnschriftModule', 'PDFBetreffModule', 'PDFAnredeTextModule',
                'PDFTabelleModule', 'PDFBankverbindungModule', 'PDFSchlussModule', 'PDFFooterModule'
            ];

            const missingModules = requiredModules.filter(moduleName => !window[moduleName]);
            if (missingModules.length > 0) {
                console.error('Fehlende PDF-Module:', missingModules);
                throw new Error(`PDF-Module nicht verfügbar: ${missingModules.join(', ')}`);
            }

            this.modules = {
                anschrift: new window.PDFAnschriftModule(this),
                betreff: new window.PDFBetreffModule(this),
                anredeText: new window.PDFAnredeTextModule(this),
                tabelle: new window.PDFTabelleModule(this),
                bankverbindung: new window.PDFBankverbindungModule(this),
                schluss: new window.PDFSchlussModule(this),
                footer: new window.PDFFooterModule(this)
            };

           

        } catch (error) {
            console.error('Fehler beim Laden der PDF-Module:', error);
            this.useLegacyMode = true;
        }
    }

async buildPDFContent(doc, tenant, mahnstufe) {
    const { width: pageWidth, height: pageHeight } = doc.internal.pageSize;
    const margin = 20;
    let yPosition = margin + 20;

    try {
        console.log('📄 Beginne PDF-Inhalt für:', tenant.name, '(', tenant.id, ')');

        if (!tenant || !tenant.id) {
            throw new Error('Ungültiges Tenant-Objekt');
        }

        if (!tenant.records || tenant.records.length === 0) {
            throw new Error('Keine Rechnungsdaten verfügbar');
        }

        try {
            yPosition = await this.addMainLogo(doc, pageWidth);
            yPosition += 3;
            console.log('  Logo hinzugefügt, Y-Position:', yPosition);
        } catch (error) {
            console.warn('⚠️ Logo-Fehler:', error.message);
            yPosition = 25; 
        }

        try {
            yPosition = this.modules?.anschrift?.addCompanyHeader(doc, margin, yPosition) ||
                       this.fallbackCompanyHeader(doc, margin, yPosition);
            console.log('  Firmenanschrift hinzugefügt, Y-Position:', yPosition);
        } catch (error) {
            console.warn('⚠️ Firmenanschrift-Fehler:', error.message);
            yPosition = this.fallbackCompanyHeader(doc, margin, yPosition);
        }

        try {
            yPosition = this.modules?.anschrift?.addTenantAddress(doc, tenant, margin, pageWidth, yPosition) ||
                       this.fallbackTenantAddress(doc, tenant, margin, pageWidth, yPosition);
            yPosition += 14;
            console.log('  Mieteranschrift hinzugefügt, Y-Position:', yPosition);
        } catch (error) {
            console.warn('⚠️ Mieteranschrift-Fehler:', error.message);
            yPosition = this.fallbackTenantAddress(doc, tenant, margin, pageWidth, yPosition) + 14;
        }

        try {
            yPosition = this.modules?.betreff?.addMahnSubject(doc, tenant, mahnstufe, margin, yPosition) ||
                       this.fallbackBetreff(doc, tenant, mahnstufe, margin, yPosition);
            yPosition += 2;
            console.log('  Betreff hinzugefügt, Y-Position:', yPosition);
        } catch (error) {
            console.warn('⚠️ Betreff-Fehler:', error.message);
            yPosition = this.fallbackBetreff(doc, tenant, mahnstufe, margin, yPosition) + 2;
        }

        try {
            yPosition = await (this.modules?.anredeText?.addAnredeUndEinleitung(doc, tenant, mahnstufe, margin, pageWidth, yPosition)) ||
                       this.fallbackAnredeText(doc, tenant, margin, pageWidth, yPosition);
            console.log('  Anrede hinzugefügt, Y-Position:', yPosition);
        } catch (error) {
            console.warn('⚠️ Anrede-Fehler:', error.message);
            yPosition = this.fallbackAnredeText(doc, tenant, margin, pageWidth, yPosition);
        }

        try {
            const tableResult = await (this.modules?.tabelle?.createOptimizedInvoiceTable(doc, tenant, yPosition, margin, pageWidth, pageHeight)) ||
                               this.fallbackTable(doc, tenant, yPosition, margin, pageWidth, pageHeight);

            if (!tableResult || typeof tableResult.finalY === 'undefined') {
                throw new Error('Tabellen-Modul gab ungültiges Ergebnis zurück');
            }

            yPosition = tableResult.finalY + 1;
            console.log('  Tabelle hinzugefügt, Y-Position:', yPosition);
        } catch (error) {
            console.error('❌ Tabellen-Fehler:', error.message);
            yPosition = this.fallbackTable(doc, tenant, yPosition, margin, pageWidth, pageHeight).finalY + 1;
        }

        try {
            if (this.modules?.anredeText?.addTextNachTabelle) {
                yPosition = await this.modules.anredeText.addTextNachTabelle(doc, tenant, mahnstufe, margin, pageWidth, yPosition);
                console.log('  Text nach Tabelle hinzugefügt, Y-Position:', yPosition);
            }
        } catch (error) {
            console.warn('⚠️ Text-nach-Tabelle-Fehler:', error.message);
        }

        try {
            const bankSpaceNeeded = 40;
            if ((pageHeight - yPosition - 20) >= bankSpaceNeeded) {
                yPosition = await this.addBankDetails(doc, tenant, margin, yPosition, pageWidth);
            } else {
                doc.addPage();
                yPosition = margin + 20;
                yPosition = await this.addBankDetails(doc, tenant, margin, yPosition, pageWidth);
            }
            console.log('  Bankverbindung hinzugefügt, Y-Position:', yPosition);
        } catch (error) {
            console.warn('⚠️ Bankverbindung-Fehler:', error.message);
            yPosition = this.fallbackBankDetails(doc, tenant, margin, yPosition, pageWidth);
        }

        try {
            if (this.modules?.schluss) {
                yPosition = await this.modules.schluss.addSchlussUndFooter(doc, tenant, mahnstufe, margin, pageWidth, yPosition);
            } else {
                yPosition = this.fallbackSchlusstext(doc, tenant, mahnstufe, margin, pageWidth, yPosition);
            }
            console.log('  Schlusstext hinzugefügt, Y-Position:', yPosition);
        } catch (error) {
            console.warn('⚠️ Schlusstext-Fehler:', error.message);
            yPosition = this.fallbackSchlusstext(doc, tenant, mahnstufe, margin, pageWidth, yPosition);
        }

        console.log('🎉 PDF-Inhalt erfolgreich erstellt, finale Y-Position:', yPosition);
        return yPosition;

    } catch (error) {
        console.error('❌ Kritischer Fehler in buildPDFContent:', error);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('FEHLER BEI PDF-GENERIERUNG', margin, yPosition);
        yPosition += 10;
        doc.setFontSize(10);
        doc.text(`Mieter: ${tenant.name || 'Unbekannt'} (${tenant.id || 'Unbekannt'})`, margin, yPosition);
        yPosition += 5;
        doc.text(`Fehler: ${error.message}`, margin, yPosition);
        yPosition += 5;
        doc.text('Bitte wenden Sie sich an den Support.', margin, yPosition);

        return yPosition + 20;
    }
}

async addBankDetails(doc, tenant, margin, yPosition, pageWidth) {
    try {
        if (this.modules?.bankverbindung) {
            return await this.modules.bankverbindung.addBankingDetails(doc, tenant, margin, yPosition, pageWidth);
        } else {
            return this.fallbackBankDetails(doc, tenant, margin, yPosition, pageWidth);
        }
    } catch (error) {
        console.warn('Bankverbindung-Fallback verwendet:', error.message);
        return this.fallbackBankDetails(doc, tenant, margin, yPosition, pageWidth);
    }
}

async generatePDFForTenant(tenant) {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) throw new Error('jsPDF ist nicht verfügbar');

    const startTime = performance.now();
    const doc = new jsPDF({ compress: true, precision: 2, userUnit: 1.0 });
    const originalWindowOpen = window.open;
    window.open = () => null;

    try {
        const mahnstufe = mahnstufen?.getMahnstufe?.(tenant.id) || 1;
        const mahnstufeConfig = mahnstufen?.getMahnstufeConfig?.(mahnstufe);

        const mahngebuehr = mahnstufen?.getIndividualMahngebuehr?.(tenant.id, mahnstufe) || 0;
        console.log(`📄 PDF-Generierung für: ${tenant.name} (${tenant.id})`);
        console.log(`📋 Mahnstufe: ${mahnstufe} (${mahnstufeConfig?.name || 'Unbekannt'})`);
        console.log(`💰 Mahngebühren: ${Utils.formatAmount(mahngebuehr)}`);

        await this.buildPDFContent(doc, tenant, mahnstufe);

        if (this.modules?.footer) {
            await this.modules.footer.addFooterToAllPages(doc);
        } else {
            await this.addFooterToAllPages(doc);
        }

        const fileName = this.createExtendedFileName(tenant, mahnstufe);
        this.forceDirectDownload(doc, fileName);

        const duration = (performance.now() - startTime).toFixed(2);
        const pdfSize = doc.output('arraybuffer').byteLength;
        const pageCount = doc.internal.getNumberOfPages();

        console.log(`  PDF erfolgreich erstellt: ${fileName}`);
        console.log(`📊 Details: ${pageCount} Seiten, ${(pdfSize / 1024 / 1024).toFixed(2)} MB, ${duration} ms`);

        return {
            success: true,
            fileName,
            pageCount,
            fileSize: pdfSize,
            duration: parseFloat(duration),
            mahnstufe,
            mahngebuehr, 
            tenant: { id: tenant.id, name: tenant.name }
        };

    } catch (error) {
        console.error('Fehler bei PDF-Generierung:', error);
        throw error;
    } finally {
        setTimeout(() => { window.open = originalWindowOpen; }, 1000);
    }
}

    async generateBulkInvoices(tenants, progressCallback) {
        const results = { successful: 0, failed: 0, errors: [] };

        console.log(`📦 Bulk-PDF-Generierung gestartet für ${tenants.length} Mieter`);
        Utils.showNotification(`${tenants.length} PDFs werden in den Download-Ordner gespeichert`, 'info');

        for (let i = 0; i < tenants.length; i++) {
            const tenant = tenants[i];
            try {
                if (progressCallback) {
                    const mahnstufe = mahnstufen?.getMahnstufe(tenant.id) || 1;
                    const mahnTyp = mahnstufen?.getMahnstufeConfig(mahnstufe)?.name || 'Zahlungserinnerung';
                    progressCallback(i + 1, tenants.length, `${mahnTyp} für ${tenant.name} wird erstellt...`);
                }

                await this.generatePDFForTenant(tenant);
                results.successful++;
                await Utils.delay(50);

            } catch (error) {
                console.error(`❌ Fehler bei PDF für ${tenant.name}:`, error);
                results.failed++;
                results.errors.push({ tenant: tenant.name, error: error.message });
            }
        }

        console.log('📊 Bulk-PDF-Generierung abgeschlossen:', results);
        return results;
    }

    forceDirectDownload(doc, fileName) {
        try {
            const blob = new Blob([doc.output('arraybuffer', { compress: true })], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const element = document.createElement('a');

            Object.assign(element, {
                href: url,
                download: fileName,
                style: { display: 'none' }
            });

            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
            setTimeout(() => URL.revokeObjectURL(url), 100);

        } catch (error) {
            console.error('Force download failed:', error);
            throw error;
        }
    }

createExtendedFileName(tenant, mahnstufe = 1) {
    try {
        // GEÄNDERT: Straße mit Punkt und Leerzeichen
        const objekt = PDFUtils.createSafeFileName(tenant.street || 'Unbekannt')
            .replace(/_/g, '. '); // Unterstriche zu Punkt + Leerzeichen
        
        // Name mit Leerzeichen statt Unterstrich  
        const cleanName = PDFUtils.createSafeFileName(tenant.name || tenant.name1 || 'Mieter')
            .replace(/_/g, ' '); // Unterstriche zu Leerzeichen
            
        const cleanId = PDFUtils.createSafeFileName(tenant.id || 'ID');
        
        const today = new Date();
        const dateStr = today.toLocaleDateString('de-DE');
        
        const mahnstufenNames = {
            1: 'Zahlungserinnerung',
            2: '1. Mahnung',
            3: '2. Mahnung',
            4: '3. Mahnung'
        };
        const mahnstufeName = mahnstufenNames[mahnstufe] || 'Zahlungserinnerung';
        
        let gebuehrSuffix = '';
        if (mahnstufe >= 2 && mahnstufen?.hasIndividualMahngebuehr?.(tenant.id)) {
            const mahngebuehr = mahnstufen.getIndividualMahngebuehr(tenant.id, mahnstufe);
            if (mahngebuehr !== mahnstufen.getMahnstufeConfig(mahnstufe).gebuhren) {
                gebuehrSuffix = `_${mahngebuehr.toFixed(0)}EUR`;
            }
        }
        
        return `${objekt}_${cleanName}_${mahnstufeName} vom ${dateStr}_${cleanId}${gebuehrSuffix}.pdf`;
        
    } catch (error) {
        console.error('Fehler in createExtendedFileName:', error);
        return `Mahnung_${tenant.id || 'Mieter'}_${new Date().toLocaleDateString('de-DE')}.pdf`;
    }
}

    async addMainLogo(doc, pageWidth) {
        try {
            const logoData = await this.getLogoWithDimensions('main');
            if (!logoData) return 20;

            const config = this.footerConfig.logos.main;
            const { width, height } = this.calculateLogoSize(logoData.originalWidth, logoData.originalHeight, config.maxWidth, config.maxHeight);

            const x = (pageWidth - width) / 2;
            const y = 10;

            doc.addImage(logoData.dataURL, 'JPEG', x, y, width, height);
            return y + height + 4;

        } catch (error) {
            console.warn('Haupt-Logo konnte nicht hinzugefügt werden:', error);
            return 20;
        }
    }

    async getLogoWithDimensions(type) {
        if (this.logoCache.has(type)) return this.logoCache.get(type);

        try {
            const config = this.footerConfig.logos[type];
            if (!config) return null;

            const logoData = await this.loadImageWithDimensions(config.url);
            this.logoCache.set(type, logoData);
            return logoData;

        } catch (error) {
            console.warn(`${type} Logo konnte nicht geladen werden:`, error);
            return null;
        }
    }

    async loadImageWithDimensions(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const { width, height } = this.calculateCanvasSize(img.width, img.height);

                canvas.width = width;
                canvas.height = height;
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'medium';
                ctx.drawImage(img, 0, 0, width, height);

                resolve({
                    dataURL: canvas.toDataURL('image/jpeg', 0.3),
                    originalWidth: width,
                    originalHeight: height
                });
            };

            img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
            img.src = url;
        });
    }

    calculateCanvasSize(width, height, maxWidth = 300, maxHeight = 200) {
        const aspectRatio = width / height;
        let canvasWidth = width;
        let canvasHeight = height;

        if (canvasWidth > maxWidth) {
            canvasWidth = maxWidth;
            canvasHeight = canvasWidth / aspectRatio;
        }
        if (canvasHeight > maxHeight) {
            canvasHeight = maxHeight;
            canvasWidth = canvasHeight * aspectRatio;
        }

        return { width: canvasWidth, height: canvasHeight };
    }

    calculateLogoSize(originalWidth, originalHeight, maxWidth, maxHeight) {
        const aspectRatio = originalWidth / originalHeight;
        let width = maxWidth;
        let height = width / aspectRatio;

        if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
        }

        return { width, height };
    }

    async addFooterToAllPages(doc) {
        try {
            const pageCount = doc.internal.getNumberOfPages();
            const { width: pageWidth, height: pageHeight } = doc.internal.pageSize;
            const logos = await this.loadFooterLogos();

            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                await this.addFooterToCurrentPage(doc, pageWidth, pageHeight, logos);
            }

        } catch (error) {
            console.error('Fehler beim Hinzufügen der Footer:', error);
        }
    }

    async loadFooterLogos() {
        try {
            const [ivdLogo, sauerLogo] = await Promise.all([
                this.getLogoWithDimensions('ivd'),
                this.getLogoWithDimensions('sauer')
            ]);
            return { ivd: ivdLogo, sauer: sauerLogo };

        } catch (error) {
            console.warn('Footer-Logos konnten nicht geladen werden:', error);
            return { ivd: null, sauer: null };
        }
    }

    async addFooterToCurrentPage(doc, pageWidth, pageHeight, logos) {
        try {
            const { fontSize, lines, lineSpacing, bottomMargin, color } = this.footerConfig;
            doc.setFontSize(fontSize);
            doc.setFont('helvetica', 'normal');

            const lineHeight = fontSize * 0.353;
            const totalFooterHeight = (lines.length * lineHeight) + ((lines.length - 1) * lineSpacing);
            const firstLineY = pageHeight - bottomMargin - totalFooterHeight + lineHeight;

            this.addFooterLogos(doc, logos, pageWidth, firstLineY, totalFooterHeight);
            this.addFooterText(doc, lines, pageWidth, firstLineY, lineHeight, lineSpacing, color);

        } catch (error) {
            console.error('Fehler beim Hinzufügen des Footer zur aktuellen Seite:', error);
        }
    }

    addFooterLogos(doc, logos, pageWidth, firstLineY, totalFooterHeight) {
        try {
            if (logos.ivd) {
                const config = this.footerConfig.logos.ivd;
                const { width, height } = this.calculateLogoSize(logos.ivd.originalWidth, logos.ivd.originalHeight, config.maxWidth, config.maxHeight);
                const x = config.leftMargin;
                const y = firstLineY - (height / 2) + (totalFooterHeight / 2) + config.verticalOffset;
                doc.addImage(logos.ivd.dataURL, 'PNG', x, y, width, height);
            }

            if (logos.sauer) {
                const config = this.footerConfig.logos.sauer;
                const { width, height } = this.calculateLogoSize(logos.sauer.originalWidth, logos.sauer.originalHeight, config.maxWidth, config.maxHeight);
                const x = pageWidth - config.rightMargin - width;
                const y = firstLineY - (height / 2) + (totalFooterHeight / 2) + config.verticalOffset;
                doc.addImage(logos.sauer.dataURL, 'JPEG', x, y, width, height);
            }

        } catch (error) {
            console.error('Fehler beim Hinzufügen der Footer-Logos:', error);
        }
    }

    addFooterText(doc, lines, pageWidth, firstLineY, lineHeight, lineSpacing, color) {
        try {
            doc.setTextColor(...color);
            lines.forEach((line, index) => {
                const y = firstLineY + (index * (lineHeight + lineSpacing));
                const x = (pageWidth - doc.getTextWidth(line)) / 2;
                doc.text(line, x, y);
            });

        } catch (error) {
            console.error('Fehler beim Hinzufügen des Footer-Texts:', error);
        }
    }

    fallbackCompanyHeader(doc, margin, yPosition) {
        doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(100, 100, 100);
        doc.text('Sauer Immobilien GmbH | Königstr. 25 - 27 | 90402 Nürnberg', margin, yPosition);
        return yPosition + 4;
    }

    fallbackTenantAddress(doc, tenant, margin, pageWidth, yPosition) {
        doc.setFontSize(10).setFont('helvetica', 'normal').setTextColor(40, 44, 52);

        const name = tenant.name || tenant.name1 || 'Unbekannter Mieter';
        const street = tenant.street || 'Unbekannte Straße';
        const plzOrt = `${tenant.plz || ''} ${tenant.city || ''}`.trim() || 'Unbekannter Ort';

        doc.text(name, margin, yPosition);
        doc.text(street, margin, yPosition + 3);
        doc.text(plzOrt, margin, yPosition + 6);

        const datumText = `Datum: ${new Date().toLocaleDateString('de-DE')}`;
        const datumWidth = doc.getTextWidth(datumText);
        doc.setFontSize(8);
        doc.text(datumText, pageWidth - margin - datumWidth, yPosition);

        return yPosition + 12;
    }

    fallbackBetreff(doc, tenant, mahnstufe, margin, yPosition) {
        doc.setFontSize(10).setFont('helvetica', 'normal').setTextColor(0, 0, 0);
        doc.text(`Objekt: ${tenant.street || 'Unbekannt'}, ${tenant.id || 'ID'}`, margin, yPosition);
        doc.text('Zahlungserinnerung', margin, yPosition + 4);
        return yPosition + 8;
    }

    fallbackAnredeText(doc, tenant, margin, pageWidth, yPosition) {
        doc.setFontSize(10).setFont('helvetica', 'normal').setTextColor(0, 0, 0);
        doc.text('Sehr geehrte Damen und Herren,', margin, yPosition);
        return yPosition + 6;
    }

fallbackTable(doc, tenant, yPosition, margin, pageWidth, pageHeight) {
    try {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Aufstellung der offenen Beträge:', margin, yPosition);
        yPosition += 8;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);

        const totalDifference = this.tenantManager?.calculateTenantTotal(tenant) || 0;
        const schuldenBetrag = Math.abs(totalDifference);
        const mahnstufe = mahnstufen?.getMahnstufe(tenant.id) || 1;
        const mahngebuehr = mahnstufen?.getIndividualMahngebuehr(tenant.id, mahnstufe) || 0;
        const gesamtbetrag = schuldenBetrag + mahngebuehr;

        doc.text('Rückstand:', margin, yPosition);
        doc.text(Utils.formatAmount(schuldenBetrag), pageWidth - margin - 50, yPosition);
        yPosition += 5;

        if (mahngebuehr > 0) {
            doc.text('Mahngebühren:', margin, yPosition);
            doc.text(Utils.formatAmount(mahngebuehr), pageWidth - margin - 50, yPosition);
            yPosition += 5;
        }

        doc.setFont('helvetica', 'bold');
        doc.text('Zu zahlen:', margin, yPosition);
        doc.text(Utils.formatAmount(gesamtbetrag), pageWidth - margin - 50, yPosition);
        yPosition += 10;

        return {
            totalPages: 1,
            totalPositions: tenant.records?.length || 0,
            finalY: yPosition,
            isOnFirstPage: true,
            hasSpaceForBankDetails: true
        };
    } catch (error) {
        console.error('Fallback-Tabelle-Fehler:', error);
        return {
            totalPages: 1,
            totalPositions: 0,
            finalY: yPosition + 20,
            isOnFirstPage: true,
            hasSpaceForBankDetails: true
        };
    }
}

fallbackBankDetails(doc, tenant, margin, yPosition, pageWidth) {
    try {

        const totalDifference = this.tenantManager?.calculateTenantTotal(tenant) || 0;
        const schuldenBetrag = Math.abs(totalDifference);
        const mahnstufe = mahnstufen?.getMahnstufe(tenant.id) || 1;
        const mahngebuehr = mahnstufen?.getIndividualMahngebuehr(tenant.id, mahnstufe) || 0;
        const gesamtbetrag = schuldenBetrag + mahngebuehr;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Bankverbindung:', margin, yPosition);
        yPosition += 5;

        doc.text('FallbackIBAN: IBAN not found', margin, yPosition);
        yPosition += 4;

        doc.text('FallbackBIC: BIC not found', margin, yPosition);
        yPosition += 4;

        doc.text('FallbackBank: Bank not found', margin, yPosition);
        yPosition += 4;

        doc.text(`FallbackVerwendungszweck: Miete ${tenant.id} - ${Utils.formatAmount(gesamtbetrag)}`, margin, yPosition);
        yPosition += 6;

        return yPosition;
    } catch (error) {
        console.error('Fallback-Bankdaten-Fehler:', error);
        return yPosition + 20;
    }
}

    fallbackSchlusstext(doc, tenant, mahnstufe, margin, pageWidth, yPosition) {
        const userData = PDFUtils.getUserData();

        doc.setFontSize(10).setFont('helvetica', 'normal').setTextColor(0, 0, 0);
        doc.text('Mit freundlichen Grüßen', margin, yPosition);
        doc.text('Sauer Immobilien GmbH', margin, yPosition + 6);

        if (userData.name) {
            doc.setFontSize(9);
            doc.text(userData.name, margin, yPosition + 12);
        }

        return yPosition + 18;
    }

    clearCache() {
        this.logoCache.clear();
    }

    getCacheSize() {
        return this.logoCache.size;
    }
}

window.addEventListener('beforeunload', () => {
    if (window.app?.pdfGenerator) {
        window.app.pdfGenerator.clearCache();
    }
});

window.PDFGenerator = PDFGenerator;
/* console.log('Optimierte PDF Generator Master-Klasse v3.0 - Seitenumbruch-Probleme behoben!'); */