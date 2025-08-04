class PDFTabelleModule {
    constructor(pdfGenerator) {
        this.pdf = pdfGenerator;
    }

needsNewPage(yPosition, rowHeight, pageHeight, footerSpace, currentRows = 0, maxRows = 29) {
    try {

        if (currentRows >= maxRows) {
            return true;
        }

        const summaryHeight = 15; 
        const neededSpace = rowHeight + summaryHeight;
        const availableSpace = pageHeight - yPosition - footerSpace;
        return availableSpace < neededSpace;
    } catch (error) {
        console.error('Fehler in needsNewPage:', error);
        return false;
    }
}

getDebtPositions(tenant) {
    try {
        if (!tenant.records || tenant.records.length === 0) return [];

        const enabledRecords = tenant.records.filter(record => record.enabled);

        const allRecords = enabledRecords.filter(record => {
            const { difference } = this.calculateRecordAmounts(record);
            return difference !== 0; 
        });

        return allRecords.sort((a, b) => a['inter'].localeCompare(b['inter']));

    } catch (error) {
        console.error('Fehler in getDebtPositions:', error);
        return [];
    }
}

    calculateTableColumns(margin, pageWidth) {
        try {
            if (!margin || !pageWidth || pageWidth <= margin * 2) return null;

            const availableWidth = pageWidth - 2 * margin;
            const columns = {
                zeitraum: { width: Math.floor(availableWidth * 0.12) },
                kostenart: { width: Math.floor(availableWidth * 0.50) },
                soll: { width: Math.floor(availableWidth * 0.12) },
                ist: { width: Math.floor(availableWidth * 0.12) },
                differenz: { width: Math.floor(availableWidth * 0.14) }
            };

            let currentX = margin;
            const columnGap = 2;

            Object.keys(columns).forEach(key => {
                columns[key].x = currentX;
                currentX += columns[key].width + columnGap;
            });

            return columns;

        } catch (error) {
            console.error('Fehler in calculateTableColumns:', error);
            return null;
        }
    }

    drawTableHeader(doc, yPosition, margin, pageWidth, columns) {
        try {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);

            const headerHeight = 8;
            const textY = yPosition + 5;

            const tableStartX = margin;
            const tableEndX = columns.differenz.x + columns.differenz.width;

            doc.setDrawColor(120, 120, 120);
            doc.setLineWidth(0.5);
            doc.line(tableStartX, yPosition + headerHeight - 1, tableEndX, yPosition + headerHeight - 1);

            const headers = [
                { text: 'Zeitraum', x: columns.zeitraum.x, align: 'left' },
                { text: 'Kostenart', x: columns.kostenart.x, align: 'left' },
                { text: 'Soll €', x: columns.soll.x + columns.soll.width - 2, align: 'right' },
                { text: 'Ist €', x: columns.ist.x + columns.ist.width - 2, align: 'right' },
                { text: 'Differenz €', x: columns.differenz.x + columns.differenz.width - 2, align: 'right' }
            ];

            headers.forEach(header => {
                if (header.align === 'right') {
                    PDFUtils.drawRightAlignedText(doc, header.text, header.x, textY);
                } else {
                    doc.text(header.text, header.x, textY);
                }
            });

            return yPosition + headerHeight + 2;

        } catch (error) {
            console.error('Fehler in drawTableHeader:', error);
            return yPosition + 10;
        }
    }

drawTableRow(doc, record, yPosition, rowHeight, columns, difference) {
    try {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);

        const { sollAmount, habenAmount } = this.calculateRecordAmounts(record);
        const textY = yPosition + 3;

        const zeitraum = PDFUtils.formatZeitraum(record['inter']);

        const kostenartText = record['kostenart'] || '';
        const availableWidth = columns.kostenart.width - 4;

        const kostenartLines = doc.splitTextToSize(kostenartText, availableWidth);

        doc.text(zeitraum, columns.zeitraum.x, textY);

        if (kostenartLines.length > 0) {
            doc.text(kostenartLines[0], columns.kostenart.x, textY);
        }

        PDFUtils.drawRightAlignedText(doc, Utils.formatAmount(sollAmount), 
            columns.soll.x + columns.soll.width - 2, textY);
        PDFUtils.drawRightAlignedText(doc, Utils.formatAmount(habenAmount), 
            columns.ist.x + columns.ist.width - 2, textY);

        if (difference < 0) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(200, 0, 0); 
        } else if (difference > 0) {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 150, 0); 
        }

        const displayAmount = Math.abs(difference);
        const prefix = difference > 0 ? '+' : '-';
        const formattedDifference = `${prefix}${Utils.formatAmount(displayAmount)}`;

        PDFUtils.drawRightAlignedText(doc, formattedDifference, 
            columns.differenz.x + columns.differenz.width - 2, textY);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        if (kostenartLines.length > 1) {
            const maxExtraLines = Math.min(kostenartLines.length - 1, 2); 
            for (let i = 1; i <= maxExtraLines; i++) {
                doc.setFontSize(8); 
                doc.text(kostenartLines[i], columns.kostenart.x + 2, textY + (i * 3));
            }
            doc.setFontSize(9); 
        }

    } catch (error) {
        console.error('Fehler in drawTableRow:', error);
    }
}

drawSummaryRow(doc, yPosition, margin, pageWidth, columns, netDifference) {
    try {
        yPosition += 2;

        const tableStartX = margin;
        const tableEndX = columns.differenz.x + columns.differenz.width;

        doc.setDrawColor(120, 120, 120);
        doc.setLineWidth(0.3);
        doc.line(tableStartX, yPosition, tableEndX, yPosition);

        yPosition += 5;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);

        const rückstandsBetrag = Math.abs(netDifference);
        const labelText = netDifference < 0 ? 'Gesamtrückstand:' : 'Guthaben:';

        console.log(`📊 [SUMMARY] Netto-Differenz: ${netDifference}, Betrag: ${rückstandsBetrag}, Label: ${labelText}`);

        doc.text(labelText, columns.zeitraum.x, yPosition);
        PDFUtils.drawRightAlignedText(doc, Utils.formatAmount(rückstandsBetrag), 
            columns.differenz.x + columns.differenz.width - 2, yPosition);

        yPosition += 5;

        window.currentPDFMahngebuehr = 0; 

        const tenantId = this.getCurrentTenantId();
        if (tenantId && mahnstufen?.getIndividualMahngebuehr && netDifference < 0) {
            const currentMahnstufe = mahnstufen.getMahnstufe(tenantId);
            const mahngebuehr = mahnstufen.getIndividualMahngebuehr(tenantId, currentMahnstufe);

            window.currentPDFMahngebuehr = mahngebuehr;
            console.log(`📊 [TABELLE] Mahngebühr global gespeichert: ${Utils.formatAmount(mahngebuehr)}`);

            if (mahngebuehr > 0) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.text('Mahngebühren:', columns.zeitraum.x, yPosition);
                PDFUtils.drawRightAlignedText(doc, Utils.formatAmount(mahngebuehr),
                    columns.differenz.x + columns.differenz.width - 2, yPosition);

                yPosition += 5;

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);

                doc.setDrawColor(120, 120, 120);
                doc.setLineWidth(0.5);
                doc.line(columns.zeitraum.x, yPosition - 1, tableEndX, yPosition - 1);

                const gesamtbetrag = rückstandsBetrag + mahngebuehr;

                window.currentPDFGesamtbetrag = gesamtbetrag;
                console.log(`📊 [TABELLE] Gesamtbetrag: ${Utils.formatAmount(rückstandsBetrag)} + ${Utils.formatAmount(mahngebuehr)} = ${Utils.formatAmount(gesamtbetrag)}`);

                doc.text('Zu zahlen:', columns.zeitraum.x, yPosition + 3);
                PDFUtils.drawRightAlignedText(doc, Utils.formatAmount(gesamtbetrag),
                    columns.differenz.x + columns.differenz.width - 2, yPosition + 3);

                yPosition += 6;
            }
        } else {

            window.currentPDFMahngebuehr = 0;
            window.currentPDFGesamtbetrag = netDifference < 0 ? rückstandsBetrag : 0;
            console.log(`📊 [TABELLE] ${netDifference < 0 ? 'Rückstand ohne Gebühren' : 'Guthaben'}: ${Utils.formatAmount(Math.abs(netDifference))}`);
        }

        return yPosition;

    } catch (error) {
        console.error('Fehler in drawSummaryRow:', error);
        return yPosition + 8;
    }
}

getCurrentTenantId() {

    return this.currentTenantId || null;
}

async createOptimizedInvoiceTable(doc, tenant, startY, margin, pageWidth, pageHeight) {
    try {

        this.currentTenantId = tenant.id;

        console.log('=== Tabellen-Generierung für:', tenant.name, '===');

        const columns = this.calculateTableColumns(margin, pageWidth);
        if (!columns) return this.getEmptyTableResult(startY);

        const debtPositions = this.getDebtPositions(tenant);
        console.log('Alle Positionen für PDF:', debtPositions.length);

        if (debtPositions.length === 0) return this.getEmptyTableResult(startY);

        let yPosition = startY;
        let netDifference = 0; 
        let currentPage = 1;

        const rowHeight = 4;
const headerHeight = 8;
const footerSpace = 15;
const MAX_ROWS_PER_PAGE = 29; 

yPosition = this.drawTableHeader(doc, yPosition, margin, pageWidth, columns);
let currentPageRows = 0;

for (const record of debtPositions) {
    const { sollAmount, habenAmount, difference } = this.calculateRecordAmounts(record);

    netDifference += difference;

    console.log(`Position: ${record.kostenart}, Soll: ${sollAmount}, Haben: ${habenAmount}, Diff: ${difference}, Laufende Summe: ${netDifference}`);

    const needsPageBreak = currentPageRows >= MAX_ROWS_PER_PAGE || 
                          this.needsNewPage(yPosition, rowHeight, pageHeight, footerSpace);

    if (needsPageBreak) {

        const reason = currentPageRows >= MAX_ROWS_PER_PAGE ? 
            `Zeilenlimit erreicht (${currentPageRows}/${MAX_ROWS_PER_PAGE})` : 
            'Platzmangel';
        console.log(`📄 Seitenumbruch: ${reason} - Seite ${currentPage} → ${currentPage + 1}`);

        if (this.pdf.modules?.footer) {
            await this.pdf.modules.footer.addPageWithFooter(doc);
        } else {
            doc.addPage();
        }

        yPosition = 35;
        yPosition = this.drawTableHeader(doc, yPosition, margin, pageWidth, columns);
        currentPageRows = 0; 
        currentPage++;

        console.log(`📊 Neue Seite ${currentPage} - Tabellen-Header bei Y: ${yPosition}`);
    }

    this.drawTableRow(doc, record, yPosition, rowHeight, columns, difference);
    yPosition += rowHeight;
    currentPageRows++; 

    console.log(`📊 Seite ${currentPage}: Zeile ${currentPageRows}/${MAX_ROWS_PER_PAGE} - ${record.kostenart?.substring(0, 30) || 'Unbekannt'}`);
}

        console.log(`📊 Finale Netto-Differenz für Summary: ${netDifference}`);
        yPosition = this.drawSummaryRow(doc, yPosition, margin, pageWidth, columns, netDifference);

        return {
            totalPages: currentPage,
            totalPositions: debtPositions.length,
            finalY: yPosition,
            isOnFirstPage: currentPage === 1,
            hasSpaceForBankDetails: (yPosition + 60) < (pageHeight - footerSpace)
        };

    } catch (error) {
        console.error('Fehler in createOptimizedInvoiceTable:', error);
        return this.getEmptyTableResult(startY);
    } finally {
        this.currentTenantId = null;
    }
}

    calculateRecordAmounts(record) {
        try {
            const sollAmount = Utils.parseAmount(record['soll']) || 0;
            const habenAmount = Utils.parseAmount(record['haben']) || 0;
            const difference = habenAmount - sollAmount;
            return { sollAmount, habenAmount, difference };

        } catch (error) {
            console.error('Fehler in calculateRecordAmounts:', error);
            return { sollAmount: 0, habenAmount: 0, difference: 0 };
        }
    }

    getEmptyTableResult(startY) {
        return {
            totalPages: 1,
            totalPositions: 0,
            finalY: startY,
            isOnFirstPage: true,
            hasSpaceForBankDetails: true
        };
    }

    validateTableData(tenant) {
        const issues = [];

        if (!tenant.records || tenant.records.length === 0) {
            issues.push('Keine Records vorhanden');
        }

        const debtPositions = this.getDebtPositions(tenant);
        if (debtPositions.length === 0) {
            issues.push('Keine Schuldpositionen gefunden');
        }

        return issues;
    }
}

window.PDFTabelleModule = PDFTabelleModule;