class CSVParserConfig {
    static get DELIMITERS() {
        return [';', ',', '\t', '|'];
    }

    static get HEADER_MAPPING() {
        return {
            'email01': 'email01',
            'email02': 'email02',
            'email1': 'email01',
            'email2': 'email02',
            'e-mail1': 'email01',
            'e-mail2': 'email02',
            'oemn': 'oemn',
            'name1': 'name1',
            'name2': 'name2',
            'anrede1': 'anrede1',
            'anrede2': 'anrede2',
            'hausort': 'hausort',
            'hausstr': 'hausstr',
            'mieterort': 'mieterort',
            'mieterstr': 'mieterstr',
            'kostenart': 'kostenart',
            'inter': 'inter',
            'lstintv': 'lstintv',
            'soll': 'soll',
            'haben': 'haben',
            'differenz': 'differenz',
            'iban': 'iban',
            'bic': 'bic',
            'ktoinh': 'ktoinh',
            'bank': 'bank',
            'portfolioname': 'portfolioname',
            'anwaltname': 'anwaltname',
            'mahngebühren': 'mahngebuehren',
            'haus': 'oemn',
            'AnwaltName': 'anwaltName',
            'Anwalt Name': 'anwaltName',
            'anwalt_name': 'anwaltName',
            'Attorney': 'anwaltName',
            'Rechtsanwalt': 'anwaltName',
            'anwalt': 'anwaltName'
        };
    }

    static get REQUIRED_HEADERS() {
        return [
            'oemn', 'name1', 'hausort', 'hausstr', 'kostenart',
            'lstintv', 'soll', 'haben', 'differenz', 'portfolioname'
        ];
    }

    static get REQUIRED_FIELDS() {
        return ['oemn', 'kostenart'];
    }

    static get VALIDATION_PATTERNS() {
        return {
            iban: /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/,
            bic: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/
        };
    }
}

class CSVParserUtils {

    static extractMahngebuehrenFromText(text) {
        if (!text || typeof text !== 'string') return 10.00;

        const patterns = [
            /(\d+[.,]\d{2})/g,
            /(\d+[.,]\d{1})/g,
            /(\d+)/g
        ];

        for (const pattern of patterns) {
            const matches = text.match(pattern);
            if (matches && matches.length > 0) {

                const numberStr = matches[0].replace(',', '.');
                const parsed = parseFloat(numberStr);

                if (!isNaN(parsed) && parsed > 0) {
                    console.log(`Mahngebühr extrahiert: "${text}" -> ${parsed}€`);
                    return parsed;
                }
            }
        }

        console.log(`Keine Mahngebühr gefunden in: "${text}" -> Standard 10,00€`);
        return 10.00;
    }

    static cleanValue(value) {
        if (!value || typeof value !== 'string') return '';
        return value.replace(/^["']|["']$/g, '').trim();
    }

    static cleanBankingField(value) {
        if (!value) return '';
        return value.replace(/\s+/g, '').toUpperCase();
    }

    static cleanAnrede(value) {
        if (!value) return '';
        return value.trim().replace(/,+$/, '');
    }

    static hasRequiredFields(record, requiredFields) {
        return requiredFields.every(field =>
            record[field] && record[field].trim() !== ''
        );
    }

    static countOccurrences(text, char) {
        return (text.match(new RegExp('\\' + char, 'g')) || []).length;
    }
}

class CSVParser {

    static parseCSVData(csvContent) {
        try {
            const lines = this.splitLines(csvContent);
            console.log('DEBUG: Gesamtzeilen in CSV:', lines.length);

            const delimiter = this.detectDelimiter(lines[0]);
            console.log('DEBUG: Erkanntes Trennzeichen:', delimiter);

            const headers = this.parseCSVLine(lines[0], delimiter);
            const cleanHeaders = this.cleanHeaders(headers);

            this.logHeaders(headers, cleanHeaders);
            this.validateRequiredHeaders(cleanHeaders);

            const { csvData, errors } = this.parseDataLines(lines, headers, cleanHeaders, delimiter);

            this.logResults(csvData.length, errors.length);

            return {
                success: csvData.length > 0,
                data: csvData,
                validLines: csvData.length,
                errors: errors
            };

        } catch (error) {
            console.error('CSV-Parsing Fehler:', error);
            return {
                success: false,
                data: [],
                errors: [error.message]
            };
        }
    }

    static splitLines(csvContent) {
        return csvContent.trim().split('\n');
    }

    static detectDelimiter(headerLine) {
        let maxCount = 0;
        let detectedDelimiter = ',';

        CSVParserConfig.DELIMITERS.forEach(delimiter => {
            const count = CSVParserUtils.countOccurrences(headerLine, delimiter);
            if (count > maxCount) {
                maxCount = count;
                detectedDelimiter = delimiter;
            }
        });

        return detectedDelimiter;
    }

    static parseCSVLine(line, delimiter = ',') {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current);
        return result;
    }

    static cleanHeaders(headers) {
        return headers.map(header => {
            const cleanHeader = header.trim().toLowerCase();
            return CSVParserConfig.HEADER_MAPPING[cleanHeader] || cleanHeader;
        });
    }

    static parseDataLines(lines, headers, cleanHeaders, delimiter) {
        const csvData = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
            try {
                const values = this.parseCSVLine(lines[i], delimiter);

                if (values.length !== headers.length) {
                    errors.push(`Zeile ${i + 1}: Falsche Anzahl Spalten (${values.length} statt ${headers.length})`);
                    continue;
                }

                const record = this.createRecord(cleanHeaders, values);

                if (this.isValidRecord(record)) {
                    csvData.push(record);
                } else {
                    errors.push(`Zeile ${i + 1}: Ungültige Daten`);
                }
            } catch (error) {
                errors.push(`Zeile ${i + 1}: ${error.message}`);
            }
        }

        return { csvData, errors };
    }

    static createRecord(headers, values) {
        const record = {};
        headers.forEach((header, index) => {
            const cleanValue = CSVParserUtils.cleanValue(values[index] || '');
            record[header] = cleanValue;
        });

        record.hasAnwalt = false;
        if (record.anwaltname && record.anwaltname.trim() !== '') {
            record.hasAnwalt = true;
            record.anwaltName = record.anwaltname;
        }

        this.validateAndCleanRecord(record);
        return record;
    }

    static validateAndCleanRecord(record) {

        if (record.iban) {
            record.iban = CSVParserUtils.cleanBankingField(record.iban);
        }
        if (record.bic) {
            record.bic = CSVParserUtils.cleanBankingField(record.bic);
        }

        if (record.anrede1) {
            record.anrede1 = CSVParserUtils.cleanAnrede(record.anrede1);
        }
        if (record.anrede2) {
            record.anrede2 = CSVParserUtils.cleanAnrede(record.anrede2);
        }

        if (record.portfolioname) {
            record.portfolioname = record.portfolioname.trim();
        }

        return record;
    }

    static isValidRecord(record) {
        const isValid = CSVParserUtils.hasRequiredFields(record, CSVParserConfig.REQUIRED_FIELDS);

        if (!record.anrede1 && !record.anrede2) {
            console.warn('Keine Anrede gefunden für:', record.oemn);
        }

        return isValid;
    }

    static validateRequiredHeaders(headers) {
        const missingHeaders = this.validateHeaders(headers, CSVParserConfig.REQUIRED_HEADERS);
        if (missingHeaders.length > 0) {
            console.warn('DEBUG: Fehlende Header:', missingHeaders);
        }
    }

    static validateHeaders(headers, requiredHeaders) {
        return requiredHeaders.filter(required => !headers.includes(required));
    }

    static logHeaders(headers, cleanHeaders) {
        console.log('DEBUG: Headers gefunden:', headers);
        console.log('DEBUG: Bereinigte Headers:', cleanHeaders);
    }

    static logResults(validCount, errorCount) {
        console.log('DEBUG: Gültige Zeilen:', validCount);
        console.log('DEBUG: Ungültige Zeilen:', errorCount);
    }
}

window.CSVParser = CSVParser;
window.CSVParserConfig = CSVParserConfig;
window.CSVParserUtils = CSVParserUtils;