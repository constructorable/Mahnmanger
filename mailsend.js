class MailSend {
    constructor() {
        this.VERSION = '1.6.1';
        this.initializeStyles();
    }

    initializeStyles() {
        if (document.getElementById('mailsend-styles')) return;
        const style = document.createElement('style');
        style.id = 'mailsend-styles';
        style.textContent = `
            .mailsend-modal {
                display: none;position: fixed;z-index: 10000;left: 0;top: 0;width: 100%;height: 100%;
                background-color: rgba(0, 0, 0, 0.5);animation: fadeIn 0.3s ease-out;
            }
            .mailsend-modal-content {
                background-color: #fff;margin: 5% auto;padding: 0;border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);width: 90%;max-width: 500px;
                animation: slideIn 0.3s ease-out;
            }
            .mailsend-modal-header {
                background: #5f7d95;color: white;
                padding: 20px;border-radius: 8px 8px 0 0;display: flex;justify-content: space-between;align-items: center;
            }
            .mailsend-modal-title { margin: 0;font-size: 18px;font-weight: 600; }
            .mailsend-modal-close {
                background: none;border: none;color: white;font-size: 24px;cursor: pointer;
                padding: 0;width: 30px;height: 30px;display: flex;align-items: center;justify-content: center;
                border-radius: 50%;transition: background-color 0.2s;
            }
            .mailsend-modal-close:hover { background-color: rgba(255, 255, 255, 0.2); }
            .mailsend-modal-body { padding: 30px;text-align: center; }
            .mailsend-options { display: grid;grid-template-columns: 1fr 1fr;gap: 20px;margin-top: 20px; }
            .mailsend-option {
                padding: 25px 20px;border: 2px solid #e0e0e0;border-radius: 8px;cursor: pointer;
                transition: all 0.3s ease;background: white;text-decoration: none;color: #333;
                display: flex;flex-direction: column;align-items: center;gap: 10px;
            }
            .mailsend-option:hover {
              
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);color: #667eea;
            }
            .mailsend-option-icon { font-size: 32px;color: #667eea; }
            .mailsend-option-title { font-weight: 600;font-size: 16px;margin: 0; }
            .mailsend-option-desc { font-size: 14px;color: #666;margin: 0;line-height: 1.4; }
            .mailsend-tenant-info {
                background: #f8f9fa;border-radius: 6px;padding: 15px;margin-bottom: 20px;text-align: left;
            }
            .mailsend-tenant-info h4 { margin: 0 0 10px 0;color: #333;font-size: 16px; }
            .mailsend-info-row { display: flex;justify-content: space-between;margin-bottom: 5px;font-size: 14px; }
            .mailsend-info-label { color: #666;font-weight: 500; }
            .mailsend-info-value { color: #333;font-weight: 600; }
            .mailsend-bank-info {
                background: #e8f4f8;border-left: 4px solid #17a2b8;padding: 10px;margin-top: 10px;font-size: 12px;
            }
            .mailsend-iban { font-family: 'Courier New', monospace;letter-spacing: 1px;font-weight: bold; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideIn { from { opacity: 0;transform: translateY(-50px); } to { opacity: 1;transform: translateY(0); } }
            @media (max-width: 768px) {
                .mailsend-modal-content { width: 95%;margin: 10% auto; }
                .mailsend-options { grid-template-columns: 1fr; }
                .mailsend-modal-body { padding: 20px; }
            }
        `;
        document.head.appendChild(style);
    }

    async showActionModal(tenantId) {
        try {
            const tenant = window.app?.getTenantByAllMethods?.(tenantId);
            if (!tenant) throw new Error('Mieter nicht gefunden');
            const modal = this.createModal(tenant);
            document.body.appendChild(modal);
            modal.style.display = 'block';
            this.setupModalEvents(modal, tenant);
        } catch (error) {
            Utils.showNotification(`Fehler: ${error.message}`, 'error');
        }
    }

createModal(tenant) {
    const data = this.getTenantDataFromDOM(tenant);
    const bankData = this.getBankData(tenant);
    const modal = document.createElement('div');
    modal.className = 'mailsend-modal';
    modal.innerHTML = `
        <div class="mailsend-modal-content">
            <div class="mailsend-modal-header">
                <h3 class="mailsend-modal-title"><i class="fas fa-envelope"></i> Aktion wählen</h3>
                <button class="mailsend-modal-close" onclick="this.closest('.mailsend-modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="mailsend-modal-body">
                <div class="mailsend-tenant-info">
                    <h4><i class="fas fa-user"></i> ${Utils.escapeHtml(tenant.name)}</h4>
                    <div class="mailsend-info-row">
                        <span class="mailsend-info-label">Mieternummer:</span>
                        <span class="mailsend-info-value">${Utils.escapeHtml(tenant.id)}</span>
                    </div>
                    <div class="mailsend-info-row">
                        <span class="mailsend-info-label">Adresse:</span>
                        <span class="mailsend-info-value">${data.fullAddress}</span>
                    </div>
                    <div class="mailsend-info-row">
                        <span class="mailsend-info-label">Dokument:</span>
                        <span class="mailsend-info-value">${data.mahnstufeName}</span>
                    </div>
                    <div class="mailsend-info-row">
                        <span class="mailsend-info-label">${data.mahnstufe === 'E' ? 'Offener Betrag:' : 'Schuldbetrag:'}</span>
                        <span class="mailsend-info-value">${Utils.formatAmount(data.schuldbetrag)} €</span>
                    </div>
                    ${data.mahngebuehr > 0 ? `
                    <div class="mailsend-info-row">
                        <span class="mailsend-info-label">Mahngebühr:</span>
                        <span class="mailsend-info-value">${Utils.formatAmount(data.mahngebuehr)} €</span>
                    </div>` : ''}
                    <div class="mailsend-info-row">
                        <span class="mailsend-info-label"><strong>${data.mahnstufe === 'E' ? 'Zu zahlender Betrag:' : 'Gesamtbetrag:'}</strong></span>
                        <span class="mailsend-info-value"><strong>${Utils.formatAmount(data.gesamtbetrag)} €</strong></span>
                    </div>
                    <div class="mailsend-bank-info">
                        <div><strong>IBAN:</strong> <span class="mailsend-iban">${this.formatIBAN(bankData.iban)}</span></div>
                        <div><strong>BIC:</strong> ${bankData.bic}</div>
                        <div><strong>Kontoinhaber:</strong> ${bankData.kontoinhaber}</div>
                        <div><strong>Bank:</strong> ${bankData.bankname}</div>
                    </div>
                </div>
                <p>Wie möchten Sie fortfahren?</p>
                <div class="mailsend-options">
                    <div class="mailsend-option" data-action="pdf-only">
                        <i class="fas fa-file-pdf mailsend-option-icon"></i>
                        <h4 class="mailsend-option-title">Nur PDF erstellen</h4>
                        <p class="mailsend-option-desc">PDF herunterladen und manuell versenden</p>
                    </div>
                    <div class="mailsend-option" data-action="email">
                        <i class="fas fa-envelope mailsend-option-icon"></i>
                        <h4 class="mailsend-option-title">E-Mail öffnen</h4>
                        <p class="mailsend-option-desc">E-Mail-Client mit Überweisungsdaten öffnen</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    return modal;
}

    setupModalEvents(modal, tenant) {
        modal.querySelectorAll('.mailsend-option').forEach(option => {
            option.addEventListener('click', async () => {
                const action = option.getAttribute('data-action');
                modal.remove();
                if (action === 'pdf-only') {
                    await this.generatePDF(tenant);
                } else if (action === 'email') {
                    await this.generatePDFAndEmail(tenant);
                }
            });
        });

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    async generatePDF(tenant) {
        try {
            if (!window.app?.validateTenantForPDF?.(tenant)) {
                throw new Error('Mieter-Validierung fehlgeschlagen');
            }
            const result = await window.app.pdfGenerator.generatePDFForTenant(tenant);
            if (result?.success) {
                const data = this.getTenantDataFromDOM(tenant);
                Utils.showNotification(`${data.mahnstufeName} für ${tenant.name} erstellt`, 'success');
            } else {
                throw new Error('PDF-Generierung fehlgeschlagen');
            }
        } catch (error) {
            Utils.showNotification(`PDF-Erstellung fehlgeschlagen: ${error.message}`, 'error');
        }
    }

    async generatePDFAndEmail(tenant) {
        try {
            Utils.showNotification('PDF wird erstellt...', 'info');
            await this.generatePDF(tenant);
            await Utils.delay(2000);
            this.openEmail(tenant);
        } catch (error) {
            Utils.showNotification(`Fehler: ${error.message}`, 'error');
        }
    }

async openEmail(tenant) {
    try {
        const emailData = this.createEmailData(tenant);
        
        // Zeige Auswahl-Modal für E-Mail-Client
        const clientChoice = await this.showEmailClientChoice();
        
        if (clientChoice === 'outlook') {
            this.openInOutlook(emailData);
        } else if (clientChoice === 'browser') {
            this.openInBrowser(emailData);
        }
        // Bei 'cancel' passiert nichts
        
    } catch (error) {
        Utils.showNotification(`E-Mail-Fehler: ${error.message}`, 'error');
    }
}

showEmailClientChoice() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'mailsend-modal';
        modal.innerHTML = `
            <div class="mailsend-modal-content" style="max-width: 400px;">
                <div class="mailsend-modal-header">
                    <h3 class="mailsend-modal-title"><i class="fas fa-envelope"></i> E-Mail-Client wählen</h3>
                    <button class="mailsend-modal-close" onclick="this.closest('.mailsend-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="mailsend-modal-body">
                    <p style="margin-bottom: 20px; color: #666;">Wie möchten Sie die E-Mail öffnen?</p>
                    <div class="mailsend-options">
                        <div class="mailsend-option" data-choice="outlook">
                            <i class="fas fa-desktop mailsend-option-icon"></i>
                            <h4 class="mailsend-option-title">Outlook (Desktop)</h4>
                            <p class="mailsend-option-desc">Lokal installiertes Outlook öffnen</p>
                        </div>
                        <div class="mailsend-option" data-choice="browser">
                            <i class="fas fa-globe mailsend-option-icon"></i>
                            <h4 class="mailsend-option-title">Browser E-Mail</h4>
                            <p class="mailsend-option-desc">Standard E-Mail-Client im Browser</p>
                        </div>
                    </div>
                    <div style="text-align: center; margin-top: 15px;">
                        <button class="btn btn-secondary" data-choice="cancel">
                            <i class="fas fa-times"></i> Abbrechen
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'block';

        // Event-Listener für Auswahl
        modal.addEventListener('click', (e) => {
            const choice = e.target.closest('[data-choice]')?.getAttribute('data-choice');
            if (choice) {
                modal.remove();
                resolve(choice);
            }
        });

        // ESC-Taste für Abbrechen
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
                resolve('cancel');
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Klick außerhalb des Modals
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                resolve('cancel');
            }
        });
    });
}

openInOutlook(emailData) {
    try {
        // *** FIX: E-Mail-Daten temporär speichern für alternative Encoding-Methoden ***
        this.currentEmailData = emailData;
        
        // Outlook-spezifische URL mit korrigiertem Encoding
        const outlookUrl = this.buildOutlookUrl(emailData);
        
        console.log('📧 Öffne in Outlook:', outlookUrl);
        
        // Versuche Outlook-spezifische Methoden mit verbessertem Encoding
        const outlookMethods = [
            () => this.tryOutlookProtocol(outlookUrl),
            () => this.tryOutlookDeepLink(emailData),
            () => this.tryWindowOpenOutlook(outlookUrl)
        ];
        
        let success = false;
        for (const method of outlookMethods) {
            try {
                if (method()) {
                    success = true;
                    break;
                }
            } catch (error) {
                console.warn('Outlook-Methode fehlgeschlagen:', error);
            }
        }
        
        // Cleanup
        delete this.currentEmailData;
        
        if (success) {
            Utils.showNotification('Outlook wird geöffnet...', 'success');
        } else {
            console.warn('Outlook-Methoden fehlgeschlagen, verwende Browser-Fallback');
            this.openInBrowser(emailData);
        }
        
    } catch (error) {
        console.error('Outlook-Öffnung fehlgeschlagen:', error);
        Utils.showNotification('Outlook konnte nicht geöffnet werden, verwende Browser-Fallback', 'warning');
        this.openInBrowser(emailData);
    }
}

openInBrowser(emailData) {
    try {
        const mailtoUrl = this.buildMailtoUrl(emailData);
        
        console.log('📧 Öffne im Browser:', mailtoUrl);
        
        // Versuche verschiedene Browser-Methoden nacheinander
        const browserMethods = [
            () => this.tryWindowOpen(mailtoUrl),
            () => this.tryHiddenLink(mailtoUrl),
            () => this.tryFormSubmit(mailtoUrl),
            () => this.tryIframe(mailtoUrl)
        ];
        
        let success = false;
        for (const method of browserMethods) {
            try {
                if (method()) {
                    success = true;
                    break;
                }
            } catch (error) {
                console.warn('Browser-E-Mail-Methode fehlgeschlagen:', error);
            }
        }
        
        if (success) {
            Utils.showNotification('E-Mail-Client im Browser geöffnet', 'success');
        } else {
            throw new Error('Alle Browser-E-Mail-Methoden fehlgeschlagen');
        }
        
    } catch (error) {
        Utils.showNotification(`Browser-E-Mail-Fehler: ${error.message}`, 'error');
    }
}

tryWindowOpen(mailtoUrl) {
    const emailWindow = window.open(mailtoUrl, '_blank', 'noopener,noreferrer');
    return emailWindow && !emailWindow.closed;
}

tryHiddenLink(mailtoUrl) {
    const link = document.createElement('a');
    link.href = mailtoUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 1000);
    return true;
}

tryFormSubmit(mailtoUrl) {
    const form = document.createElement('form');
    form.method = 'GET';
    form.action = mailtoUrl;
    form.target = '_blank';
    form.style.display = 'none';
    document.body.appendChild(form);
    form.submit();
    setTimeout(() => form.remove(), 1000);
    return true;
}

tryIframe(mailtoUrl) {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = mailtoUrl;
    document.body.appendChild(iframe);
    setTimeout(() => iframe.remove(), 3000);
    return true;
}



fixPlusToSpaces(text) {
    if (!text) return text;
    // Ersetze alle + durch echte Leerzeichen
    return text.replace(/\+/g, ' ');
}



buildOutlookUrl(emailData) {
    const params = new URLSearchParams();
    
    // GEÄNDERT: Plus-Zeichen zu Leerzeichen konvertieren
    const outlookSafeSubject = emailData.subject ? 
        this.fixPlusToSpaces(encodeURIComponent(emailData.subject)) : '';
    const outlookSafeBody = emailData.body ? 
        this.fixPlusToSpaces(encodeURIComponent(emailData.body)) : '';
    
    if (outlookSafeSubject) params.append('subject', outlookSafeSubject);
    if (outlookSafeBody) params.append('body', outlookSafeBody);
    if (emailData.cc) params.append('cc', emailData.cc);
    
    return `outlook:${emailData.to ? encodeURIComponent(emailData.to) : ''}?${params.toString()}`;
}

tryOutlookProtocol(outlookUrl) {
    const emailData = this.currentEmailData;
    if (emailData) {
        // GEÄNDERT: Plus-Zeichen zu Leerzeichen
        const manualUrl = `outlook:${encodeURIComponent(emailData.to || '')}?` +
            `subject=${this.fixPlusToSpaces(encodeURIComponent(emailData.subject || ''))}&` +
            `body=${this.fixPlusToSpaces(encodeURIComponent(emailData.body || ''))}` +
            `${emailData.cc ? `&cc=${encodeURIComponent(emailData.cc)}` : ''}`;
        
        window.location.href = manualUrl;
        return true;
    }
    
    window.location.href = outlookUrl;
    return true;
}

tryOutlookDeepLink(emailData) {
    // GEÄNDERT: Plus-Zeichen zu Leerzeichen
    const safeSubject = emailData.subject ? this.fixPlusToSpaces(encodeURIComponent(emailData.subject)) : '';
    const safeBody = emailData.body ? this.fixPlusToSpaces(encodeURIComponent(emailData.body)) : '';
    
    const deepLinkUrl = `ms-outlook://compose/?` +
        `to=${encodeURIComponent(emailData.to || '')}&` +
        `subject=${safeSubject}&` +
        `body=${safeBody}` +
        `${emailData.cc ? `&cc=${encodeURIComponent(emailData.cc)}` : ''}`;
    
    window.location.href = deepLinkUrl;
    return true;
}

tryWindowOpenOutlook(outlookUrl) {
    const outlookWindow = window.open(outlookUrl, '_blank', 'noopener,noreferrer');
    return outlookWindow && !outlookWindow.closed;
}

tryWindowOpen(mailtoUrl) {
    const emailWindow = window.open(mailtoUrl, '_blank', 'noopener,noreferrer');
    return emailWindow && !emailWindow.closed;
}

tryHiddenLink(mailtoUrl) {
    const link = document.createElement('a');
    link.href = mailtoUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 1000);
    return true;
}

tryFormSubmit(mailtoUrl) {
    const form = document.createElement('form');
    form.method = 'GET';
    form.action = mailtoUrl;
    form.target = '_blank';
    form.style.display = 'none';
    document.body.appendChild(form);
    form.submit();
    setTimeout(() => form.remove(), 1000);
    return true;
}

tryIframe(mailtoUrl) {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = mailtoUrl;
    document.body.appendChild(iframe);
    setTimeout(() => iframe.remove(), 3000);
    return true;
}

openMailtoViaHiddenLink(mailtoUrl) {
    try {
        // Erstelle einen versteckten Link und klicke ihn programmatisch
        const hiddenLink = document.createElement('a');
        hiddenLink.href = mailtoUrl;
        hiddenLink.target = '_blank';
        hiddenLink.rel = 'noopener noreferrer';
        hiddenLink.style.display = 'none';
        
        document.body.appendChild(hiddenLink);
        hiddenLink.click();
        
        // Link nach kurzer Zeit wieder entfernen
        setTimeout(() => {
            if (hiddenLink.parentNode) {
                hiddenLink.parentNode.removeChild(hiddenLink);
            }
        }, 1000);
        
    } catch (error) {
        console.error('Fallback-Link-Methode fehlgeschlagen:', error);
        // Letzter Fallback: iframe-Methode
        this.openMailtoViaIframe(mailtoUrl);
    }
}

getTenantDataFromDOM(tenant) {
    // ECHTZEIT-DATEN aus dem DOM extrahieren
    const tenantCard = document.querySelector(`[data-tenant-id="${tenant.id}"]`);
    if (!tenantCard) {
        console.warn(`Tenant-Karte für ${tenant.id} nicht gefunden`);
        return this.getTenantDataFallback(tenant);
    }

    // Mahnstufe aus Badge extrahieren
    const mahnstufeBadge = tenantCard.querySelector('.mahnstufe-current');
    let mahnstufe = 'E';
    let mahnstufeName = 'Zahlungserinnerung';

    if (mahnstufeBadge) {
        const title = mahnstufeBadge.getAttribute('title') || '';
        const badgeText = mahnstufeBadge.textContent.trim();
        
        if (title.includes('1. Mahnung') || badgeText.includes('1M')) {
            mahnstufe = 'M1';
            mahnstufeName = '1. Mahnung';
        } else if (title.includes('2. Mahnung') || badgeText.includes('2M')) {
            mahnstufe = 'M2';
            mahnstufeName = '2. Mahnung';
        } else if (title.includes('3. Mahnung') || badgeText.includes('3M')) {
            mahnstufe = 'M3';
            mahnstufeName = '3. Mahnung';
        } else if (title.includes('Zahlungserinnerung') || badgeText.includes('ZE')) {
            mahnstufe = 'E';
            mahnstufeName = 'Zahlungserinnerung';
        }
    }

    // *** KORRIGIERT: Mahngebühr nur bei echten Mahnungen (M1, M2, M3) ***
    let mahngebuehr = 0;
    
    if (mahnstufe !== 'E') { // Nur bei Mahnungen, nicht bei Zahlungserinnerung
        try {
            // Alle Mahngebühren-Inputs auf der Seite finden
            const allMahngebuehrInputs = document.querySelectorAll('.mahngebuehren-input, input[id*="mahngebuehr"]');
            let mahngebuehrInput = null;
            
            // Den richtigen Input für diese Tenant-ID finden
            for (const input of allMahngebuehrInputs) {
                const inputTenantId = input.getAttribute('data-tenant-id') || 
                                    input.id.replace('mahngebuehr-', '') ||
                                    input.closest('[data-tenant-id]')?.getAttribute('data-tenant-id');
                
                if (inputTenantId === tenant.id) {
                    mahngebuehrInput = input;
                    break;
                }
            }
            
            if (mahngebuehrInput) {
                mahngebuehr = parseFloat(mahngebuehrInput.value) || 0;
                console.log(`💰 Echtzeit-Mahngebühr für ${tenant.id} (${mahnstufe}): ${mahngebuehr}`);
            } else {
                // Fallback: System-Mahngebühr
                mahngebuehr = this.calculateMahngebuehr(tenant, mahnstufe, -100);
                console.log(`💰 Fallback-Mahngebühr für ${tenant.id} (${mahnstufe}): ${mahngebuehr}`);
            }
        } catch (error) {
            console.warn('Fehler beim Extrahieren der Mahngebühr:', error);
            mahngebuehr = this.calculateMahngebuehr(tenant, mahnstufe, -100);
        }
    } else {
        console.log(`💰 Zahlungserinnerung für ${tenant.id}: Keine Mahngebühren`);
    }

    // Schuldbetrag aus Tenant-Debt Element extrahieren
    const debtElement = tenantCard.querySelector('.tenant-debt');
    let schuldbetrag = 0;
    
    if (debtElement) {
        const debtValueElement = debtElement.querySelector('.debt, .tenant-debt-amount, .debt-amount') || debtElement;
        const debtText = debtValueElement.textContent || '';
                const cleanDebtText = debtText
            .replace(/[^\d,.-]/g, '')           // Nur Zahlen, Kommas, Punkte und Minus behalten
            .replace(/\.(?=\d{3})/g, '')        // Tausender-Punkte entfernen (1.234,56 -> 1234,56)
            .replace(',', '.');                 // Komma durch Punkt ersetzen
        schuldbetrag = Math.abs(parseFloat(cleanDebtText)) || 0;
        console.log(`💸 Schuldbetrag für ${tenant.id}: ${schuldbetrag} (aus "${debtText}")`);
    } else {
        schuldbetrag = Math.abs(this.calculateNetDifference(tenant));
        console.log(`Schuldbetrag für ${tenant.id}: ${schuldbetrag} (berechnet aus Records)`);
    }

    const gesamtbetrag = schuldbetrag + mahngebuehr;
    const fullAddress = this.getFullAddress(tenant);
    const anrede = this.getPersonalAnrede(tenant);
    const verwendungszweck = `Ausgleich, ${tenant.id}`;

    console.log(`📊 Echtzeit-Daten für ${tenant.id}:`, {
        mahnstufe, mahnstufeName, schuldbetrag, mahngebuehr, gesamtbetrag
    });

    return {
        mahnstufe, mahnstufeName, schuldbetrag, mahngebuehr, gesamtbetrag,
        fullAddress, anrede, verwendungszweck
    };
}
    getTenantDataFallback(tenant) {
        // Fallback wenn DOM-Extraktion fehlschlägt
        const pdfBankData = this.loadSessionData(tenant.id, 'pdf_bank_data');
        const pdfMahnstufenData = this.loadSessionData(tenant.id, 'pdf_mahnstufe_data');
        
        let mahnstufe, mahnstufeName, schuldbetrag, mahngebuehr, gesamtbetrag, verwendungszweck;

        if (pdfMahnstufenData) {
            mahnstufe = pdfMahnstufenData.mahnstufe;
            mahnstufeName = pdfMahnstufenData.mahnstufeName;
        } else {
            mahnstufe = this.detectMahnstufe(tenant);
            mahnstufeName = this.getMahnstufenConfig(mahnstufe).name;
        }

        if (pdfBankData) {
            schuldbetrag = pdfBankData.schuldenBetrag;
            mahngebuehr = pdfBankData.mahngebuehr;
            gesamtbetrag = pdfBankData.ueberweisungsbetrag;
            verwendungszweck = pdfBankData.verwendungszweck;
        } else {
            const totalDifference = this.calculateNetDifference(tenant);
            mahngebuehr = this.calculateMahngebuehr(tenant, mahnstufe, totalDifference);
            schuldbetrag = Math.abs(totalDifference);
            gesamtbetrag = schuldbetrag + mahngebuehr;
            verwendungszweck = `Ausgleich, ${tenant.id}`;
        }

        return {
            mahnstufe, mahnstufeName, schuldbetrag, mahngebuehr, gesamtbetrag,
            fullAddress: this.getFullAddress(tenant),
            anrede: this.getPersonalAnrede(tenant),
            verwendungszweck
        };
    }

    loadSessionData(tenantId, type) {
        try {
            const stored = sessionStorage.getItem(`${type}_${tenantId}`);
            if (stored) {
                const data = JSON.parse(stored);
                return (Date.now() - data.timestamp < 300000) ? data : null;
            }
        } catch (error) {
            return null;
        }
        return null;
    }

    calculateNetDifference(tenant) {
        if (!tenant.records?.length) return 0;
        return tenant.records
            .filter(record => record.enabled)
            .reduce((sum, record) => {
                const soll = Utils.parseAmount(record.soll) || 0;
                const haben = Utils.parseAmount(record.haben) || 0;
                return sum + (haben - soll);
            }, 0);
    }

    detectMahnstufe(tenant) {
        const systemMahnstufe = window.mahnstufen?.getMahnstufe?.(tenant.id);
        if (systemMahnstufe && systemMahnstufe !== 'undefined') return systemMahnstufe;

        if (tenant.mahnstufe) return tenant.mahnstufe;

        const tenantCard = document.querySelector(`[data-tenant-id="${tenant.id}"] .mahnstufe-current`);
        if (tenantCard) {
            const title = tenantCard.getAttribute('title') || '';
            if (title.includes('1. Mahnung')) return 'M1';
            if (title.includes('2. Mahnung')) return 'M2';
            if (title.includes('3. Mahnung')) return 'M3';
            if (title.includes('Zahlungserinnerung')) return 'E';
        }

        return 'E';
    }

calculateMahngebuehr(tenant, mahnstufe, totalDifference) {
    // *** KORRIGIERT: Zahlungserinnerung hat KEINE Mahngebühren ***
    if (totalDifference >= 0 || mahnstufe === 'E') return 0;

    const gebuehr = window.mahnstufen?.getIndividualMahngebuehr?.(tenant.id, mahnstufe) ||
                   window.app?.tenantManager?.getCSVMahngebuehr?.(tenant.id) ||
                   { 'M1': 15, 'M2': 25, 'M3': 35 }[mahnstufe] || 0; // E entfernt

    return typeof gebuehr === 'number' ? gebuehr : 0;
}

    getMahnstufenConfig(mahnstufe) {
        const configs = {
            'E': { name: 'Zahlungserinnerung' },
            'M1': { name: '1. Mahnung' },
            'M2': { name: '2. Mahnung' },
            'M3': { name: '3. Mahnung' }
        };

        return window.mahnstufen?.getMahnstufeConfig?.(mahnstufe) ||
               window.mahnstufen?.MAHNSTUFEN?.[mahnstufe] ||
               configs[mahnstufe] || configs['E'];
    }

    getFullAddress(tenant) {
        const address = tenant.street || tenant.objekt || tenant.adresse || tenant.address || tenant.property;
        if (address) return address.trim();

        const street = tenant.strasse || '';
        const number = tenant.hausnummer || tenant.number || '';
        return (street + (number ? ' ' + number : '')).trim() || 'Unbekannte Adresse';
    }

    getPersonalAnrede(tenant) {
        const customAnrede = window.app?.tenantManager?.getTenantAnrede?.(tenant.id);
        if (customAnrede) return customAnrede;
        if (tenant.anrede) return tenant.anrede;

        const name = (tenant.name || '').toLowerCase();
        if (name.includes('frau')) return 'Sehr geehrte Frau';
        if (name.includes('herr')) return 'Sehr geehrter Herr';
        return 'Sehr geehrte Damen und Herren';
    }

getBankData(tenant) {
    const pdfData = this.loadSessionData(tenant.id, 'pdf_bank_data');
    
    if (pdfData?.bankData) {
        return {
            iban: this.formatIBAN(pdfData.bankData.iban || ''),
            bic: pdfData.bankData.bic || 'N/A',
            kontoinhaber: pdfData.bankData.kontoinhaber || 'N/A',
            bankname: pdfData.bankData.bank || pdfData.bankData.bankname || 'N/A'
        };
    }

    // Fallback-Extraktion
    let bankData = this.extractBankDataFromTenant(tenant);
    
    if (!this.hasValidBankData(bankData)) {
        bankData = this.extractBankDataFromDOM(tenant.id);
    }

    if (!this.hasValidBankData(bankData)) {
        const userData = window.userManager?.getUserData?.() || {};
        if (userData.iban) {
            bankData = {
                iban: userData.iban,
                bic: userData.bic || 'N/A',
                kontoinhaber: userData.kontoinhaber || userData.name || 'N/A',
                bankname: userData.bankname || userData.bank || 'N/A'
            };
        }
    }

    // Standardwerte setzen falls immer noch undefined
    const finalBankData = {
        iban: bankData.iban || 'DE00 0000 0000 0000 0000 00',
        bic: bankData.bic || 'N/A',
        kontoinhaber: bankData.kontoinhaber || 'N/A',
        bankname: bankData.bankname || bankData.bank || 'N/A'
    };

    finalBankData.iban = this.formatIBAN(finalBankData.iban);
    
    console.log(`💳 Finale Bankdaten für ${tenant.id}:`, finalBankData);
    
    return finalBankData;
}

   extractBankDataFromTenant(tenant) {
    return {
        kontoinhaber: tenant.ktoinh || tenant.kontoinhaber || '',
        bankname: tenant.bank || tenant.bankname || '', // KORRIGIERT: bankname statt bank
        iban: tenant.iban || '',
        bic: tenant.bic || ''
    };
}

extractBankDataFromDOM(tenantId) {
    try {
        const masterDataTable = document.querySelector(`[data-tenant-id="${tenantId}"] .master-data-table`);
        if (!masterDataTable) return {};

        const bankData = {};
        const mapping = { 
            'Kontoinhaber:': 'kontoinhaber', 
            'Bank:': 'bankname',  // KORRIGIERT: bankname statt bank
            'IBAN:': 'iban', 
            'BIC:': 'bic' 
        };

        Object.entries(mapping).forEach(([label, field]) => {
            const labelEl = Array.from(masterDataTable.querySelectorAll('.master-data-label'))
                .find(el => el.textContent.includes(label));
            if (labelEl?.nextElementSibling?.textContent?.trim() !== '-') {
                bankData[field] = labelEl.nextElementSibling.textContent.trim();
            }
        });

        return bankData.kontoinhaber ? bankData : { ...bankData, kontoinhaber: 'Sauer Immobilien GmbH' };
    } catch (error) {
        console.warn('Fehler beim DOM-Bankdaten-Extraktion:', error);
        return {};
    }
}

    hasValidBankData(bankData) {
        return !!(bankData?.iban || bankData?.bic || bankData?.bank || bankData?.bankname);
    }

createEmailData(tenant) {
    const data = this.getTenantDataFromDOM(tenant);
    const bankData = this.getBankData(tenant);
    const userData = window.userManager?.getUserData?.() || {};
    const paymentDeadline = Utils.getPaymentDeadline?.(14) || 'In 14 Tagen';

    const subject = `${data.fullAddress}, ${this.cleanName(tenant.name)}, ${data.mahnstufeName} - ${tenant.id}`;
    const userContact = `${userData.email ? `\n${userData.email}` : ''}${userData.phone ? `\n${userData.phone}` : ''}`;

    // *** FIX: Anrede-Komma-Problem beheben ***
    const cleanAnrede = this.fixCommaIssues(data.anrede);

    // *** KORRIGIERT: Unterschiedliche Texte für Zahlungserinnerung vs. Mahnung ***
    const isZahlungserinnerung = data.mahnstufe === 'E';
    const betragBezeichnung = isZahlungserinnerung ? 'Offener Betrag' : 'Schuldsumme';
    const gesamtBezeichnung = isZahlungserinnerung ? 'Zu zahlender Betrag' : 'Gesamtbetrag';

    const body = `${cleanAnrede},

anbei erhalten Sie die ${data.mahnstufeName} für die Immobilie ${data.fullAddress} (Mieternummer: ${tenant.id}).

Mieter: ${tenant.name}
Dokument: ${data.mahnstufeName}
${betragBezeichnung}: ${Utils.formatAmount(data.schuldbetrag)} EUR${!isZahlungserinnerung && data.mahngebuehr > 0 ? `
Mahngebühr: ${Utils.formatAmount(data.mahngebuehr)} EUR` : ''}
${gesamtBezeichnung}: ${Utils.formatAmount(data.gesamtbetrag)} EUR


ÜBERWEISUNGSDATEN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Kontoinhaber: ${bankData.kontoinhaber}   |   Bank: ${bankData.bankname}
IBAN: ${bankData.iban}   |   BIC: ${bankData.bic}
Überweisungsbetrag: ${Utils.formatAmount(data.gesamtbetrag)} EUR
Verwendungszweck: ${data.verwendungszweck}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bitte überweisen Sie den ${isZahlungserinnerung ? 'offenen Betrag' : 'Gesamtbetrag'} von ${Utils.formatAmount(data.gesamtbetrag)} EUR bis zum ${paymentDeadline} mit dem obengenannten Verwendungszweck.

${isZahlungserinnerung ? 
    '' : 
    'Da bereits eine Zahlungserinnerung erfolgte, wird bei weiterer Nichtzahlung die nächste Mahnstufe eingeleitet.'}

Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
${userData.name || 'Sauer Immobilien GmbH'}
Königstr. 25-27
90402 Nürnberg${userContact}
Tel.: 0911 / 21491-90
E-Mail: hausverwaltung@sauer-immobilien.de


---
Diese E-Mail ist ausschließlich für den Empfänger bestimmt. Sie kann vertrauliche und/oder rechtlich geschützte Informationen enthalten. Falls Sie nicht der beabsichtigte Empfänger sind oder diese E-Mail irrtümlich erhalten haben, informieren Sie bitte sofort den Absender und vernichten Sie diese E-Mail. Das unerlaubte Kopieren sowie die unbefugte Weiterleitung dieser E-Mail sind nicht gestattet.`;

      return { 
        to: tenant.email01 || tenant.email || '', 
        cc: tenant.email02 || '',  // NEU: CC hinzugefügt
        subject, 
        body 
    };
}

// *** NEUE HILFSFUNKTION: Komma-Probleme beheben ***
fixCommaIssues(text) {
    if (!text) return text;
    
    // Entferne mehrfache Kommas und ersetze sie durch ein einzelnes Komma
    let cleanText = text
        .replace(/,{2,}/g, ',')           // Mehrfache Kommas durch ein Komma ersetzen
        .replace(/,\s*,/g, ',')          // "Komma Leerzeichen Komma" durch ein Komma ersetzen
        .replace(/\s*,\s*/g, ', ')       // Normalisiere Leerzeichen um Kommas
        .trim();                         // Entferne führende/nachfolgende Leerzeichen
    
    // Stelle sicher, dass die Anrede NICHT mit einem Komma endet (wird später hinzugefügt)
    if (cleanText.endsWith(',')) {
        cleanText = cleanText.slice(0, -1).trim();
    }
    
    return cleanText;
}

// *** AUCH IN getPersonalAnrede() anwenden ***
getPersonalAnrede(tenant) {
    const customAnrede = window.app?.tenantManager?.getTenantAnrede?.(tenant.id);
    if (customAnrede) return this.fixCommaIssues(customAnrede);
    if (tenant.anrede) return this.fixCommaIssues(tenant.anrede);

    const name = (tenant.name || '').toLowerCase();
    if (name.includes('frau')) return 'Sehr geehrte Frau';
    if (name.includes('herr')) return 'Sehr geehrter Herr';
    return 'Sehr geehrte Damen und Herren';
}

// *** ZUSÄTZLICH: Auch cleanName() verbessern ***
cleanName(name) {
    if (!name) return 'Unbekannter Mieter';
    
    let cleanName = name.trim()
        .replace(/^(Herr|Frau|Hr\.|Fr\.|Mr\.|Mrs\.|Ms\.)\s+/i, '')
        .replace(/\s+/g, ' ')
        .replace(/,{2,}/g, ',')          // Auch hier mehrfache Kommas entfernen
        .replace(/,\s*,/g, ',');
    
    if (cleanName.length > 25) {
        const parts = cleanName.split(' ');
        cleanName = parts.length > 1 ? parts[parts.length - 1] : cleanName.substring(0, 22) + '...';
    }
    
    return cleanName;
}

    cleanName(name) {
        if (!name) return 'Unbekannter Mieter';
        let cleanName = name.trim().replace(/^(Herr|Frau|Hr\.|Fr\.|Mr\.|Mrs\.|Ms\.)\s+/i, '').replace(/\s+/g, ' ');
        if (cleanName.length > 25) {
            const parts = cleanName.split(' ');
            cleanName = parts.length > 1 ? parts[parts.length - 1] : cleanName.substring(0, 22) + '...';
        }
        return cleanName;
    }

    formatIBAN(iban) {
        if (!iban) return '';
        return iban.replace(/\s/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
    }

buildMailtoUrl(emailData) {
    const params = new URLSearchParams();
    
    // GEÄNDERT: Auch für Browser-E-Mail Plus-Zeichen korrigieren
    if (emailData.subject) params.append('subject', this.fixPlusToSpaces(emailData.subject));
    if (emailData.body) params.append('body', this.fixPlusToSpaces(emailData.body));
    if (emailData.cc) params.append('cc', emailData.cc);
    
    let url = 'mailto:';
    if (emailData.to) url += encodeURIComponent(emailData.to);
    
    const paramString = params.toString();
    if (paramString) url += '?' + paramString;
    
    return url;
}

    destroy() {
        const modal = document.getElementById('mailsend-action-modal');
        if (modal) modal.remove();
    }
}

window.mailSend = new MailSend();