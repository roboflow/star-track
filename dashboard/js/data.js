const DataStore = {
    githubData: [],
    pypiData: [],
    githubColumns: [],
    pypiColumns: [],
    selectedGithub: new Set(),
    selectedPypi: new Set(),
    selectedRawGithub: new Set(),
    selectedRawPypi: new Set(),

    async loadData() {
        try {
            console.log('Loading CSV files...');
            
            const [githubResponse, pypiResponse] = await Promise.all([
                fetch('../data/github_data.csv'),
                fetch('../data/pypi_data.csv')
            ]);

            console.log('GitHub response:', githubResponse.status, githubResponse.ok);
            console.log('PyPI response:', pypiResponse.status, pypiResponse.ok);

            if (!githubResponse.ok) {
                console.error('Failed to load github_data.csv:', githubResponse.status);
            }
            if (!pypiResponse.ok) {
                console.error('Failed to load pypi_data.csv:', pypiResponse.status);
            }

            const githubCsv = await githubResponse.text();
            const pypiCsv = await pypiResponse.text();

            console.log('GitHub CSV length:', githubCsv.length);
            console.log('PyPI CSV length:', pypiCsv.length);
            console.log('GitHub CSV preview:', githubCsv.substring(0, 200));

            this.parseGithubData(githubCsv);
            this.parsePypiData(pypiCsv);

            console.log('Parsed GitHub columns:', this.githubColumns.length);
            console.log('Parsed GitHub rows:', this.githubData.length);
            console.log('Parsed PyPI columns:', this.pypiColumns.length);
            console.log('Parsed PyPI rows:', this.pypiData.length);

            return true;
        } catch (error) {
            console.error('Error loading data:', error);
            return false;
        }
    },

    parseGithubData(csv) {
        const result = Papa.parse(csv, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });

        const allFields = result.meta.fields || [];
        const firstField = allFields[0];
        this.githubColumns = allFields.filter(f => f && f !== '' && f !== firstField);

        this.githubData = result.data.map(row => {
            const date = row[firstField] || row[''];
            if (!date) return null;
            
            const normalized = { date: String(date) };
            this.githubColumns.forEach(col => {
                const val = row[col];
                normalized[col] = (val !== null && val !== undefined && val !== '') ? Number(val) : null;
            });
            return normalized;
        }).filter(row => row && row.date);

        this.selectedGithub = new Set(this.githubColumns);
        this.selectedRawGithub = new Set(this.githubColumns.slice(0, 10));
        console.log('GitHub parsed:', this.githubData.length, 'rows,', this.githubColumns.length, 'columns');
    },

    parsePypiData(csv) {
        const result = Papa.parse(csv, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });

        const allFields = result.meta.fields || [];
        const firstField = allFields[0];
        this.pypiColumns = allFields.filter(f => f && f !== '' && f !== firstField);

        this.pypiData = result.data.map(row => {
            const date = row[firstField] || row[''];
            if (!date) return null;
            
            const normalized = { date: String(date) };
            this.pypiColumns.forEach(col => {
                const val = row[col];
                normalized[col] = (val !== null && val !== undefined && val !== '') ? Number(val) : null;
            });
            return normalized;
        }).filter(row => row && row.date);

        this.selectedPypi = new Set(this.pypiColumns);
        this.selectedRawPypi = new Set(this.pypiColumns.slice(0, 10));
        console.log('PyPI parsed:', this.pypiData.length, 'rows,', this.pypiColumns.length, 'columns');
    },

    getGithubStats(period = 30) {
        const data = this.githubData;
        if (!data.length) return [];

        const stats = [];

        for (const col of this.githubColumns) {
            if (!this.selectedGithub.has(col)) continue;

            const values = Utils.getColumnValues(data, col);
            const current = Utils.getLatestValue(data, col);
            const previous = Utils.getPreviousValue(data, col, period);
            const change = Utils.calculateChange(current, previous);
            const trend = Utils.getTrend(data, col, period);

            stats.push({
                name: col,
                current,
                change: change.abs,
                percent: change.percent,
                streak: trend,
                values
            });
        }

        return stats.sort((a, b) => (b.current || 0) - (a.current || 0));
    },

    getPypiStats(period = 30) {
        const data = this.pypiData;
        if (!data.length) return [];

        const stats = [];

        for (const col of this.pypiColumns) {
            if (!this.selectedPypi.has(col)) continue;

            const values = Utils.getColumnValues(data, col);
            const current = Utils.getLatestValue(data, col);
            const previous = Utils.getPreviousValue(data, col, period);
            const change = Utils.calculateChange(current, previous);
            const trend = Utils.getTrend(data, col, period);

            stats.push({
                name: col,
                current,
                change: change.abs,
                percent: change.percent,
                streak: trend,
                values
            });
        }

        return stats.sort((a, b) => (b.current || 0) - (a.current || 0));
    },

    getTotalStars() {
        return Utils.sumColumn(this.githubData, [...this.selectedGithub]);
    },

    getTotalDownloads() {
        return Utils.sumColumn(this.pypiData, [...this.selectedPypi]);
    },

    getTopGrower(period = 30) {
        const githubStats = this.getGithubStats(period);
        
        if (!githubStats.length) return null;

        return githubStats.reduce((best, current) => {
            if (!best || (current.change > best.change)) return current;
            return best;
        }, null);
    },

    getDates() {
        const dates = new Set();
        this.githubData.forEach(row => dates.add(row.date));
        this.pypiData.forEach(row => dates.add(row.date));
        return Array.from(dates).sort();
    },

    getLastUpdate() {
        const dates = this.getDates();
        if (!dates.length) return null;
        return dates[dates.length - 1];
    },

    isRecentlyUpdated() {
        const lastUpdate = this.getLastUpdate();
        if (!lastUpdate) return false;
        const lastDate = new Date(lastUpdate);
        const now = new Date();
        const diffMs = now - lastDate;
        const diffHours = diffMs / (1000 * 60 * 60);
        return diffHours < 48;
    },

    getTopByChange(type = 'stars', period = 30, limit = 5) {
        const stats = type === 'stars' ? this.getGithubStats(period) : this.getPypiStats(period);
        return stats
            .filter(s => s.change !== null && s.change > 0)
            .sort((a, b) => b.change - a.change)
            .slice(0, limit)
            .map(s => s.name);
    },

    getChartData(type = 'stars', items = null, period = 30, chartPeriod = null) {
        const data = type === 'stars' ? this.githubData : this.pypiData;
        let columns = items || this.getTopByChange(type, period, 5);
        
        if (!columns.length) {
            const allCols = type === 'stars' ? [...this.selectedGithub] : [...this.selectedPypi];
            columns = allCols.slice(0, 5);
        }
        
        let allDates = [...new Set(data.map(r => r.date))].sort();
        
        if (chartPeriod && chartPeriod > 0) {
            const cutoff = Utils.getDaysAgo(chartPeriod);
            allDates = allDates.filter(d => d >= cutoff);
        }
        
        const datasets = columns.map((col, i) => {
            const colors = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5AC8FA'];
            const shortLabel = col.includes('/') ? col.split('/').pop() : col;
            return {
                label: shortLabel,
                fullName: col,
                data: allDates.map(date => {
                    const row = data.find(r => r.date === date);
                    return row ? row[col] : null;
                }),
                borderColor: colors[i % colors.length],
                backgroundColor: colors[i % colors.length] + '20',
                tension: 0.3,
                fill: false,
                pointRadius: 0,
                borderWidth: 2.5
            };
        });

        return { labels: allDates, datasets, selectedItems: columns };
    },

    getRawData(type = 'stars', limit = 100) {
        const data = type === 'stars' ? this.githubData : this.pypiData;
        const selectedRaw = type === 'stars' ? this.selectedRawGithub : this.selectedRawPypi;
        const columns = [...selectedRaw];
        
        const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
        return {
            rows: sorted.slice(0, limit),
            columns: columns
        };
    },

    getSelectedRaw(type = 'stars') {
        return type === 'stars' ? this.selectedRawGithub : this.selectedRawPypi;
    },

    setSelectedRaw(type, columns) {
        if (type === 'stars') {
            this.selectedRawGithub = new Set(columns);
        } else {
            this.selectedRawPypi = new Set(columns);
        }
    },

    getAllItems(type = 'stars') {
        return type === 'stars' ? this.githubColumns : this.pypiColumns;
    },

    getStackedGrowthData(type = 'stars', items = null, chartPeriod = 30) {
        const data = type === 'stars' ? this.githubData : this.pypiData;
        let columns = items;
        
        if (!columns || columns.length === 0) {
            columns = this.getTopByChange(type, chartPeriod, 5);
        }
        if (!columns.length) {
            const allCols = type === 'stars' ? [...this.selectedGithub] : [...this.selectedPypi];
            columns = allCols.slice(0, 5);
        }

        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
        if (sorted.length < 2) return { labels: [], datasets: [], selectedItems: columns };

        let granularity;
        if (chartPeriod <= 7) {
            granularity = 'day';
        } else if (chartPeriod <= 30) {
            granularity = 'week';
        } else {
            granularity = 'month';
        }

        const buckets = this.aggregateByGranularity(sorted, granularity, chartPeriod);
        
        const colors = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5AC8FA'];
        
        const datasets = columns.map((col, i) => {
            const shortLabel = col.includes('/') ? col.split('/').pop() : col;
            const growthData = [];
            
            for (let j = 1; j < buckets.length; j++) {
                const prevBucket = buckets[j - 1];
                const currBucket = buckets[j];
                
                const prevVal = prevBucket.data[col] || 0;
                const currVal = currBucket.data[col] || 0;
                const growth = currVal - prevVal;
                
                growthData.push(Math.max(0, growth));
            }
            
            return {
                label: shortLabel,
                fullName: col,
                data: growthData,
                backgroundColor: colors[i % colors.length],
                borderColor: colors[i % colors.length],
                borderWidth: 0,
                borderRadius: 4
            };
        });

        const labels = buckets.slice(1).map(b => b.label);

        return { labels, datasets, selectedItems: columns };
    },

    aggregateByGranularity(sortedData, granularity, chartPeriod) {
        const buckets = [];
        const cutoffDate = chartPeriod > 0 ? Utils.getDaysAgo(chartPeriod) : null;
        
        const filteredData = cutoffDate 
            ? sortedData.filter(row => row.date >= cutoffDate)
            : sortedData;

        if (filteredData.length === 0) return buckets;

        let currentBucketKey = null;
        let currentBucket = null;

        for (const row of filteredData) {
            const date = new Date(row.date);
            let bucketKey, label;

            if (granularity === 'day') {
                bucketKey = row.date;
                label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else if (granularity === 'week') {
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                bucketKey = Utils.formatDate(weekStart);
                label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else {
                bucketKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            }

            if (bucketKey !== currentBucketKey) {
                if (currentBucket) buckets.push(currentBucket);
                currentBucketKey = bucketKey;
                currentBucket = { key: bucketKey, label, data: {} };
            }

            Object.keys(row).forEach(key => {
                if (key !== 'date' && row[key] !== null) {
                    currentBucket.data[key] = row[key];
                }
            });
        }

        if (currentBucket) buckets.push(currentBucket);
        return buckets;
    }
};
