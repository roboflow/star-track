const Charts = {
    trendChart: null,
    selectedItems: [],
    currentType: 'stars',
    chartPeriod: 30,
    chartGranularity: 'week',
    colors: {
        blue: '#007AFF',
        green: '#34C759',
        orange: '#FF9500',
        purple: '#AF52DE',
        pink: '#FF2D55',
        teal: '#5AC8FA'
    },

    init() {
        this.setupTrendChart();
    },

    setupTrendChart() {
        const ctx = document.getElementById('trendChart');
        if (!ctx) return;

        Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, SF Pro Text, sans-serif';

        this.trendChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300,
                    easing: 'easeOutQuart'
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: () => this.isDark() ? 'rgba(44, 44, 46, 0.96)' : 'rgba(255, 255, 255, 0.96)',
                        titleColor: () => this.isDark() ? '#f5f5f7' : '#1d1d1f',
                        bodyColor: () => this.isDark() ? '#f5f5f7' : '#1d1d1f',
                        borderColor: () => this.isDark() ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                        borderWidth: 1,
                        cornerRadius: 10,
                        padding: { x: 14, y: 10 },
                        titleFont: { size: 13, weight: '600' },
                        bodyFont: { size: 12, weight: '400' },
                        displayColors: true,
                        boxWidth: 8,
                        boxHeight: 8,
                        boxPadding: 4,
                        callbacks: {
                            title: (items) => {
                                if (!items.length) return '';
                                return items[0].label;
                            },
                            label: (context) => {
                                const value = context.raw || 0;
                                return ` ${context.dataset.label}: +${Utils.formatNumber(value)}`;
                            },
                            footer: (items) => {
                                const total = items.reduce((sum, item) => sum + (item.raw || 0), 0);
                                return `Total: +${Utils.formatNumber(total)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        stacked: true,
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                            font: { size: 11, weight: '400' },
                            color: () => this.isDark() ? '#98989d' : '#86868b',
                            maxTicksLimit: 10,
                            padding: 8
                        }
                    },
                    y: {
                        display: true,
                        stacked: true,
                        position: 'right',
                        grid: { 
                            color: () => this.isDark() ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                            drawBorder: false
                        },
                        border: { display: false },
                        ticks: {
                            font: { size: 11, weight: '400' },
                            color: () => this.isDark() ? '#98989d' : '#86868b',
                            padding: 12,
                            maxTicksLimit: 5,
                            callback: (value) => '+' + Utils.formatNumber(value)
                        }
                    }
                }
            }
        });
    },

    updateTrendChart(type = 'stars', period = 30, customItems = null) {
        if (!this.trendChart) return;

        this.currentType = type;
        const items = customItems || (this.selectedItems.length > 0 ? this.selectedItems : null);
        const chartData = DataStore.getStackedGrowthData(type, items, this.chartPeriod, this.chartGranularity);
        this.selectedItems = chartData.selectedItems || [];

        this.trendChart.data = chartData;
        this.trendChart.update('none');
        
        this.renderLegend(chartData.datasets);
        this.updateChartTitle();
    },

    setChartPeriod(days) {
        this.chartPeriod = days;
    },

    setChartGranularity(granularity) {
        this.chartGranularity = granularity;
    },

    setSelectedItems(items) {
        this.selectedItems = items;
    },

    updateChartTitle() {
        const title = document.getElementById('chartTitle');
        if (title) {
            const granularityLabel = this.chartGranularity === 'day' ? 'daily' : 
                                     this.chartGranularity === 'week' ? 'weekly' : 'monthly';
            
            const periodLabel = this.chartPeriod ? `last ${this.chartPeriod} days` : 'all time';
            title.textContent = `Star growth (${granularityLabel}) · ${periodLabel}`;
        }
    },

    renderLegend(datasets) {
        const container = document.getElementById('chartLegend');
        if (!container) return;
        
        container.innerHTML = datasets.map((ds, i) => `
            <div class="chart-legend-item active" data-index="${i}" title="${ds.fullName || ds.label}">
                <span class="chart-legend-dot" style="background: ${ds.borderColor}"></span>
                <span>${ds.label}</span>
            </div>
        `).join('');
    },

    isDark() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    },

    destroy() {
        if (this.trendChart) {
            this.trendChart.destroy();
            this.trendChart = null;
        }
    }
};
