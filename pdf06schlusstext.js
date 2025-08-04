class PDFSchlussModule {
    constructor(pdfGenerator) {
        this.pdf = pdfGenerator;
    }

    async addSchlussUndFooter(doc, tenant, mahnstufe, margin, pageWidth, yPosition) {
        try {
            yPosition = await this.addSchlusstext(doc, tenant, mahnstufe, margin, pageWidth, yPosition);
            yPosition = this.addSignatureArea(doc, margin, pageWidth, yPosition);
            return yPosition;
        } catch (error) {
            console.error('Fehler in addSchlussUndFooter:', error);
            return yPosition + 15;
        }
    }

    async addSchlusstext(doc, tenant, mahnstufe, margin, pageWidth, yPosition) {
        try {
            const schlusstext = this.generateSchlusstext(mahnstufe, tenant);
            const maxWidth = pageWidth - 2 * margin;
            const requiredSpace = this.calculateRequiredSpace(doc, schlusstext, maxWidth);
            const { height: pageHeight } = doc.internal.pageSize;

            if (PDFUtils.needsNewPage(yPosition, requiredSpace + 20, pageHeight, 15)) {
                if (this.pdf.modules?.footer) {
                    yPosition = await this.pdf.modules.footer.addPageWithFooter(doc);
                } else {
                    doc.addPage();
                    yPosition = margin + 20;
                }
            }

            if (schlusstext && schlusstext.trim()) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0, 0, 0);
                yPosition = PDFUtils.addTextBlock(doc, schlusstext, margin, yPosition, maxWidth);
                yPosition += 6;
            }

            const userData = PDFUtils.getUserData();

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text('Mit freundlichen Grüßen', margin, yPosition);
            yPosition += 6;

            doc.setFont('helvetica', 'normal');
            doc.text('Sauer Immobilien GmbH', margin, yPosition);
            yPosition += 6;

            if (userData.name) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.text(userData.name, margin, yPosition);
                yPosition += 5;
            }

            yPosition += 0;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100, 100, 100);
            doc.text('Dieses Schreiben wurde maschinell erstellt und trägt daher keine Unterschrift.', margin, yPosition);
            yPosition += 6;

            return yPosition;

        } catch (error) {
            console.error('Fehler in addSchlusstext:', error);
            return yPosition + 15;
        }
    }

    generateSchlusstext(mahnstufe, tenant) {
        try {
            let mahntext = null;
            try {
                if (mahnstufen?.generateMahntext) {
                    const totalDifference = this.pdf.tenantManager.calculateTenantTotal(tenant);
                    mahntext = mahnstufen.generateMahntext(mahnstufe, tenant, totalDifference);
                }
            } catch (error) {
                console.warn('Fehler beim Generieren des Mahntexts von mahnstufen:', error);
            }

            if (!mahntext || !mahntext.schluss) {
                mahntext = this.generateFallbackSchlusstext(mahnstufe, tenant);
            }

            return PDFUtils.sanitizeText(mahntext.schluss || '');

        } catch (error) {
            console.error('Fehler in generateSchlusstext:', error);
            return '';
        }
    }

    generateFallbackSchlusstext(mahnstufe, tenant) {
        try {
            const fallbackTexts = {
                1: {
                    schluss: 'Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.'
                },
                2: {
                    schluss: 'Wir erwarten Ihre umgehende Zahlung und bitten Sie, weitere Mahnkosten zu vermeiden.'
                },
                3: {
                    schluss: 'Bei weiterer Zahlungsverweigerung sehen wir uns gezwungen, rechtliche Schritte einzuleiten.'
                }
            };

            return fallbackTexts[mahnstufe] || fallbackTexts[1];

        } catch (error) {
            console.error('Fehler in generateFallbackSchlusstext:', error);
            return { schluss: 'Wir bitten um umgehende Begleichung der ausstehenden Beträge.' };
        }
    }

    calculateRequiredSpace(doc, text, maxWidth) {
        try {
            return PDFUtils.calculateTextHeight(doc, text, maxWidth, 10) + 15;
        } catch (error) {
            return 25;
        }
    }

    addSignatureArea(doc, margin, pageWidth, yPosition) {
        try {
            return yPosition + 8;
        } catch (error) {
            console.error('Fehler in addSignatureArea:', error);
            return yPosition + 15;
        }
    }
}

window.PDFSchlussModule = PDFSchlussModule;