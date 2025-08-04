class PDFFooterModule {
    constructor(pdfGenerator) {
        this.pdf = pdfGenerator;
        this.logoCache = new Map();
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
            lineSpacing: 1.2,
            bottomMargin: 10,
            logos: {
                ivd: {
                    url: 'https://upload.wikimedia.org/wikipedia/de/thumb/6/6c/Immobilienverband-IVD-Logo.svg/248px-Immobilienverband-IVD-Logo.svg.png?20101018185051',
                    maxWidth: 30, 
                    maxHeight: 10, 
                    leftMargin: 15, 
                    verticalOffset: -3
                },
                sauer: {
                    url: 'https://raw.githubusercontent.com/constructorable/Protokoll/refs/heads/main/Sauer-Siegel_85_small.jpg',
                    maxWidth: 35, 
                    maxHeight: 35, 
                    rightMargin: 0, 
                    verticalOffset: -6
                }
            }
        };
    }

    async addFooterToAllPages(doc) {
        try {
            const pageCount = doc.internal.getNumberOfPages();
            const { width: pageWidth, height: pageHeight } = doc.internal.pageSize;
            const logos = await this.loadFooterLogos();

            console.log(`Footer wird zu ${pageCount} Seite(n) hinzugefügt`);

            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                await this.addFooterToCurrentPage(doc, pageWidth, pageHeight, logos);
            }

            console.log('Footer erfolgreich zu allen Seiten hinzugefügt');

        } catch (error) {
            console.error('Fehler beim Hinzufügen der Footer:', error);
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

    async addPageWithFooter(doc) {
        try {
            doc.addPage();
            const { width: pageWidth, height: pageHeight } = doc.internal.pageSize;

            if (this.pdf?.addMainLogo) {
                await this.pdf.addMainLogo(doc, pageWidth);
            }

            const logos = await this.loadFooterLogos();
            await this.addFooterToCurrentPage(doc, pageWidth, pageHeight, logos);

            return pageHeight - 50;

        } catch (error) {
            console.error('Fehler beim Hinzufügen einer neuen Seite mit Footer:', error);
            return 50;
        }
    }

    async loadFooterLogos() {
        try {
            const [ivdLogo, sauerLogo] = await Promise.all([
                this.getLogoWithDimensions('ivd'),
                this.getLogoWithDimensions('sauer')
            ]);

            return { 
                ivd: ivdLogo, 
                sauer: sauerLogo 
            };

        } catch (error) {
            console.warn('Footer-Logos konnten nicht geladen werden:', error);
            return { ivd: null, sauer: null };
        }
    }

    async getLogoWithDimensions(type) {
        if (this.logoCache.has(type)) {
            return this.logoCache.get(type);
        }

        try {
            const config = this.footerConfig.logos[type];
            if (!config) {
                console.warn(`Logo-Konfiguration für "${type}" nicht gefunden`);
                return null;
            }

            const logoData = await this.loadImageWithDimensions(config.url);
            this.logoCache.set(type, logoData);
            console.log(`Logo "${type}" erfolgreich geladen und gecacht`);
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
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const { width, height } = this.calculateCanvasSize(img.width, img.height);

                    canvas.width = width;
                    canvas.height = height;
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'medium';
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve({
                        dataURL: canvas.toDataURL('image/jpeg', 0.8),
                        originalWidth: width,
                        originalHeight: height
                    });

                } catch (error) {
                    reject(new Error('Fehler beim Verarbeiten des Bildes: ' + error.message));
                }
            };

            img.onerror = () => reject(new Error('Bild konnte nicht geladen werden: ' + url));
            img.src = url;
        });
    }

    calculateCanvasSize(width, height, maxWidth = 250, maxHeight = 150) {
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

    addFooterLogos(doc, logos, pageWidth, firstLineY, totalFooterHeight) {
        try {
            if (logos.ivd) {
                const config = this.footerConfig.logos.ivd;
                const { width, height } = this.calculateLogoSize(
                    logos.ivd.originalWidth, 
                    logos.ivd.originalHeight, 
                    config.maxWidth, 
                    config.maxHeight
                );
                const x = config.leftMargin;
                const y = firstLineY - (height / 2) + (totalFooterHeight / 2) + config.verticalOffset;
                doc.addImage(logos.ivd.dataURL, 'PNG', x, y, width, height);
            }

            if (logos.sauer) {
                const config = this.footerConfig.logos.sauer;
                const { width, height } = this.calculateLogoSize(
                    logos.sauer.originalWidth, 
                    logos.sauer.originalHeight, 
                    config.maxWidth, 
                    config.maxHeight
                );
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
                const textWidth = doc.getTextWidth(String(line));
                const x = (pageWidth - textWidth) / 2;
                doc.text(String(line), x, y);
            });

        } catch (error) {
            console.error('Fehler beim Hinzufügen des Footer-Texts:', error);
        }
    }

    refreshFooterData() {
        this.footerConfig = this.initializeFooterConfig();
        console.log('Footer-Daten zur Laufzeit aktualisiert');
    }

    setFooterConfig(config) {
        this.footerConfig = { ...this.footerConfig, ...config };
        console.log('Footer-Konfiguration aktualisiert');
    }

    setFooterLine(index, line) {
        if (index >= 0 && index < this.footerConfig.lines.length) {
            this.footerConfig.lines[index] = line;
            console.log(`Footer-Zeile ${index} aktualisiert:`, line);
        }
    }

    clearCache() {
        this.logoCache.clear();
        console.log('Footer-Logo-Cache geleert');
    }

    getCacheSize() {
        return this.logoCache.size;
    }

    calculateAvailableFooterSpace(doc, pageHeight) {
        const { lines, lineSpacing, bottomMargin, fontSize } = this.footerConfig;
        const lineHeight = fontSize * 0.353;
        const totalFooterHeight = (lines.length * lineHeight) + ((lines.length - 1) * lineSpacing);

        return {
            footerHeight: totalFooterHeight + bottomMargin,
            availableContentHeight: pageHeight - totalFooterHeight - bottomMargin - 20,
            footerStartY: pageHeight - bottomMargin - totalFooterHeight
        };
    }
}

window.PDFFooterModule = PDFFooterModule;