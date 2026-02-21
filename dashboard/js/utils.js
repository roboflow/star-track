const Utils = {
    formatNumber(num) {
        if (num === null || num === undefined || isNaN(num)) return '—';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num.toLocaleString();
    },

    formatChange(change) {
        if (change === null || change === undefined || isNaN(change)) return '—';
        const sign = change >= 0 ? '+' : '';
        if (Math.abs(change) >= 1000000) return sign + (change / 1000000).toFixed(1) + 'M';
        if (Math.abs(change) >= 1000) return sign + (change / 1000).toFixed(1) + 'k';
        return sign + change.toLocaleString();
    },

    formatPercent(percent) {
        if (percent === null || percent === undefined || isNaN(percent)) return '—';
        const sign = percent >= 0 ? '+' : '';
        return sign + percent.toFixed(1) + '%';
    },

    calculateChange(current, previous) {
        if (!previous || previous === 0) return { abs: current || 0, percent: 0 };
        const abs = current - previous;
        const percent = ((current - previous) / previous) * 100;
        return { abs, percent };
    },

    getGrowthThreshold(periodDays) {
        if (periodDays <= 7) return 1.0;
        if (periodDays <= 30) return 2.0;
        return 3.0;
    },

    classifyPeriodGrowth(startVal, endVal, threshold) {
        if (!startVal || startVal === 0) return 'stagnant';
        const percent = ((endVal - startVal) / startVal) * 100;
        if (percent >= threshold) return 'growth';
        if (percent <= -threshold) return 'decline';
        return 'stagnant';
    },

    getTrend(data, column, periodDays) {
        if (!data || data.length < 2) return { symbol: '—', value: 0, tooltip: 'Not enough data' };
        
        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
        const threshold = this.getGrowthThreshold(periodDays);
        
        const now = new Date();
        const periods = [];
        
        for (let i = 0; i < 3; i++) {
            const periodEnd = new Date(now);
            periodEnd.setDate(periodEnd.getDate() - (i * periodDays));
            const periodStart = new Date(periodEnd);
            periodStart.setDate(periodStart.getDate() - periodDays);
            
            const endDate = this.formatDate(periodEnd);
            const startDate = this.formatDate(periodStart);
            
            let endVal = null, startVal = null;
            for (const row of sorted) {
                if (row.date <= endDate && row[column] !== null) endVal = row[column];
                if (row.date <= startDate && row[column] !== null) startVal = row[column];
            }
            
            if (endVal !== null && startVal !== null) {
                periods.push(this.classifyPeriodGrowth(startVal, endVal, threshold));
            }
        }
        
        if (periods.length === 0) return { symbol: '—', value: 0, tooltip: 'Not enough data' };
        
        const growthCount = periods.filter(p => p === 'growth').length;
        const declineCount = periods.filter(p => p === 'decline').length;
        const currentPeriod = periods[0];
        
        const periodLabel = periodDays === 7 ? 'week' : periodDays === 30 ? 'month' : '90 days';
        
        if (growthCount === 3) {
            return { symbol: '↗↗↗', value: 3, tooltip: `Growing >${threshold}% for 3 consecutive ${periodLabel}s` };
        }
        if (growthCount === 2 && periods[0] === 'growth' && periods[1] === 'growth') {
            return { symbol: '↗↗', value: 2, tooltip: `Growing >${threshold}% for 2 consecutive ${periodLabel}s` };
        }
        if (currentPeriod === 'growth') {
            return { symbol: '↗', value: 1, tooltip: `Growing >${threshold}% this ${periodLabel}` };
        }
        if (currentPeriod === 'decline') {
            return { symbol: '↘', value: -1, tooltip: `Declining >${threshold}% this ${periodLabel}` };
        }
        if (declineCount >= 2) {
            return { symbol: '↘↘', value: -2, tooltip: `Declining for multiple ${periodLabel}s` };
        }
        return { symbol: '→', value: 0, tooltip: `Change within ±${threshold}% (stagnant)` };
    },

    streakToNumber(streak) {
        if (typeof streak === 'object') return streak.value;
        const map = { '↗↗↗': 3, '↗↗': 2, '↗': 1, '→': 0, '↘': -1, '↘↘': -2, '—': -99 };
        return map[streak] ?? 0;
    },

    getChangeClass(percent) {
        if (percent > 2.5) return 'positive';
        if (percent < -2.5) return 'negative';
        return '';
    },

    parseDate(dateStr) {
        return new Date(dateStr);
    },

    formatDate(date) {
        return date.toISOString().split('T')[0];
    },

    getDaysAgo(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return this.formatDate(date);
    },

    filterDataByPeriod(data, days) {
        const cutoffDate = this.getDaysAgo(days);
        return data.filter(row => row.date >= cutoffDate);
    },

    getLatestValue(data, column) {
        if (!data || data.length === 0) return null;
        const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
        return sorted[0][column];
    },

    getPreviousValue(data, column, daysBack) {
        if (!data || data.length === 0) return null;
        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
        const targetDate = this.getDaysAgo(daysBack);
        
        let closest = sorted[0];
        for (const row of sorted) {
            if (row.date <= targetDate) {
                closest = row;
            } else {
                break;
            }
        }
        return closest[column];
    },

    getColumnValues(data, column) {
        return data
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(row => row[column])
            .filter(v => v !== null && v !== undefined && !isNaN(v));
    },

    sumColumn(data, columns) {
        if (!data || data.length === 0) return 0;
        const latestRow = [...data].sort((a, b) => b.date.localeCompare(a.date))[0];
        return columns.reduce((sum, col) => {
            const val = latestRow[col];
            return sum + (val && !isNaN(val) ? Number(val) : 0);
        }, 0);
    },

    extractOrgFromRepo(repoName) {
        return repoName.split('/')[0];
    }
};
