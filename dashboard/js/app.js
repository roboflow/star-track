const App = {
    currentPeriod: 30,
    currentFilterType: null,
    chartSelectedItems: [],
    sortConfig: {
        stars: { column: 'current', direction: 'desc' },
        downloads: { column: 'current', direction: 'desc' }
    },

    async init() {
        const loaded = await DataStore.loadData();
        if (!loaded) {
            console.error('Failed to load data');
            return;
        }

        this.loadTheme();
        Charts.init();
        this.setupEventListeners();
        this.render();
        this.renderRawData();
    },

    loadTheme() {
        const saved = localStorage.getItem('theme');
        if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
        this.updateThemeIcon();
    },

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme === 'dark' ? 'dark' : '');
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon();
    },

    updateThemeIcon() {
        const icon = document.getElementById('themeIcon');
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (icon) {
            icon.innerHTML = isDark 
                ? '<circle cx="8" cy="8" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M8 0v2M8 14v2M0 8h2M14 8h2M2.34 2.34l1.42 1.42M12.24 12.24l1.42 1.42M2.34 13.66l1.42-1.42M12.24 3.76l1.42-1.42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
                : '<path d="M12 3a6 6 0 11-6 6c0-3.31 2.69-6 6-6z" stroke="currentColor" stroke-width="1.5" fill="none"/>';
        }
    },

    setupEventListeners() {
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPeriod = parseInt(e.target.dataset.period);
                this.render();
            });
        });

        document.getElementById('generateReport').addEventListener('click', () => {
            this.showReportModal();
        });

        document.getElementById('closeModal').addEventListener('click', () => {
            this.hideModal('reportModal');
        });

        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
            });
        });

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
            });
        });

        document.getElementById('reportPeriod').addEventListener('change', (e) => {
            this.updateReportOutput(e.target.value);
        });

        document.getElementById('copyReport').addEventListener('click', () => {
            const reportText = document.getElementById('reportOutput').textContent;
            Report.copyToClipboard(reportText);
            const btn = document.getElementById('copyReport');
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy to Clipboard', 2000);
        });

        document.getElementById('filterStars').addEventListener('click', () => {
            this.showFilterModal('stars');
        });

        document.getElementById('filterDownloads').addEventListener('click', () => {
            this.showFilterModal('downloads');
        });

        document.getElementById('selectAll').addEventListener('click', () => {
            this.selectAllFilters(true);
        });

        document.getElementById('selectNone').addEventListener('click', () => {
            this.selectAllFilters(false);
        });

        document.getElementById('chartMetric').addEventListener('change', (e) => {
            Charts.updateTrendChart(e.target.value, this.currentPeriod);
        });

        document.querySelectorAll('#starsTable th[data-sort]').forEach(th => {
            th.addEventListener('click', () => this.handleSort('stars', th.dataset.sort));
        });

        document.querySelectorAll('#downloadsTable th[data-sort]').forEach(th => {
            th.addEventListener('click', () => this.handleSort('downloads', th.dataset.sort));
        });

        document.getElementById('toggleTheme').addEventListener('click', () => {
            this.toggleTheme();
        });

        document.getElementById('chartPeriod').addEventListener('change', (e) => {
            Charts.setChartPeriod(parseInt(e.target.value));
            Charts.updateTrendChart(document.getElementById('chartMetric').value, this.currentPeriod);
        });

        document.getElementById('selectChartItems').addEventListener('click', () => {
            this.showChartItemsModal();
        });

        document.getElementById('chartItemsReset').addEventListener('click', () => {
            this.chartSelectedItems = [];
            Charts.setSelectedItems([]);
            this.updateChartItemsCheckboxes();
        });

        document.getElementById('applyChartItems').addEventListener('click', () => {
            Charts.setSelectedItems(this.chartSelectedItems);
            Charts.updateTrendChart(document.getElementById('chartMetric').value, this.currentPeriod, 
                this.chartSelectedItems.length > 0 ? this.chartSelectedItems : null);
            this.hideModal('chartItemsModal');
        });

        document.getElementById('rawDataType').addEventListener('change', (e) => {
            this.renderRawData(e.target.value);
        });

        document.getElementById('selectRawColumns').addEventListener('click', () => {
            this.showRawColumnsModal();
        });

        document.getElementById('rawSelectAll').addEventListener('click', () => {
            this.selectAllRawColumns(true);
        });

        document.getElementById('rawSelectNone').addEventListener('click', () => {
            this.selectAllRawColumns(false);
        });

        document.getElementById('applyRawColumns').addEventListener('click', () => {
            this.applyRawColumns();
        });
    },

    handleSort(table, column) {
        const config = this.sortConfig[table];
        if (config.column === column) {
            config.direction = config.direction === 'asc' ? 'desc' : 'asc';
        } else {
            config.column = column;
            config.direction = 'desc';
        }
        this.render();
    },

    sortStats(stats, table) {
        const { column, direction } = this.sortConfig[table];
        const sorted = [...stats].sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];
            
            if (column === 'name') {
                aVal = (aVal || '').toLowerCase();
                bVal = (bVal || '').toLowerCase();
                return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            
            if (column === 'streak') {
                aVal = typeof aVal === 'object' ? aVal.value : Utils.streakToNumber(aVal);
                bVal = typeof bVal === 'object' ? bVal.value : Utils.streakToNumber(bVal);
            }
            
            aVal = aVal || 0;
            bVal = bVal || 0;
            return direction === 'asc' ? aVal - bVal : bVal - aVal;
        });
        return sorted;
    },

    updateSortIndicators(tableId, table) {
        const { column, direction } = this.sortConfig[table];
        document.querySelectorAll(`#${tableId} th`).forEach(th => {
            th.classList.remove('sorted');
            th.querySelector('.sort-indicator').textContent = '';
        });
        const activeTh = document.querySelector(`#${tableId} th[data-sort="${column}"]`);
        if (activeTh) {
            activeTh.classList.add('sorted');
            activeTh.querySelector('.sort-indicator').textContent = direction === 'asc' ? '↑' : '↓';
        }
    },

    render() {
        this.renderSummary();
        this.renderStarsTable();
        this.renderDownloadsTable();
        Charts.updateTrendChart(document.getElementById('chartMetric').value, this.currentPeriod);
    },

    renderSummary() {
        const totalStars = DataStore.getTotalStars();
        const totalDownloads = DataStore.getTotalDownloads();
        const topGrower = DataStore.getTopGrower(this.currentPeriod);

        const githubStats = DataStore.getGithubStats(this.currentPeriod);
        const pypiStats = DataStore.getPypiStats(this.currentPeriod);

        const starsChange = githubStats.reduce((sum, s) => sum + (s.change || 0), 0);
        const downloadsChange = pypiStats.reduce((sum, s) => sum + (s.change || 0), 0);

        document.getElementById('totalStars').textContent = Utils.formatNumber(totalStars);
        document.getElementById('totalStarsChange').textContent = 
            `${Utils.formatChange(starsChange)} in ${this.currentPeriod}D`;

        document.getElementById('totalDownloads').textContent = Utils.formatNumber(totalDownloads);
        document.getElementById('totalDownloadsChange').textContent = 
            `${Utils.formatChange(downloadsChange)} in ${this.currentPeriod}D`;

        document.getElementById('periodLabel').textContent = `(${this.currentPeriod}D)`;

        if (topGrower) {
            const shortName = topGrower.name.includes('/') ? 
                topGrower.name.split('/').pop() : topGrower.name;
            document.getElementById('topGrower').textContent = shortName;
            document.getElementById('topGrowerChange').textContent = Utils.formatChange(topGrower.change) + ' stars';
            document.getElementById('topGrowerChange').className = 'card-change ' + 
                (topGrower.change >= 0 ? 'positive' : 'negative');
        }

        this.renderLastUpdate();
    },

    renderLastUpdate() {
        const lastUpdate = DataStore.getLastUpdate();
        const indicator = document.getElementById('lastUpdateIndicator');
        if (!indicator) return;
        
        if (lastUpdate) {
            const isRecent = DataStore.isRecentlyUpdated();
            const date = new Date(lastUpdate);
            const formatted = date.toLocaleDateString('en-US', { 
                month: 'short', day: 'numeric', year: 'numeric' 
            });
            indicator.textContent = `Last updated: ${formatted}`;
            indicator.className = 'last-update' + (isRecent ? ' recent' : '');
        } else {
            indicator.textContent = '';
        }
    },

    renderStarsTable() {
        let stats = DataStore.getGithubStats(this.currentPeriod);
        stats = this.sortStats(stats, 'stars');
        
        const tbody = document.querySelector('#starsTable tbody');
        tbody.innerHTML = '';

        for (const stat of stats) {
            const shortName = stat.name.includes('/') ? stat.name.split('/').pop() : stat.name;
            const changeClass = Utils.getChangeClass(stat.percent);
            const streak = typeof stat.streak === 'object' ? stat.streak : { symbol: stat.streak, tooltip: '' };

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${shortName}</td>
                <td class="num">${Utils.formatNumber(stat.current)}</td>
                <td class="num ${changeClass}">${Utils.formatChange(stat.change)}</td>
                <td class="num ${changeClass}">${Utils.formatPercent(stat.percent)}</td>
                <td class="streak" title="${streak.tooltip}">${streak.symbol}</td>
            `;
            tbody.appendChild(row);
        }
        
        this.updateSortIndicators('starsTable', 'stars');
    },

    renderDownloadsTable() {
        let stats = DataStore.getPypiStats(this.currentPeriod);
        stats = this.sortStats(stats, 'downloads');
        
        const tbody = document.querySelector('#downloadsTable tbody');
        tbody.innerHTML = '';

        for (const stat of stats) {
            const changeClass = Utils.getChangeClass(stat.percent);
            const streak = typeof stat.streak === 'object' ? stat.streak : { symbol: stat.streak, tooltip: '' };

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${stat.name}</td>
                <td class="num">${Utils.formatNumber(stat.current)}</td>
                <td class="num ${changeClass}">${Utils.formatChange(stat.change)}</td>
                <td class="num ${changeClass}">${Utils.formatPercent(stat.percent)}</td>
                <td class="streak" title="${streak.tooltip}">${streak.symbol}</td>
            `;
            tbody.appendChild(row);
        }
        
        this.updateSortIndicators('downloadsTable', 'downloads');
    },

    showReportModal() {
        document.getElementById('reportModal').classList.add('active');
        this.updateReportOutput(document.getElementById('reportPeriod').value);
    },

    updateReportOutput(period) {
        const report = Report.generate(period);
        document.getElementById('reportOutput').textContent = report;
    },

    showFilterModal(type) {
        this.currentFilterType = type;
        const columns = type === 'stars' ? DataStore.githubColumns : DataStore.pypiColumns;
        const selected = type === 'stars' ? DataStore.selectedGithub : DataStore.selectedPypi;

        document.getElementById('filterModalTitle').textContent = 
            type === 'stars' ? 'Filter Repositories' : 'Filter Packages';

        const orgButtons = document.getElementById('orgButtons');
        orgButtons.innerHTML = '';

        if (type === 'stars') {
            const orgs = [...new Set(columns.map(col => col.split('/')[0]))];
            orgs.forEach(org => {
                const btn = document.createElement('button');
                btn.className = 'btn-secondary';
                btn.textContent = org;
                btn.addEventListener('click', () => this.selectOrg(org));
                orgButtons.appendChild(btn);
            });
        }

        const filterList = document.getElementById('filterList');
        filterList.innerHTML = '';

        const stats = type === 'stars' ? 
            DataStore.getGithubStats(this.currentPeriod) : 
            DataStore.getPypiStats(this.currentPeriod);
        const statsMap = new Map(stats.map(s => [s.name, s]));

        const sortedColumns = [...columns].sort((a, b) => {
            const aVal = statsMap.get(a)?.current || 0;
            const bVal = statsMap.get(b)?.current || 0;
            return bVal - aVal;
        });

        for (const col of sortedColumns) {
            const shortName = col.includes('/') ? col.split('/').pop() : col;
            const stat = statsMap.get(col);
            const value = stat ? Utils.formatNumber(stat.current) : '—';
            
            const item = document.createElement('label');
            item.className = 'filter-item';
            item.innerHTML = `
                <input type="checkbox" value="${col}" ${selected.has(col) ? 'checked' : ''}>
                <span>${shortName}</span>
                <span class="filter-value">${value}</span>
            `;
            item.querySelector('input').addEventListener('change', (e) => {
                if (e.target.checked) {
                    selected.add(col);
                } else {
                    selected.delete(col);
                }
                this.render();
            });
            filterList.appendChild(item);
        }

        document.getElementById('filterModal').classList.add('active');
    },

    selectOrg(org) {
        const columns = DataStore.githubColumns;
        const selected = DataStore.selectedGithub;
        
        selected.clear();
        columns.forEach(col => {
            if (col.startsWith(org + '/')) {
                selected.add(col);
            }
        });

        document.querySelectorAll('#filterList input').forEach(input => {
            input.checked = selected.has(input.value);
        });

        this.render();
    },

    selectAllFilters(selectAll) {
        const selected = this.currentFilterType === 'stars' ? 
            DataStore.selectedGithub : DataStore.selectedPypi;
        const columns = this.currentFilterType === 'stars' ? 
            DataStore.githubColumns : DataStore.pypiColumns;

        if (selectAll) {
            columns.forEach(col => selected.add(col));
        } else {
            selected.clear();
        }

        document.querySelectorAll('#filterList input').forEach(input => {
            input.checked = selectAll;
        });

        this.render();
    },

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    showChartItemsModal() {
        const type = document.getElementById('chartMetric').value;
        const columns = type === 'stars' ? DataStore.githubColumns : DataStore.pypiColumns;
        const stats = type === 'stars' ? 
            DataStore.getGithubStats(this.currentPeriod) : 
            DataStore.getPypiStats(this.currentPeriod);
        const statsMap = new Map(stats.map(s => [s.name, s]));

        if (this.chartSelectedItems.length === 0) {
            this.chartSelectedItems = Charts.selectedItems.slice();
        }

        const list = document.getElementById('chartItemsList');
        list.innerHTML = '';

        const sortedColumns = [...columns].sort((a, b) => {
            const aChange = statsMap.get(a)?.change || 0;
            const bChange = statsMap.get(b)?.change || 0;
            return bChange - aChange;
        });

        for (const col of sortedColumns) {
            const shortName = col.includes('/') ? col.split('/').pop() : col;
            const stat = statsMap.get(col);
            const changeStr = stat ? Utils.formatChange(stat.change) : '—';
            
            const item = document.createElement('label');
            item.className = 'filter-item';
            item.innerHTML = `
                <input type="checkbox" value="${col}" ${this.chartSelectedItems.includes(col) ? 'checked' : ''}>
                <span>${shortName}</span>
                <span class="filter-value">${changeStr}</span>
            `;
            item.querySelector('input').addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (this.chartSelectedItems.length < 6) {
                        this.chartSelectedItems.push(col);
                    } else {
                        e.target.checked = false;
                    }
                } else {
                    this.chartSelectedItems = this.chartSelectedItems.filter(c => c !== col);
                }
            });
            list.appendChild(item);
        }

        document.getElementById('chartItemsModal').classList.add('active');
    },

    updateChartItemsCheckboxes() {
        document.querySelectorAll('#chartItemsList input').forEach(input => {
            input.checked = this.chartSelectedItems.includes(input.value);
        });
    },

    renderRawData(type = 'stars') {
        const rawData = DataStore.getRawData(type, 50);
        const thead = document.getElementById('rawDataHead');
        const tbody = document.getElementById('rawDataBody');

        const displayColumns = rawData.columns;

        thead.innerHTML = `
            <tr>
                <th>Date</th>
                ${displayColumns.map(col => {
                    const shortName = col.includes('/') ? col.split('/').pop() : col;
                    return `<th class="num" title="${col}">${shortName}</th>`;
                }).join('')}
            </tr>
        `;

        tbody.innerHTML = rawData.rows.map(row => `
            <tr>
                <td>${row.date}</td>
                ${displayColumns.map(col => 
                    `<td class="num">${row[col] !== null ? Utils.formatNumber(row[col]) : '—'}</td>`
                ).join('')}
            </tr>
        `).join('');
    },

    showRawColumnsModal() {
        const type = document.getElementById('rawDataType').value;
        const allColumns = DataStore.getAllItems(type);
        const selectedRaw = DataStore.getSelectedRaw(type);

        const list = document.getElementById('rawColumnsList');
        list.innerHTML = '';

        for (const col of allColumns) {
            const shortName = col.includes('/') ? col.split('/').pop() : col;
            
            const item = document.createElement('label');
            item.className = 'filter-item';
            item.innerHTML = `
                <input type="checkbox" value="${col}" ${selectedRaw.has(col) ? 'checked' : ''}>
                <span>${shortName}</span>
            `;
            list.appendChild(item);
        }

        document.getElementById('rawColumnsModal').classList.add('active');
    },

    selectAllRawColumns(selectAll) {
        document.querySelectorAll('#rawColumnsList input').forEach(input => {
            input.checked = selectAll;
        });
    },

    applyRawColumns() {
        const type = document.getElementById('rawDataType').value;
        const selected = [];
        
        document.querySelectorAll('#rawColumnsList input:checked').forEach(input => {
            selected.push(input.value);
        });

        DataStore.setSelectedRaw(type, selected);
        this.renderRawData(type);
        this.hideModal('rawColumnsModal');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
