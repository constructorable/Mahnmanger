class PDFAnschriftModule {
    constructor(pdfGenerator) {
        this.pdf = pdfGenerator;
        this.config = {
            anschriftOffset: 20, // mm nach unten
            zeilenAbstand: 4,    // Abstand zwischen Zeilen
            fontSize: 10         // Schriftgröße
        };
    }

    async addMieteranschrift(doc, tenant, margin, pageWidth, yPosition) {
        try {
            const postAddress = window.app?.tenantManager?.getPostAddress?.(tenant.id);
            const anschrift = this.buildMieteranschrift(tenant, postAddress);
            const maxWidth = 80;

            // KONFIGURIERBARE ANSCHRIFT-POSITION:
            const adjustedYPosition = yPosition + this.config.anschriftOffset;

            doc.setFontSize(this.config.fontSize);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);

            const lines = doc.splitTextToSize(anschrift, maxWidth);

            lines.forEach((line, index) => {
                doc.text(line, margin, adjustedYPosition + (index * this.config.zeilenAbstand));
            });

            const finalY = adjustedYPosition + (lines.length * this.config.zeilenAbstand) + 4;
            console.log(`Mieteranschrift (Postadresse) hinzugefügt, Y-Position: ${finalY}`);

            return finalY;

        } catch (error) {
            console.error('Fehler in addMieteranschrift:', error);
            return yPosition + 25;
        }
    }

    buildMieteranschrift(tenant, postAddress) {
        let anschrift = '';

        if (tenant.name1) {
            anschrift += tenant.name1;
        }

        if (tenant.name2) {
            anschrift += '\n' + tenant.name2;
        }

        // Verwende Postadresse
        if (postAddress) {
            anschrift += '\n' + postAddress.street;
            anschrift += '\n' + postAddress.plz + ' ' + postAddress.city;
        } else {
            // Fallback auf Stammimmobilie
            anschrift += '\n' + (tenant.street || '');
            anschrift += '\n' + (tenant.plz || '') + ' ' + (tenant.city || '');
        }

        return anschrift;
    }

    addCompanyHeader(doc, margin, yPosition) {
        try {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text('Sauer Immobilien GmbH | Königstr. 25-27 | 90402 Nürnberg', margin, yPosition);
            return yPosition + 8;
        } catch (error) {
            console.error('Fehler in addCompanyHeader:', error);
            return yPosition + 8;
        }
    }

    addTenantAddress(doc, tenant, margin, pageWidth, yPosition) {
        try {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(40, 44, 52);

            const addressLines = this.buildAddressLines(tenant);
            const startY = yPosition;

            addressLines.forEach((line, index) => {
                doc.text(String(line), margin, yPosition + (index * 4));
            });

            this.addContactInfo(doc, pageWidth, margin, startY);
            return yPosition + (addressLines.length * 4) + 12;

        } catch (error) {
            console.error('Fehler in addTenantAddress:', error);
            return yPosition + 30;
        }
    }

    buildAddressLines(tenant) {
        try {
            const lines = [];

            if (tenant.name1 && tenant.name2) {
                lines.push(PDFUtils.sanitizeText(tenant.name1));
                lines.push(PDFUtils.sanitizeText(tenant.name2));
            } else if (tenant.name) {
                lines.push(PDFUtils.sanitizeText(tenant.name));
            } else if (tenant.name1) {
                lines.push(PDFUtils.sanitizeText(tenant.name1));
            } else {
                lines.push('Unbekannter Mieter');
            }

            // NEU: Verwende Postadresse für PDF
            const postAddress = window.app?.tenantManager?.getPostAddress?.(tenant.id);

            if (postAddress) {
                lines.push(PDFUtils.sanitizeText(postAddress.street || 'Unbekannte Straße'));
                const plzOrt = `${postAddress.plz || ''} ${postAddress.city || ''}`.trim();
                lines.push(plzOrt || 'Unbekannter Ort');
            } else {
                // Fallback auf Stammimmobilie
                lines.push(PDFUtils.sanitizeText(tenant.street || 'Unbekannte Straße'));
                const plzOrt = `${tenant.plz || ''} ${tenant.city || ''}`.trim();
                lines.push(plzOrt || 'Unbekannter Ort');
            }

            return lines;

        } catch (error) {
            console.error('Fehler in buildAddressLines:', error);
            return ['Unbekannter Mieter', 'Unbekannte Adresse'];
        }
    }

addContactInfo(doc, pageWidth, margin, startY) {
    try {
        const userData = PDFUtils.getUserData();

        // KORRIGIERTES DATUM mit führenden Nullen:
        const today = new Date();
        const day = today.getDate().toString().padStart(2, '0');
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const year = today.getFullYear();
        const formattedDate = `${day}.${month}.${year}`;

        const contactInfo = [
            `Datum: ${formattedDate}`, // GEÄNDERT: formatiertes Datum verwenden
            userData.name ? `Bearbeiter: ${userData.name}` : 'Bearbeiter: Sauer Immobilien GmbH',
            userData.phone ? `Telefon: ${userData.phone}` : 'Telefon: +49 911 2149-10',
            userData.email ? `E-Mail: ${userData.email}` : 'E-Mail: hausverwaltung@sauer-immobilien.de'
        ];

        doc.setFontSize(8);
        doc.setTextColor(11, 11, 11);

        contactInfo.forEach((info, index) => {
            const textWidth = doc.getTextWidth(String(info));
            const xPosition = pageWidth - margin - textWidth;
            doc.text(String(info), xPosition, startY + (index * 3.3));
        });

    } catch (error) {
        console.error('Fehler in addContactInfo:', error);
    }
}

    addRecipientAddress(doc, tenant, margin, yPosition) {
        try {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);

            const senderLine = 'Sauer Immobilien GmbH, Königstr. 25 - 27, 90402 Nürnberg';
            doc.text(senderLine, margin, yPosition);

            doc.setDrawColor(100, 100, 100);
            doc.setLineWidth(0.3);
            doc.line(margin, yPosition + 3, margin + 120, yPosition + 3);

            yPosition += 10;

            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);

            const addressLines = this.buildAddressLines(tenant);
            addressLines.forEach((line, index) => {
                doc.text(String(line), margin, yPosition + (index * 4));
            });

            return yPosition + (addressLines.length * 4) + 10;

        } catch (error) {
            console.error('Fehler in addRecipientAddress:', error);
            return yPosition + 30;
        }
    }

    validateAddressData(tenant) {
        const warnings = [];
        const postAddress = window.app?.tenantManager?.getPostAddress?.(tenant.id);

        if (!tenant.name && !tenant.name1) {
            warnings.push('Kein Mieter-Name vorhanden');
        }

        // Prüfe Postadresse
        if (postAddress) {
            if (!postAddress.street) {
                warnings.push('Keine Poststraße vorhanden');
            }
            if (!postAddress.plz) {
                warnings.push('Keine Post-PLZ vorhanden');
            }
            if (!postAddress.city) {
                warnings.push('Keine Post-Stadt vorhanden');
            }
        } else {
            // Fallback-Prüfung
            if (!tenant.street) {
                warnings.push('Keine Straßenangabe vorhanden');
            }
            if (!tenant.plz) {
                warnings.push('Keine PLZ vorhanden');
            }
            if (!tenant.city) {
                warnings.push('Keine Stadt vorhanden');
            }
        }

        if (warnings.length > 0) {
            console.warn('Adress-Validierung:', warnings.join(', '));
        }

        return warnings;
    }

    formatAddressForDisplay(tenant, format = 'full') {
        try {
            const postAddress = window.app?.tenantManager?.getPostAddress?.(tenant.id);

            const name = tenant.name || tenant.name1 || 'Unbekannter Mieter';

            let street, plzOrt;
            if (postAddress) {
                street = postAddress.street || 'Unbekannte Straße';
                plzOrt = `${postAddress.plz || ''} ${postAddress.city || ''}`.trim() || 'Unbekannter Ort';
            } else {
                street = tenant.street || 'Unbekannte Straße';
                plzOrt = `${tenant.plz || ''} ${tenant.city || ''}`.trim() || 'Unbekannter Ort';
            }

            switch (format) {
                case 'compact':
                    return `${name}, ${street}, ${plzOrt}`;
                case 'multiline':
                    return [name, street, plzOrt].join('\n');
                case 'full':
                default:
                    const lines = this.buildAddressLines(tenant);
                    return lines.join('\n');
            }

        } catch (error) {
            console.error('Fehler in formatAddressForDisplay:', error);
            return 'Adresse nicht verfügbar';
        }
    }

    isAddressComplete(tenant) {
        const postAddress = window.app?.tenantManager?.getPostAddress?.(tenant.id);
        let available = 0;
        let total = 4; // name, street, plz, city
        const missingFields = [];

        // Name prüfen
        if (tenant.name || tenant.name1) {
            available++;
        } else {
            missingFields.push('name');
        }

        // Adresse prüfen (Postadresse oder Fallback)
        if (postAddress) {
            if (postAddress.street && postAddress.street.trim()) {
                available++;
            } else {
                missingFields.push('post_street');
            }

            if (postAddress.plz && postAddress.plz.trim()) {
                available++;
            } else {
                missingFields.push('post_plz');
            }

            if (postAddress.city && postAddress.city.trim()) {
                available++;
            } else {
                missingFields.push('post_city');
            }
        } else {
            // Fallback auf Stammimmobilie
            if (tenant.street && tenant.street.trim()) {
                available++;
            } else {
                missingFields.push('street');
            }

            if (tenant.plz && tenant.plz.trim()) {
                available++;
            } else {
                missingFields.push('plz');
            }

            if (tenant.city && tenant.city.trim()) {
                available++;
            } else {
                missingFields.push('city');
            }
        }

        return {
            isComplete: available >= 3,
            missingFields: missingFields,
            completeness: Math.round((available / total) * 100)
        };
    }
}

window.PDFAnschriftModule = PDFAnschriftModule;
