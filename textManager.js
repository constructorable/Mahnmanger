class TextManagerConfig {
    static get STORAGE_KEY() { return 'mahnmanager_custom_texts'; }
    static get VERSION() { return '1.0'; }

    static get STANDARD_SAETZE() {
        return {
            satz1: 'Bitte bezahlen Sie Ihre Miete bis spätestens 3. des Wertages.',
            satz2: 'Bitte passen Sie Ihre Vorauszahlungen an.',
            satz3: 'Bitte passen Sie Ihre Mietzahlung entsprechend der Mietvertragsbedingungen an.'
        };
    }

    static get DEFAULT_TEXTS() {
        return {
            1: {
                anrede: 'Sehr geehrte Damen und Herren,',
                einleitung: 'bei der regelmäßigen Überprüfung Ihres Mietkontos mussten wir bedauerlicherweise einen Zahlungsrückstand in Höhe von {SCHULDEN_BETRAG} feststellen. Sicherlich ist es Ihrer Aufmerksamkeit entgangen, dass die nachfolgend genannten Beträge bereits zur Zahlung fällig geworden sind.',
                zahlungsfrist: 'Wir bitten Sie, den offenen Betrag von {SCHULDEN_BETRAG} bis zum {ZAHLUNGSFRIST} auf untenstehendes Konto zu überweisen.',
                haupttext: 'Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.'
            },
            2: {
                anrede: 'Sehr geehrte Damen und Herren,',
                einleitung: 'trotz unserer Zahlungserinnerung ist die Zahlung folgender Beträge noch nicht bei uns eingegangen:',
                zahlungsfrist: 'Wir fordern Sie auf, den Gesamtbetrag von {GESAMT_BETRAG} bis zum {ZAHLUNGSFRIST} zu begleichen.',
                haupttext: 'Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.'
            },
            3: {
                anrede: 'Sehr geehrte Damen und Herren,',
                einleitung: 'trotz mehrfacher Aufforderung ist die Zahlung folgender Beträge noch immer nicht erfolgt:',
                zahlungsfrist: 'Zahlen Sie den Gesamtbetrag von {GESAMT_BETRAG} bis spätestens {ZAHLUNGSFRIST}.',
                kuendigungstext: 'Vorsorglich machen wir Sie darauf aufmerksam, dass wir gemäß § 543 Abs. 2 Satz 3 BGB zur Kündigung des mit Ihnen bestehenden Mietverhältnisses berechtigt sind, wenn Sie für einen Zeitraum, der sich über mehr als zwei Fälligkeitsterminen erstreckt, mit der Entrichtung der Miete oder eines nicht unerheblichen Teiles der Miete im Verzug befinden. Sollten Sie den ausstehenden Gesamtbetrag nicht innerhalb der o. g. Frist ausgleichen, werden wir von unserem Recht der fristlosen Kündigung Gebrauch machen.',
                haupttext: 'Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.'
            }
        };
    }
}

class TextManager {
    constructor() {
        this.customTexts = new Map();
        this.loadFromStorage();
    }

     getStandardSaetze() {
        return TextManagerConfig.STANDARD_SAETZE;
    }

 addStandardSatzToText(currentText, satzKey) {
    console.log('=== TEXT MANAGER: STANDARDSATZ HINZUFÜGEN ===');
    console.log('Current Text:', currentText);
    console.log('Satz Key:', satzKey);

    const standardSaetze = this.getStandardSaetze();
    const satz = standardSaetze[satzKey];
    
    console.log('Verfügbare Sätze:', standardSaetze);
    console.log('Gewählter Satz:', satz);
    
    if (!satz) {
        console.error('Satz nicht gefunden für Key:', satzKey);
        return currentText;
    }
    
    const cleanCurrentText = currentText.trim();
    let result;
    
    if (!cleanCurrentText) {
        result = satz;
    } else {
        result = cleanCurrentText + '\n\n' + satz;
    }
    
    console.log('Ergebnis:', result);
    console.log('=== TEXT MANAGER ENDE ===');
    
    return result;
}

   getTextForMahnstufe(mahnstufe, tenantId = null) {
        const defaultTexts = TextManagerConfig.DEFAULT_TEXTS[mahnstufe] || TextManagerConfig.DEFAULT_TEXTS[1];
        
        if (tenantId && this.customTexts.has(`${mahnstufe}_${tenantId}`)) {
            return { ...defaultTexts, ...this.customTexts.get(`${mahnstufe}_${tenantId}`) };
        }
        
        if (this.customTexts.has(`${mahnstufe}_global`)) {
            return { ...defaultTexts, ...this.customTexts.get(`${mahnstufe}_global`) };
        }
        
        return defaultTexts;
    }

   setCustomText(mahnstufe, textType, content, tenantId = null) {
        const key = tenantId ? `${mahnstufe}_${tenantId}` : `${mahnstufe}_global`;
        
        if (!this.customTexts.has(key)) {
            this.customTexts.set(key, {});
        }
        
        this.customTexts.get(key)[textType] = content;
        this.saveToStorage();
    }

   resetToDefault(mahnstufe, tenantId = null) {
        const key = tenantId ? `${mahnstufe}_${tenantId}` : `${mahnstufe}_global`;
        this.customTexts.delete(key);
        this.saveToStorage();
    }

   replaceVariables(text, variables) {
        let result = text;
        Object.keys(variables).forEach(key => {
            const placeholder = `{${key}}`;
            result = result.replace(new RegExp(placeholder, 'g'), variables[key]);
        });
        return result;
    }






    saveToStorage() {
        try {
            const data = {
                customTexts: Array.from(this.customTexts.entries()),
                version: TextManagerConfig.VERSION,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem(TextManagerConfig.STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error('Fehler beim Speichern der benutzerdefinierten Texte:', error);
        }
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem(TextManagerConfig.STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                this.customTexts = new Map(parsed.customTexts || []);
            }
        } catch (error) {
            console.error('Fehler beim Laden der benutzerdefinierten Texte:', error);
            this.customTexts = new Map();
        }
    }
}

window.TextManager = TextManager;
window.textManager = new TextManager();

/* console.log('TextManager geladen und global verfügbar'); */