class EventHandlers {
    constructor(app) {
        this.app = app;
        this.searchTimeout = null;
    }

    showLoadingScreen() {
        const loadingHtml = `
        <div class="loading-overlay" id="loadingOverlay">
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <h2 class="loading-title">CSV-Datei wird verarbeitet</h2>
                <p class="loading-subtitle">Bitte warten Sie, während Ihre Daten importiert und aufbereitet werden...</p>

                <ul class="loading-steps">
                    <li class="loading-step active" id="step-reading">
                        <span class="loading-step-icon">1</span>
                        <span>Datei wird gelesen...</span>
                    </li>
                    <li class="loading-step" id="step-parsing">
                        <span class="loading-step-icon">2</span>
                        <span>CSV-Daten werden analysiert...</span>
                    </li>
                    <li class="loading-step" id="step-validation">
                        <span class="loading-step-icon">3</span>
                        <span>Daten werden validiert...</span>
                    </li>
                    <li class="loading-step" id="step-processing">
                        <span class="loading-step-icon">4</span>
                        <span>Mieter-Informationen werden verarbeitet...</span>
                    </li>
                    <li class="loading-step" id="step-rendering">
                        <span class="loading-step-icon">5</span>
                        <span>Benutzeroberfläche wird aufgebaut...</span>
                    </li>
                </ul>

                <div class="loading-progress-bar">
                    <div class="loading-progress-fill" id="loadingProgress"></div>
                </div>
            </div>
        </div>
    `;

        document.body.insertAdjacentHTML('beforeend', loadingHtml);

        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.classList.add('processing');
        }
    }

    updateLoadingStep(stepId, progress = null) {
        const steps = {
            'reading': { id: 'step-reading', progress: 20 },
            'parsing': { id: 'step-parsing', progress: 40 },
            'validation': { id: 'step-validation', progress: 60 },
            'processing': { id: 'step-processing', progress: 80 },
            'rendering': { id: 'step-rendering', progress: 100 }
        };

        const stepInfo = steps[stepId];
        if (!stepInfo) return;

        const stepIds = Object.keys(steps);
        const currentIndex = stepIds.indexOf(stepId);

        stepIds.forEach((id, index) => {
            const stepElement = document.getElementById(steps[id].id);
            if (!stepElement) return;

            stepElement.classList.remove('active');

            if (index < currentIndex) {
                stepElement.classList.add('completed');
                stepElement.querySelector('.loading-step-icon').innerHTML = '✓';
            } else if (index === currentIndex) {
                stepElement.classList.add('active');
            }
        });

        const progressBar = document.getElementById('loadingProgress');
        if (progressBar) {
            const targetProgress = progress !== null ? progress : stepInfo.progress;
            progressBar.style.width = `${targetProgress}%`;
        }

    }

    hideLoadingScreen(delay = 50) {
        return new Promise((resolve) => {
            this.updateLoadingStep('rendering');
            setTimeout(() => {
                const loadingOverlay = document.getElementById('loadingOverlay');
                if (loadingOverlay) {
                    loadingOverlay.style.opacity = '0';
                    loadingOverlay.style.transform = 'translateY(-20px)';
                    setTimeout(() => {
                        loadingOverlay.remove();
                        resolve();
                    }, 300); 
                } else {
                    resolve();
                }
                const uploadArea = document.getElementById('uploadArea');
                if (uploadArea) {
                    uploadArea.classList.remove('processing');
                }
            }, delay);
        });
    }

    async handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        console.log('📁 Datei ausgewählt:', file.name);

        const uploadArea = document.getElementById('uploadArea');
        const originalHTML = uploadArea?.innerHTML;

        if (uploadArea) {
            uploadArea.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="border: 3px solid #f3f3f3; border-top: 3px solid #3498db; 
                           border-radius: 50%; width: 30px; height: 30px; 
                           animation: spin 1s linear infinite; margin: 0 auto 10px;"></div>
                <p>Verarbeite ${file.name}...</p>
            </div>
        `;
        }

        try {
            await this.app.processFile(file);
            Utils.showNotification('CSV-Datei erfolgreich verarbeitet!', 'success');

        } catch (error) {
            console.error('Fehler beim Datei-Upload:', error);
            Utils.showNotification(`Fehler beim Verarbeiten der Datei: ${error.message}`, 'error');
        } finally {

            if (uploadArea && originalHTML) {
                uploadArea.innerHTML = originalHTML;
            }
        }
    }

    async handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');

        const files = Array.from(e.dataTransfer.files);
        const csvFile = files.find(file => file.name.toLowerCase().endsWith('.csv'));

        if (!csvFile) {
            Utils.showNotification('Bitte eine CSV-Datei auswählen', 'warning');
            return;
        }

        console.log('🎯 CSV-Datei per Drag & Drop:', csvFile.name);

        const uploadArea = e.currentTarget;
        uploadArea.style.opacity = '0.7';

        try {
            await this.app.processFile(csvFile);
            Utils.showNotification('CSV-Datei erfolgreich verarbeitet!', 'success');
        } catch (error) {
            console.error('Fehler beim Drag & Drop:', error);
            Utils.showNotification(`Fehler: ${error.message}`, 'error');
        } finally {
            uploadArea.style.opacity = '1';
        }
    }
    simulateDelay(ms) {
        const ultraFastMs = Math.round(ms * 0.02); 
        return new Promise(resolve => {
            setTimeout(resolve, ultraFastMs + Math.random() * 5);
        });
    }

    setupEventListeners() {

        this.setupUploadEvents();
        this.setupActionButtons();
        this.setupSearchEvents();
        this.setupBulkActions();
        this.setupKeyboardEvents();
        this.setupWindowEvents();
        this.setupPortfolioEvents();

        setTimeout(() => {
            this.forceSetupSearchEvents();
        }, 100);

    }

    forceSetupSearchEvents() {

        const searchInput = document.getElementById('searchInput');
        if (!searchInput) {
            console.error('❌ Suchfeld nicht gefunden');
            return;
        }

        const newInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newInput, searchInput);

        let searchTimeout = null;

        newInput.addEventListener('input', (e) => {
            const term = e.target.value;

            if (searchTimeout) clearTimeout(searchTimeout);

            searchTimeout = setTimeout(() => {
                this.app.handleSearch(term);
            }, 300);
        });

        newInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const term = e.target.value;

                if (searchTimeout) clearTimeout(searchTimeout);
                this.app.handleSearch(term);
            }
        });

    }

setupPortfolioEvents() {
    document.addEventListener('change', (e) => {
        if (e.target.id === 'portfolioFilter') {
            console.log('Portfolio-Filter Event:', e.target.value);
            this.app.handlePortfolioFilter(e.target.value);
        }
        if (e.target.id === 'anwaltFilter') {
            this.app.handleAnwaltFilter(e.target.value);
        }
    });

    document.addEventListener('input', (e) => {
        if (e.target.id === 'schuldenFilter') {
            console.log('Schulden-Filter Event:', e.target.value);

            if (this.schuldenTimeout) {
                clearTimeout(this.schuldenTimeout);
            }
            if (this.formatTimeout) {
                clearTimeout(this.formatTimeout);
            }

            this.schuldenTimeout = setTimeout(() => {
                this.app.handleSchuldenFilter(e.target.value);
            }, 1500);

            this.formatTimeout = setTimeout(() => {
                this.formatSchuldenInputOnBlur(e.target);
            }, 1500);
        }
    });

    document.addEventListener('blur', (e) => {
        if (e.target.id === 'schuldenFilter') {

            if (this.formatTimeout) {
                clearTimeout(this.formatTimeout);
            }
            this.formatSchuldenInputOnBlur(e.target);
        }
    }, true);

    document.addEventListener('keydown', (e) => {
        if (e.target.id === 'schuldenFilter' && e.key === 'Enter') {

            if (this.schuldenTimeout) {
                clearTimeout(this.schuldenTimeout);
            }
            if (this.formatTimeout) {
                clearTimeout(this.formatTimeout);
            }

            this.formatSchuldenInputOnBlur(e.target);
            this.app.handleSchuldenFilter(e.target.value);
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.dataset.portfolioAction) {
            const action = e.target.dataset.portfolioAction;
            const portfolio = e.target.dataset.portfolio;
            switch (action) {
                case 'selectAll':
                    this.app.selectAllInPortfolio(portfolio);
                    break;
                case 'deselectAll':
                    this.app.deselectAllInPortfolio(portfolio);
                    break;
                case 'generateAll':
                    this.app.generateAllInvoicesForPortfolio(portfolio);
                    break;
            }
        }
    });
}

formatSchuldenInputOnBlur(input) {
    let value = input.value.replace(/[^\d,.-]/g, '').trim();
    
    if (value && value !== '') {
        let numValue;
        
        // Deutsche Eingabe-Logik: Unterscheide zwischen Dezimalkomma und Tausenderpunkt
        if (value.includes(',')) {
            // Hat Komma = Dezimaltrennzeichen
            // Entferne alle Punkte (Tausendertrennzeichen), ersetze Komma durch Punkt
            numValue = parseFloat(value.replace(/\./g, '').replace(',', '.'));
        } else if (value.includes('.')) {
            // Hat nur Punkt - prüfe ob Tausendertrennzeichen oder Dezimaltrennzeichen
            const parts = value.split('.');
            if (parts.length === 2 && parts[1].length <= 2) {
                // Wahrscheinlich Dezimaltrennzeichen (z.B. "3.50")
                numValue = parseFloat(value);
            } else {
                // Wahrscheinlich Tausendertrennzeichen (z.B. "3.500")
                numValue = parseFloat(value.replace(/\./g, ''));
            }
        } else {
            // Nur Zahlen ohne Trenner
            numValue = parseFloat(value);
        }
        
        if (!isNaN(numValue) && numValue > 0) {
            input.value = numValue.toLocaleString('de-DE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }) + ' €';
        } else if (numValue === 0) {
            input.value = '';
        }
    }
}

formatSchuldenInput(input) {
    let value = input.value;
    // Entferne alles außer Zahlen, Komma und Punkt
    value = value.replace(/[^\d,.-]/g, '');
    
    // Konvertiere Punkt zu Komma für deutsche Eingabe
    if (value.includes('.') && !value.includes(',')) {
        value = value.replace('.', ',');
    }
    
    const numValue = parseFloat(value.replace(',', '.')) || 0;
    
    if (numValue > 0) {
        const formatted = numValue.toLocaleString('de-DE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + ' €';
        
        if (input.value !== formatted) {
            const cursorPos = input.selectionStart;
            input.value = formatted;
            
            // Cursor-Position korrigieren
            let newPos = Math.min(cursorPos, formatted.length - 2);
            input.setSelectionRange(newPos, newPos);
        }
    }
}

parseSchuldenValue(formattedValue) {
    if (!formattedValue) return 0;
    
    // Entferne €-Symbol und Leerzeichen
    let cleanValue = formattedValue.replace(/€/g, '').replace(/\s/g, '');
    
    // Deutsche Formatierung: Punkt als Tausendertrennzeichen, Komma als Dezimaltrennzeichen
    // Entferne Tausenderpunkte, ersetze Komma durch Punkt für parseFloat
    cleanValue = cleanValue.replace(/\.(?=\d{3})/g, '').replace(',', '.');
    
    return parseFloat(cleanValue) || 0;
}

    setupSearchEvents() {

        setTimeout(() => {
            if (window.app && window.app.forceSetupSearchEventsDelayed) {
                window.app.forceSetupSearchEventsDelayed();
            }
        }, 100);

    }

    setupUploadEvents() {
        const uploadArea = document.getElementById('uploadArea');
        const csvFileInput = document.getElementById('csvFileInput');

        if (uploadArea) {
            uploadArea.addEventListener('dragover', this.handleDragOver);
            uploadArea.addEventListener('dragleave', this.handleDragLeave);
            uploadArea.addEventListener('drop', this.handleDrop.bind(this));
            uploadArea.addEventListener('click', () => csvFileInput?.click());
        }

        if (csvFileInput) {
            csvFileInput.addEventListener('change', this.handleFileSelect.bind(this));
        }
    }

    setupActionButtons() {

        const selectAllBtn = document.getElementById('selectAllBtn');
        const deselectAllBtn = document.getElementById('deselectAllBtn');
        const generateButton = document.getElementById('generateSelectedButton');

        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => window.app.selectAllTenants());
        }

        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => window.app.deselectAllTenants());
        }

        if (generateButton) {
            generateButton.addEventListener('click', () => window.app.generateSelectedInvoices());
        }

    }

    setupNewFilterEvents() {
        const portfolioFilter = document.getElementById('portfolioFilter');
        const anwaltFilter = document.getElementById('anwaltFilter');
        const schuldenFilter = document.getElementById('schuldenFilter');
        const searchInput = document.getElementById('searchInput');

        if (portfolioFilter) {
            portfolioFilter.addEventListener('change', (event) => {
                console.log('Portfolio-Filter:', event.target.value);
                this.app.handlePortfolioFilter(event.target.value);
            });
        }

        if (anwaltFilter) {
            anwaltFilter.addEventListener('change', (e) => {
                const filterValue = e.target.value;
                this.app.selectTenantsByAnwaltFilter(filterValue);
            });
        }

        if (schuldenFilter) {
            schuldenFilter.addEventListener('input', (e) => {
                if (this.schuldenTimeout) {
                    clearTimeout(this.schuldenTimeout);
                }
                this.schuldenTimeout = setTimeout(() => {
                    console.log('Schulden-Filter:', e.target.value);
                    this.app.handleSchuldenFilter(e.target.value);
                }, 500);
            });
        }

        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (event) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    console.log('Text-Suche:', event.target.value);
                    this.app.handleSearch(event.target.value);
                }, 300);
            });
        }

        const resetFiltersBtn = document.getElementById('resetFiltersBtn');
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => {
                this.app.resetAllFilters();
            });
        }
    }

    refreshAnwaltsEventListeners() {
        console.log('🔄 Erneuere Anwalts-Event-Listener...');

        this.setupNewFilterEvents();
    }

    setupBulkActions() {
        const selectAllBtn = document.getElementById('selectAllBtn');
        const deselectAllBtn = document.getElementById('deselectAllBtn');

        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.app.selectAllTenants());
        }

        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => this.app.deselectAllTenants());
        }
    }

    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'a':
                        if (this.app.isDataLoaded()) {
                            e.preventDefault();
                            this.app.selectAllTenants();
                        }
                        break;
                    case 'd':
                        if (this.app.isDataLoaded()) {
                            e.preventDefault();
                            this.app.deselectAllTenants();
                        }
                        break;
                    case 'Enter':
                        if (this.app.isDataLoaded()) {
                            e.preventDefault();
                            this.app.generateSelectedInvoices();
                        }
                        break;
                }
            }

            if (e.key === 'Escape') {
                const searchInput = document.getElementById('searchInput');
                if (searchInput && document.activeElement !== searchInput) {
                    searchInput.focus();
                }
            }
        });
    }

    setupWindowEvents() {
        window.addEventListener('beforeunload', (e) => {
            if (this.app.hasUnsavedChanges?.()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    refreshEventListeners() {
        console.log('🔄 Erneuere alle Event-Listener...');

        this.setupSearchEvents();
        this.setupBulkActions();
        this.setupActionButtons();

        this.refreshAnwaltsEventListeners();
    }

    setupDynamicEventListeners() {

        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('mahngebuehren-input')) {
                const tenantId = e.target.getAttribute('data-tenant-id');
                if (tenantId && mahnstufen?.handleMahngebuehrChange) {
                    mahnstufen.handleMahngebuehrChange(tenantId, e.target.value);
                }
            }
        });

        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('mahngebuehren-input')) {
                if (mahnstufen?.validateMahngebuehrInput) {
                    mahnstufen.validateMahngebuehrInput(e.target);
                }
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('reset-gebuehr-btn') ||
                e.target.closest('.reset-gebuehr-btn')) {

                const btn = e.target.closest('.reset-gebuehr-btn');
                const container = btn.closest('.mahngebuehren-input-container');
                const tenantId = container?.getAttribute('data-tenant-id');

                if (tenantId && mahnstufen?.resetMahngebuehrToDefault) {
                    mahnstufen.resetMahngebuehrToDefault(tenantId);
                }
            }
        });

        console.log('  Dynamische Event-Listener setup abgeschlossen');
    }

    handleTenantSelection(e) {
        const tenantId = e.target.dataset.tenantId;
        this.app.toggleTenantSelection(tenantId, e.target.checked);
    }

    handlePositionToggle(e) {
        const recordId = e.target.dataset.recordId;
        this.app.toggleCostPosition(recordId, e.target.checked);
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');

        const files = Array.from(e.dataTransfer.files);
        const csvFile = files.find(file => file.name.toLowerCase().endsWith('.csv'));

        if (csvFile) {
            this.app.processFile(csvFile);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.app.processFile(file);
        }
    }
}

window.EventHandlers = EventHandlers;