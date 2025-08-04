class StatisticsManager {
    constructor(app) {
        this.app = app;
        this.currentStatistics = null;
        this.updateTimeout = null;
        this.isInitialized = false;
        this.autoUpdate = true;
        this.updateDelay = 300;
        this.eventListeners = new Map();

        this.portfolioChart = null;

        this.init();
    }

    init() {
        if (this.isInitialized) return;

        try {
            this.setupEventListeners();
            this.hideStatisticsSection();
            this.isInitialized = true;

        } catch (error) {
            console.error('Fehler bei der StatisticsManager-Initialisierung:', error);
        }
    }

    showAllTenants() {
        console.log('👁️ Zeige alle Mieter an...');

        if (!this.app || !this.app.tenantManager) {
            console.error('App oder TenantManager nicht verfügbar');
            return;
        }

        try {

            const allTenants = this.app.tenantManager.getAllTenants();
            console.log(`📊 Zeige alle ${allTenants.length} Mieter an`);

            const allTenantsMap = new Map();
            allTenants.forEach(tenant => {
                allTenantsMap.set(tenant.id, tenant);
            });

            this.app.uiRenderer.renderTenantList(allTenantsMap);
            this.app.updateSummaryThrottled();

            this.highlightActiveFilter('show-all-tenants');
            this.showFilterNotification(`Alle ${allTenants.length} Mieter werden angezeigt`);

            this.currentFilter = 'all';

        } catch (error) {
            console.error('Fehler beim Anzeigen aller Mieter:', error);
        }
    }

    setupEventListeners() {

        this.addEventListener(document, 'click', (e) => {

            if (e.target.closest('#portfolioToggleHeader')) {
                console.log('Portfolio Toggle geklickt!'); 
                this.togglePortfolioDetails();
                return; 
            }

            if (e.target.closest('#portfolioTableView')) {
                this.showPortfolioTableView();
                return;
            }

            if (e.target.closest('#portfolioChartView')) {
                this.showPortfolioChartView();
                return;
            }

            if (e.target.closest('.stat-card.open-tenants')) {
                e.preventDefault();
                this.filterTenantsWithDebt();
                return;
            }

            if (e.target.closest('.stat-card.credit-tenants')) {
                e.preventDefault();
                this.filterTenantsWithCredit();
                return;
            }

            if (e.target.closest('.stat-card.show-all-tenants')) {
                e.preventDefault();
                this.showAllTenants();
                return;
            }
        });

        this.addEventListener(document, 'csvDataLoaded', () => {
            this.updateStatisticsDelayed();
        });
        this.addEventListener(document, 'tenantSelectionChanged', () => {
            this.updateStatisticsDelayed();
        });
        this.addEventListener(document, 'filtersChanged', () => {
            this.updateStatisticsDelayed();
        });
        this.addEventListener(document, 'costPositionToggled', () => {
            this.updateStatisticsDelayed();
        });
        this.addEventListener(document, 'appReset', () => {
            this.resetStatistics();
        });

        this.monitorAppEvents();
    }
    filterTenantsWithDebt() {
        console.log('🔍 Filtere Mieter mit Schulden...');

        if (!this.app || !this.app.tenantManager) {
            console.error('App oder TenantManager nicht verfügbar');
            return;
        }

        try {

            const allTenants = this.app.tenantManager.getAllTenants();

            const tenantsWithDebt = allTenants.filter(tenant => {
                const totalDifference = this.app.tenantManager.calculateTenantTotal(tenant);
                return totalDifference < 0;
            });

            console.log(`📊 ${tenantsWithDebt.length} von ${allTenants.length} Mietern haben Schulden`);

            const filteredMap = new Map();
            tenantsWithDebt.forEach(tenant => {
                filteredMap.set(tenant.id, tenant);
            });

            this.app.uiRenderer.renderTenantList(filteredMap);
            this.app.updateSummaryThrottled();

            this.highlightActiveFilter('open-tenants');
            this.showFilterNotification(`${tenantsWithDebt.length} Mieter mit Schulden angezeigt`);

            this.currentFilter = 'debt';

        } catch (error) {
            console.error('Fehler beim Filtern der Mieter mit Schulden:', error);
        }
    }

    filterTenantsWithCredit() {
        console.log('🔍 Filtere Mieter mit Guthaben...');

        if (!this.app || !this.app.tenantManager) {
            console.error('App oder TenantManager nicht verfügbar');
            return;
        }

        try {

            const allTenants = this.app.tenantManager.getAllTenants();

            const tenantsWithCredit = allTenants.filter(tenant => {
                const totalDifference = this.app.tenantManager.calculateTenantTotal(tenant);
                return totalDifference > 0;
            });

            console.log(`📊 ${tenantsWithCredit.length} von ${allTenants.length} Mietern haben Guthaben`);

            const filteredMap = new Map();
            tenantsWithCredit.forEach(tenant => {
                filteredMap.set(tenant.id, tenant);
            });

            this.app.uiRenderer.renderTenantList(filteredMap);
            this.app.updateSummaryThrottled();

            this.highlightActiveFilter('credit-tenants');
            this.showFilterNotification(`${tenantsWithCredit.length} Mieter mit Guthaben angezeigt`);

            this.currentFilter = 'credit';

        } catch (error) {
            console.error('Fehler beim Filtern der Mieter mit Guthaben:', error);
        }
    }

    resetTenantFilters() {
        console.log('🔄 Setze Mieter-Filter zurück...');

        if (!this.app) return;

        try {

            this.app.renderCurrentView();

            this.removeFilterHighlights();

            this.currentFilter = null;

            this.showFilterNotification('Alle Mieter werden angezeigt');

        } catch (error) {
            console.error('Fehler beim Zurücksetzen der Filter:', error);
        }
    }

    showAllTenants() {
        console.log('👁️ Zeige alle Mieter an...');

        if (!this.app || !this.app.tenantManager) {
            console.error('App oder TenantManager nicht verfügbar');
            return;
        }

        try {

            const allTenants = this.app.tenantManager.getAllTenants();
            console.log(`📊 Zeige alle ${allTenants.length} Mieter an`);

            const allTenantsMap = new Map();
            allTenants.forEach(tenant => {
                allTenantsMap.set(tenant.id, tenant);
            });

            this.app.uiRenderer.renderTenantList(allTenantsMap);
            this.app.updateSummaryThrottled();

            this.highlightActiveFilter('show-all-tenants');
            this.showFilterNotification(`Alle ${allTenants.length} Mieter werden angezeigt`);

            this.currentFilter = 'all';

        } catch (error) {
            console.error('Fehler beim Anzeigen aller Mieter:', error);
        }
    }

 highlightActiveFilter(cardClass) {
    this.removeFilterHighlights();

    const card = document.querySelector(`.stat-card.${cardClass}`);
    if (card) {
        card.classList.add('filter-active');
        card.style.boxShadow = 'rgba(76, 79, 81, 0.4) 0px 4px 12px';
        card.style.transform = 'translateY(-15px)';
        card.style.transition = 'all 0.3s ease';
    }
}

    removeFilterHighlights() {
        const allCards = document.querySelectorAll('.stat-card');
        allCards.forEach(card => {
            card.classList.remove('filter-active');
            card.style.boxShadow = '';
            card.style.transform = '';
        });
    }

    showFilterNotification(message) {
        if (typeof Utils !== 'undefined' && Utils.showNotification) {
            Utils.showNotification(message, 'info');
        } else {
            console.log(`📊 ${message}`);
        }
    }

    togglePortfolioDetails() {
        console.log('togglePortfolioDetails aufgerufen'); 

        const content = document.getElementById('portfolioDetailContent');
        const icon = document.getElementById('portfolioToggleIcon');

        console.log('Content gefunden:', !!content); 
        console.log('Icon gefunden:', !!icon); 

        if (content && icon) {
            const isExpanded = content.classList.contains('expanded');

            if (isExpanded) {

                content.classList.remove('expanded');
                icon.classList.remove('rotated');
                console.log('Portfolio Details ausgeblendet');
            } else {

                content.classList.add('expanded');
                icon.classList.add('rotated');
                console.log('Portfolio Details eingeblendet');
            }
        } else {
            console.error('Portfolio Elemente nicht gefunden!', {
                content: !!content,
                icon: !!icon
            });
        }
    }
    updatePortfolioSummary(portfolioStats) {
        const summary = document.getElementById('portfolioSummary');
        if (summary && portfolioStats) {
            const total = portfolioStats.reduce((sum, p) => sum + p.totalAmount, 0);
            summary.textContent = `(${portfolioStats.length} Portfolios • ${AppUtils.formatCurrency(total)})`;
        }
    }
    addEventListener(target, event, handler) {
        const key = `${target.constructor.name}-${event}`;
        if (!this.eventListeners.has(key)) {
            this.eventListeners.set(key, []);
        }

        this.eventListeners.get(key).push({ target, event, handler });
        target.addEventListener(event, handler);
    }

    monitorAppEvents() {
        let lastTenantCount = 0;
        let lastDebtAmount = 0;

        setInterval(() => {
            if (!this.app || !this.app.tenantManager) return;

            try {
                const tenants = this.app.tenantManager.getAllTenants();
                const tenantsWithDebt = this.app.tenantManager.getTenantsWithDebt();

                const currentTenantCount = tenants.length;
                const currentDebtAmount = tenantsWithDebt.reduce((sum, t) => sum + (t.totalDifference || 0), 0);

                if (currentTenantCount !== lastTenantCount ||
                    Math.abs(currentDebtAmount - lastDebtAmount) > 0.01) {

                    lastTenantCount = currentTenantCount;
                    lastDebtAmount = currentDebtAmount;

                    if (currentTenantCount > 0) {
                        this.updateStatisticsDelayed();
                    }
                }
            } catch (error) {

            }
        }, 2000);
    }

    updateStatisticsDelayed(delay = this.updateDelay) {
        if (!this.autoUpdate) return;

        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        this.updateTimeout = setTimeout(() => {
            this.updateStatistics();
        }, delay);
    }

    updateStatistics() {
        if (!this.app || !this.app.tenantManager) return;

        try {
            const tenants = this.app.tenantManager.getAllTenants();

            if (tenants.length === 0) {
                this.hideStatisticsSection();
                return;
            }

            const statistics = this.calculateStatistics();
            this.updateStatisticsDisplay(statistics);
            this.showStatisticsSection();

        } catch (error) {
            console.error('Fehler beim Aktualisieren der Statistiken:', error);
        }
    }

calculateStatistics() {
    console.log('=== STATISTIK BERECHNUNG MIT PORTFOLIOS ===');
    if (!this.app || !this.app.tenantManager) {
        console.log('❌ App oder TenantManager fehlt');
        return this.getEmptyStatistics();
    }
    try {
        const tenantManagerStats = this.app.tenantManager.getStatistics();

        const filteredTenants = this.app.tenantManager.getFilteredTenants();
        console.log(`Verwende ${filteredTenants.length} gefilterte Mieter für Berechnung`);
        let portfolioStats = [];
        if (tenantManagerStats.portfolioStats) {
            portfolioStats = tenantManagerStats.portfolioStats;
        } else {
            portfolioStats = this.calculatePortfolioStatsFromAllTenants(filteredTenants);
        }
        const totalDebtAmount = portfolioStats.reduce((sum, portfolio) => sum + portfolio.totalAmount, 0);

        const { openTenantsCount, creditTenantsCount, totalCreditAmount } = this.calculateTenantsWithNettoStatus(filteredTenants);

        const totalOpenPositions = this.calculateTotalOpenPositions(filteredTenants);
        console.log('Berechnete Werte:', {
            totalOpenPositions,
            totalDebtAmount,
            totalCreditAmount, 
            openTenantsCount,
            creditTenantsCount,
            portfoliosCount: portfolioStats.length,
            totalFilteredTenants: filteredTenants.length
        });
        this.currentStatistics = {
            totalOpenPositions,
            totalDebtAmount,
            totalCreditAmount, 
            openTenantsCount,
            creditTenantsCount,
            portfolioStats,
            lastUpdated: new Date()
        };
        return this.currentStatistics;
    } catch (error) {
        console.error('Fehler beim Berechnen der Statistiken:', error);
        return this.getEmptyStatistics();
    }
}

calculateTenantsWithNettoStatus(allTenants) {
    let mieterMitSchulden = 0;
    let mieterMitGuthaben = 0;
    let mieterOhneRecords = 0;
    let totalCreditAmount = 0;

    allTenants.forEach(tenant => {
        let mieterSchulden = 0;
        let mieterGuthabenBetrag = 0;
        let hasActiveRecords = false;

        if (tenant.records && Array.isArray(tenant.records)) {
            tenant.records.forEach(record => {
                if (record.enabled && record.differenz) {
                    hasActiveRecords = true;
                    const diff = parseFloat(
                        (record.differenz || '0')
                            .replace(',', '.')
                            .replace(/[^\d.-]/g, '')
                    ) || 0;

                    if (diff < 0) {
                        mieterSchulden += Math.abs(diff);
                    } else if (diff > 0) {
                        mieterGuthabenBetrag += diff;
                    }
                }
            });
        }

        if (!hasActiveRecords) {
            mieterOhneRecords++;
        } else {
            const nettoSaldo = mieterSchulden - mieterGuthabenBetrag;

            if (nettoSaldo > 0) { 
                mieterMitSchulden++;
            } else {
                mieterMitGuthaben++;

                if (mieterGuthabenBetrag > mieterSchulden) {
                    totalCreditAmount += (mieterGuthabenBetrag - mieterSchulden);
                }
            }
        }
    });

    console.log(`📊 Mieter-Status: ${mieterMitSchulden} mit Schulden, ${mieterMitGuthaben} mit Guthaben/Null-Saldo, ${mieterOhneRecords} ohne aktive Records`);

    return {
        openTenantsCount: mieterMitSchulden,
        creditTenantsCount: mieterMitGuthaben,
        totalCreditAmount
    };
}
    calculateCorrectDebtAmount(allTenants) {
        let totalNettoDebtAmount = 0;
        let openTenantsCount = 0;

        allTenants.forEach(tenant => {
            let mieterSchulden = 0;
            let mieterGuthaben = 0;

            if (tenant.records && Array.isArray(tenant.records)) {
                tenant.records.forEach(record => {
                    if (record.enabled && record.differenz) {
                        const diff = parseFloat(
                            (record.differenz || '0')
                                .replace(',', '.')
                                .replace(/[^\d.-]/g, '')
                        ) || 0;

                        if (diff < 0) {
                            mieterSchulden += Math.abs(diff);
                        } else if (diff > 0) {
                            mieterGuthaben += diff;
                        }
                    }
                });
            }

            const nettoSaldo = mieterSchulden - mieterGuthaben;

            if (nettoSaldo > 0) {
                totalNettoDebtAmount += nettoSaldo;
                openTenantsCount++;
            }
        });

        console.log(`Korrekte Berechnung: ${totalNettoDebtAmount.toFixed(2)}€ von ${openTenantsCount} Mietern`);

        return {
            totalNettoDebtAmount,
            openTenantsCount
        };
    }

  calculatePortfolioStatsFromAllTenants(allTenants) {
    const portfolioMap = new Map();

    allTenants.forEach(tenant => {
        const portfolio = tenant.portfolio || tenant.portfolioname || 'Unbekannt';

        if (!portfolioMap.has(portfolio)) {
            portfolioMap.set(portfolio, {
                name: portfolio,
                tenantCount: 0,
                totalSchulden: 0,
                totalGuthaben: 0,
                nettoAmount: 0
            });
        }

        let mieterSchulden = 0;
        let mieterGuthaben = 0;

        if (tenant.records && Array.isArray(tenant.records)) {
            tenant.records.forEach(record => {
                if (record.enabled && record.differenz) {
                    const diff = parseFloat(
                        (record.differenz || '0')
                            .replace(',', '.')
                            .replace(/[^\d.-]/g, '')
                    ) || 0;

                    if (diff < 0) {
                        mieterSchulden += Math.abs(diff);
                    } else if (diff > 0) {
                        mieterGuthaben += diff;
                    }
                }
            });
        }

        const stats = portfolioMap.get(portfolio);

        const nettoSaldo = mieterSchulden - mieterGuthaben;

        if (nettoSaldo > 0.01) { 
            stats.tenantCount++;
            stats.totalSchulden += nettoSaldo; 
            stats.nettoAmount = stats.totalSchulden;
            stats.totalAmount = stats.totalSchulden;
        }

    });

    const result = Array.from(portfolioMap.values())
        .filter(stats => stats.totalAmount > 0)
        .sort((a, b) => b.totalAmount - a.totalAmount);

    return result;
}

    calculateTotalOpenPositions(tenants) {
        let totalPositions = 0;

        tenants.forEach(tenant => {
            if (tenant.records && Array.isArray(tenant.records)) {
                tenant.records.forEach(record => {
                    if (record.enabled && record.differenz) {
                        const diff = parseFloat(
                            (record.differenz || '0')
                                .replace(',', '.')
                                .replace(/[^\d.-]/g, '')
                        ) || 0;

                        if (diff < 0) {
                            totalPositions++;
                        }
                    }
                });
            }
        });

        console.log('📈 Gesamte offene Posten:', totalPositions);
        return totalPositions;
    }

updateStatisticsDisplay(statistics = null) {
    const stats = statistics || this.currentStatistics;
    if (!stats) return;
    try {
        const filteredTenantsCount = this.getFilteredTenantsCount();

        AppUtils.setStatisticValue('allTenantsCount', filteredTenantsCount.toLocaleString('de-DE'));
        AppUtils.setStatisticValue('totalOpenPositions', stats.totalOpenPositions.toLocaleString('de-DE'));
        AppUtils.setStatisticValue('totalDebtAmount', AppUtils.formatCurrency(stats.totalDebtAmount));
        AppUtils.setStatisticValue('totalCreditAmount', AppUtils.formatCurrency(stats.totalCreditAmount)); 
        AppUtils.setStatisticValue('openTenantsCount', stats.openTenantsCount.toLocaleString('de-DE'));
        AppUtils.setStatisticValue('creditTenantsCount', stats.creditTenantsCount.toLocaleString('de-DE'));
        this.updatePortfolioBreakdown(stats.portfolioStats);
        this.updateFilterLabels();

    } catch (error) {
        console.error('Fehler beim Aktualisieren der Statistik-Anzeige:', error);
    }
}

getFilteredTenantsCount() {
    if (!this.app || !this.app.tenantManager) return 0;

    const filteredTenants = this.app.tenantManager.getFilteredTenants();
    return filteredTenants.length;
}

updateFilterLabels() {
    const portfolioFilter = document.getElementById('portfolioFilter')?.value || 'ALL';
    const anwaltFilter = document.getElementById('anwaltFilter')?.value || 'ALL';
    const searchInput = document.getElementById('searchInput')?.value || '';

    let filterInfo = [];

    if (portfolioFilter !== 'ALL') {
        filterInfo.push(`Portfolio: ${portfolioFilter}`);
    }

    if (anwaltFilter === 'WITH_ANWALT') {
        filterInfo.push('Mit Anwalt');
    } else if (anwaltFilter === 'WITHOUT_ANWALT') {
        filterInfo.push('Ohne Anwalt');
    }

    if (searchInput.trim()) {
        filterInfo.push(`Suche: "${searchInput.substring(0, 20)}${searchInput.length > 20 ? '...' : ''}"`);
    }

    const filterText = filterInfo.length > 0
        ? `<br><small style="font-size: 0.75em; color: #6c757d;">${filterInfo.join(' • ')}</small>`
        : `<br><small style="font-size: 0.75em; color: #6c757d;">keine Filter gesetzt</small>`;

    document.querySelector('.stat-card.show-all-tenants .stat-label').innerHTML = 'Alle Mieter' + (this.currentFilter === 'all' ? ' (aktiv)' : '') + filterText;
    document.querySelector('.stat-card.open-tenants .stat-label').innerHTML = 'Mieter mit Schulden' + (this.currentFilter === 'debt' ? ' (aktiv)' : '') + filterText;
    document.querySelector('.stat-card.credit-tenants .stat-label').innerHTML = 'Mieter mit Guthaben' + (this.currentFilter === 'credit' ? ' (aktiv)' : '') + filterText;
    document.querySelector('.stat-card.total-amount .stat-label').innerHTML = 'Forderungen' + filterText;
    document.querySelector('.stat-card.total-credit .stat-label').innerHTML = 'Guthaben' + filterText; 
}

    updatePortfolioBreakdown(portfolioStats) {
        const container = document.getElementById('portfolioBreakdown');
        if (!container) return;

        this.updatePortfolioSummary(portfolioStats);

        if (portfolioStats.length === 0) {
            container.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">Keine Portfolios mit Schulden</p>';
            return;
        }

        const html = portfolioStats.map(portfolio => `
        <div class="portfolio-item">
            <div class="portfolio-name">${AppUtils.escapeHtml(portfolio.name)}</div>
            <div class="portfolio-stats">
                <span class="portfolio-count">${portfolio.tenantCount} Mieter</span>
                <span class="portfolio-amount">${AppUtils.formatCurrency(portfolio.totalAmount)}</span>
            </div>
        </div>
    `).join('');

        container.innerHTML = html;

        const chartContainer = document.getElementById('portfolioChartContainer');
        if (chartContainer && chartContainer.style.display !== 'none') {
            this.createPortfolioChart();
        }

        if (!this.portfolioChart && portfolioStats.length > 0) {
            setTimeout(() => {
                this.createPortfolioChart();
            }, 100);
        }
    }

    showPortfolioTableView() {
        const tableView = document.getElementById('portfolioBreakdown');
        const chartView = document.getElementById('portfolioChartContainer');
        const tableBtn = document.getElementById('portfolioTableView');
        const chartBtn = document.getElementById('portfolioChartView');

        if (tableView) tableView.style.display = 'block';
        if (chartView) chartView.style.display = 'none';
        if (tableBtn) tableBtn.classList.add('active');
        if (chartBtn) chartBtn.classList.remove('active');
    }

    showPortfolioChartView() {
        const tableView = document.getElementById('portfolioBreakdown');
        const chartView = document.getElementById('portfolioChartContainer');
        const tableBtn = document.getElementById('portfolioTableView');
        const chartBtn = document.getElementById('portfolioChartView');

        if (tableView) tableView.style.display = 'none';
        if (chartView) chartView.style.display = 'flex';
        if (tableBtn) tableBtn.classList.remove('active');
        if (chartBtn) chartBtn.classList.add('active');

        this.createPortfolioChart();
    }

createPortfolioChart() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js ist nicht verfügbar. Bitte Chart.js einbinden.');
        return;
    }

    if (!this.currentStatistics || !this.currentStatistics.portfolioStats) return;

    const canvas = document.getElementById('portfolioChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (this.portfolioChart) {
        this.portfolioChart.destroy();
    }

    const portfolioStats = this.currentStatistics.portfolioStats;
    if (portfolioStats.length === 0) return;

    const gedeckteFarben = [
        '#305883', '#4A6B94', '#3D6088', '#2A4F76', '#5C7BA8',
        '#243E65', '#4E7099', '#6B85B3', '#1F3454', '#4F729A'
    ];

    const totalAmount = portfolioStats.reduce((sum, p) => sum + p.totalAmount, 0);

    const config = {
        type: 'pie',
        data: {
            labels: portfolioStats.map(p => p.name),
            datasets: [{
                data: portfolioStats.map(p => p.totalAmount),
                backgroundColor: gedeckteFarben.slice(0, portfolioStats.length),
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#305883',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#ffffff',
                    borderWidth: 1,
                    callbacks: {
                        label: (context) => {
                            const portfolio = portfolioStats[context.dataIndex];
                            const percentage = ((portfolio.totalAmount / totalAmount) * 100).toFixed(1);
                            return `${portfolio.name}: ${AppUtils.formatCurrency(portfolio.totalAmount)} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                onComplete: () => {

                    this.drawLabelsOnChart(ctx, portfolioStats, totalAmount);
                }
            }
        }
    };

    this.portfolioChart = new Chart(ctx, config);
    this.createCustomLegend(portfolioStats, gedeckteFarben);
}

drawLabelsOnChart(ctx, portfolioStats, totalAmount) {
    const chart = this.portfolioChart;
    const centerX = chart.width / 2;
    const centerY = chart.height / 2;

    chart.data.datasets[0].data.forEach((value, index) => {
        const percentage = ((value / totalAmount) * 100);

        if (percentage > 5) {
            const meta = chart.getDatasetMeta(0);
            const arc = meta.data[index];

            const angle = (arc.startAngle + arc.endAngle) / 2;
            const radius = arc.outerRadius * 0.7; 

            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const portfolio = portfolioStats[index];
            const shortName = portfolio.name.length > 12 ? portfolio.name.substring(0, 10) + '..' : portfolio.name;

            ctx.fillText(`${shortName}`, x, y - 8);
            ctx.fillText(`${percentage.toFixed(0)}%`, x, y + 8);
        }
    });
}

    createCustomLegend(portfolioStats, colors) {
        const legendContainer = document.getElementById('chartLegend');
        if (!legendContainer) return;

        const totalAmount = portfolioStats.reduce((sum, p) => sum + p.totalAmount, 0);

        const legendHTML = portfolioStats.map((portfolio, index) => {
            const percentage = ((portfolio.totalAmount / totalAmount) * 100).toFixed(1);
            const color = colors[index] || '#305883';

            return `
        <div class="legend-item" style="border-left-color: ${color}">
            <div class="legend-color" style="background-color: ${color}"></div>
            <div class="legend-info">
                <div class="legend-name" title="${AppUtils.escapeHtml(portfolio.name)}">${AppUtils.escapeHtml(portfolio.name)}</div>
                <div class="legend-stats">
                    ${portfolio.tenantCount} Mieter • ${percentage}%
                </div>
               <div class="legend-amount negative-amount">-${AppUtils.formatCurrency(portfolio.totalAmount)}</div>
            </div>
        </div>
    `;
        }).join('');

        legendContainer.innerHTML = legendHTML;
    }

    showStatisticsSection() {
        AppUtils.showStatisticsSection();
    }

    hideStatisticsSection() {
        AppUtils.hideStatisticsSection();
    }

    resetStatistics() {
        this.currentStatistics = null;
        this.hideStatisticsSection();

        if (this.portfolioChart) {
            this.portfolioChart.destroy();
            this.portfolioChart = null;
        }

        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }
    }

getEmptyStatistics() {
    return {
        totalOpenPositions: 0,
        totalDebtAmount: 0,
        totalCreditAmount: 0, 
        openTenantsCount: 0,
        creditTenantsCount: 0,
        portfolioStats: []
    };
}

    exportStatistics() {
        try {
            const stats = this.currentStatistics;
            if (!stats) {
                AppUtils.showNotification('Keine Statistiken zum Exportieren verfügbar', 'warning');
                return;
            }

            const exportData = {
                ...stats,
                exportedAt: new Date().toISOString(),
                version: '1.0',
                source: 'Mahnmanager Web-App'
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mahnmanager-statistiken-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('Statistiken erfolgreich exportiert');

        } catch (error) {
            console.error('Fehler beim Exportieren:', error);
        }
    }

    removeAllEventListeners() {
        this.eventListeners.forEach(listeners => {
            listeners.forEach(({ target, event, handler }) => {
                target.removeEventListener(event, handler);
            });
        });
        this.eventListeners.clear();
    }

    destroy() {
        this.removeAllEventListeners();

        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        if (this.portfolioChart) {
            this.portfolioChart.destroy();
            this.portfolioChart = null;
        }

        this.currentStatistics = null;
        this.isInitialized = false;

        console.log('StatisticsManager wurde erfolgreich bereinigt');
    }

    getDebugInfo() {
        return {
            isInitialized: this.isInitialized,
            autoUpdate: this.autoUpdate,
            hasStatistics: !!this.currentStatistics,
            hasChart: !!this.portfolioChart,
            eventListenersCount: this.eventListeners.size,
            lastUpdate: this.currentStatistics?.lastUpdated,
            sectionVisible: AppUtils.isStatisticsSectionVisible()
        };
    }

    lightenColor(color, percent) {
        try {

            const num = parseInt(color.replace("#", ""), 16);
            const amt = Math.round(2.55 * percent);
            const R = (num >> 16) + amt;
            const G = (num >> 8 & 0x00FF) + amt;
            const B = (num & 0x0000FF) + amt;

            return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
        } catch (error) {
            return color;
        }
    }

}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatisticsManager;
}