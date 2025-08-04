class PDFUtils {

    static sanitizeText(text) {
        if (text === null || text === undefined) return '';
        if (typeof text !== 'string') {
            try {
                text = String(text);
            } catch (error) {
                return '';
            }
        }
        return text
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') 
            .replace(/\r\n/g, '\n') 
            .replace(/\r/g, '\n') 
            .trim();
    }

    static addTextBlock(doc, text, x, startY, maxWidth, lineSpacing = 4) {
        if (!text || typeof text !== 'string') {
            /* console.warn('Ungültiger Text für addTextBlock:', text); */
            return startY;
        }

        let yPosition = startY;

        try {
            const lines = text.split('\n');

            lines.forEach((line, lineIndex) => {
                if (line.trim()) {
                    const wrappedLines = doc.splitTextToSize(line, maxWidth);

                    if (Array.isArray(wrappedLines)) {
                        wrappedLines.forEach(wrappedLine => {
                            if (typeof wrappedLine === 'string' && wrappedLine.trim()) {
                                doc.text(wrappedLine, x, yPosition);
                                yPosition += lineSpacing;
                            }
                        });
                    } else if (typeof wrappedLines === 'string') {
                        doc.text(wrappedLines, x, yPosition);
                        yPosition += lineSpacing;
                    }
                } else {

                    yPosition += lineSpacing * 0.5;
                }
            });

            return yPosition;

        } catch (error) {
            /* console.error('Fehler in addTextBlock:', error); */
            try {
                doc.text(String(text).substring(0, 100), x, yPosition);
                return yPosition + lineSpacing;
            } catch (fallbackError) {
                /* console.error('Fallback in addTextBlock fehlgeschlagen:', fallbackError); */
                return yPosition;
            }
        }
    }

    static formatDate(date) {
        try {
            if (!(date instanceof Date)) date = new Date(date);
            return date.toLocaleDateString('de-DE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            return new Date().toLocaleDateString('de-DE');
        }
    }

    static formatIBAN(iban) {
        if (!iban) return '';
        return iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
    }

  static formatZeitraum(zeitraum) {
    if (!zeitraum) return '';
    
    // Neues Format: YYYYMM -> YYYY-MM
    if (zeitraum.match(/^\d{6}$/)) {
        const jahr = zeitraum.substring(0, 4);
        const monat = zeitraum.substring(4, 6);
        return `${jahr}-${monat}`;
    }
    
    // Altes Format mit Punkten beibehalten (falls noch verwendet)
    if (zeitraum.includes('.')) {
        const parts = zeitraum.split('.');
        if (parts.length >= 2) {
            const monat = parts[1].padStart(2, '0');
            const jahr = parts[2] ? parts[2].slice(-2) : parts[0].slice(-2);
            return `${monat}/${jahr}`;
        }
    }
    
    return zeitraum;
}

    static createSafeFileName(text) {
        return text
            .replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '')
            .replace(/\s+/g, '_')
            .trim();
    }

    static drawRightAlignedText(doc, text, x, y) {
        if (!text) return;
        const textStr = text.toString();
        const textWidth = doc.getTextWidth(textStr);
        const finalX = x - textWidth;
        if (finalX >= 0) {
            doc.text(textStr, finalX, y);
        }
    }

    static calculateTextHeight(doc, text, maxWidth, fontSize = 11) {
        if (!text) return 0;
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, maxWidth);
        return lines.length * fontSize * 0.353 * 1.2;
    }

    static intelligentTruncateText(text, maxWidth, doc) {
        if (!text) return '';

        const fontSize = doc.getFontSize();
        const charWidthEstimate = fontSize * 0.6;
        const maxChars = Math.floor((maxWidth - 4) / charWidthEstimate);

        if (text.length <= maxChars) return text;

        const truncated = text.substring(0, maxChars - 3);
        const lastSpace = truncated.lastIndexOf(' ');

        if (lastSpace > maxChars * 0.7) {
            return truncated.substring(0, lastSpace) + '...';
        }
        return truncated + '...';
    }

    static validateTenantData(tenant) {
        const errors = [];

        if (!tenant.name && !tenant.name1) {
            errors.push('Kein Name vorhanden');
        }

        if (!tenant.street) {
            errors.push('Keine Straße vorhanden');
        }

        if (!tenant.id) {
            errors.push('Keine Mieter-ID vorhanden');
        }

        if (errors.length > 0) {
            throw new Error(`Ungültige Mieterdaten: ${errors.join(', ')}`);
        }

        return true;
    }

    static needsNewPage(currentY, requiredSpace, pageHeight, footerMargin = 15) {

        const availableSpace = pageHeight - currentY - footerMargin;
        const needsBreak = availableSpace < requiredSpace;

        if (needsBreak) {
            /* console.log(`📄 Seitenumbruch: Y=${currentY.toFixed(1)}, Benötigt=${requiredSpace}, Verfügbar=${availableSpace.toFixed(1)}`); */
        }

        return needsBreak;
    }

    static logLayoutInfo(methodName, yPosition, pageHeight, margin = 15) {
        const remainingSpace = pageHeight - yPosition - margin;
       /*  console.log(`[${methodName}] Y: ${yPosition.toFixed(1)}, Verbleibend: ${remainingSpace.toFixed(1)}px`); */
    }

    static getUserData() {
        try {
            return (
                window.getCurrentUser?.() ||
                window.currentUserData ||
                window.userManager?.getUserData?.() ||
                JSON.parse(localStorage.getItem('mahnmanager_userdata') || '{}') ||
                { name: '', email: '', phone: '' }
            );
        } catch (error) {
           /*  console.error('Fehler beim Abrufen der Benutzerdaten:', error); */
            return { name: '', email: '', phone: '' };
        }
    }

    static getMahnstufeConfig(stufe) {
        try {
            if (typeof mahnstufen !== 'undefined' && mahnstufen.getMahnstufeConfig) {
                return mahnstufen.getMahnstufeConfig(stufe);
            }

            const fallbackConfigs = {
                1: { name: 'Zahlungserinnerung', shortName: 'Zahlungserinnerung', zahlungsfrist: 14, gebuhren: 0.00 },
                2: { name: '1. Mahnung', shortName: '1. Mahnung', zahlungsfrist: 10, gebuhren: 5.00 },
                3: { name: '2. Mahnung', shortName: '2. Mahnung', zahlungsfrist: 7, gebuhren: 10.00 }
            };

            return fallbackConfigs[stufe] || fallbackConfigs[1];

        } catch (error) {
           /*  console.error('Fehler beim Abrufen der Mahnstufen-Config:', error); */
            return { name: 'Zahlungserinnerung', shortName: 'Zahlungserinnerung', zahlungsfrist: 14, gebuhren: 0.00 };
        }
    }

    static calculatePaymentDeadline(tage) {
        try {
            if (typeof mahnstufen !== 'undefined' && mahnstufen.calculatePaymentDeadline) {
                return mahnstufen.calculatePaymentDeadline(tage);
            }

            const zahlungsziel = new Date(Date.now() + (tage * 24 * 60 * 60 * 1000));
            return zahlungsziel.toLocaleDateString('de-DE', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });

        } catch (error) {
            /* console.error('Fehler bei Zahlungsfrist-Berechnung:', error); */
            return new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)).toLocaleDateString('de-DE');
        }
    }
}

window.PDFUtils = PDFUtils;

/* console.log('PDFUtils v3.0 - Seitenumbruch-Problem behoben!'); */