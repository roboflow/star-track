const Report = {
    generate(period = 'monthly') {
        const days = period === 'weekly' ? 7 : 30;
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const now = new Date();
        const monthName = monthNames[now.getMonth()];
        const year = now.getFullYear();

        const githubStats = DataStore.getGithubStats(days);
        const pypiStats = DataStore.getPypiStats(days);

        let report = `Open-source numbers update! ${monthName} ${year}\n\n`;

        const totalStarsChange = githubStats.reduce((sum, s) => sum + (s.change || 0), 0);
        report += `In ${monthName}, we added ${this.formatWhole(totalStarsChange)} stars.\n\n`;

        report += this.generateGithubSection(githubStats);
        report += '\n';
        report += this.generatePypiSection(pypiStats);

        return report;
    },

    formatWhole(num) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        return num.toLocaleString();
    },

    formatStars(num) {
        if (num === null || num === undefined || isNaN(num)) return '—';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num.toLocaleString();
    },

    generateGithubSection(stats) {
        const nameWidth = 25;
        const starsWidth = 8;
        const changeWidth = 18;
        const totalWidth = nameWidth + starsWidth + changeWidth + 8;

        let section = 'GitHub stars - measure hype (↑ > 2.5%, ↓ < 2.5%)\n\n';
        section += this.padRight('Repository', nameWidth) + 
                   this.padLeft('Stars', starsWidth) + 
                   this.padLeft('Change', changeWidth) + 
                   '  Trend\n';
        section += '-'.repeat(totalWidth) + '\n';

        for (const stat of stats) {
            const name = this.truncate(this.getShortName(stat.name), nameWidth - 1);
            const stars = this.formatStars(stat.current);
            const changeAbs = stat.change >= 0 ? `+${stat.change}` : `${stat.change}`;
            const changePercent = stat.percent !== null ? (stat.percent >= 0 ? `+${stat.percent.toFixed(1)}%` : `${stat.percent.toFixed(1)}%`) : '—';
            const changeStr = `${changeAbs} (${changePercent})`;
            const streak = typeof stat.streak === 'object' ? stat.streak.symbol : stat.streak;

            section += this.padRight(name, nameWidth) + 
                       this.padLeft(stars, starsWidth) + 
                       this.padLeft(changeStr, changeWidth) + 
                       '  ' + streak + '\n';
        }

        return section;
    },

    generatePypiSection(stats) {
        const nameWidth = 20;
        const dlWidth = 10;
        const changeWidth = 18;
        const totalWidth = nameWidth + dlWidth + changeWidth + 8;

        let section = 'PyPI downloads (in period) - measure usage\n\n';
        section += this.padRight('Package', nameWidth) + 
                   this.padLeft('Downloads', dlWidth) + 
                   this.padLeft('Change', changeWidth) + 
                   '  Trend\n';
        section += '-'.repeat(totalWidth) + '\n';

        for (const stat of stats) {
            const name = this.truncate(stat.name, nameWidth - 1);
            const downloads = this.formatStars(stat.current);
            const changeAbs = stat.change >= 0 ? `+${stat.change}` : `${stat.change}`;
            const changePercent = stat.percent !== null ? (stat.percent >= 0 ? `+${stat.percent.toFixed(1)}%` : `${stat.percent.toFixed(1)}%`) : '—';
            const changeStr = `${changeAbs} (${changePercent})`;
            const streak = typeof stat.streak === 'object' ? stat.streak.symbol : stat.streak;

            section += this.padRight(name, nameWidth) + 
                       this.padLeft(downloads, dlWidth) + 
                       this.padLeft(changeStr, changeWidth) + 
                       '  ' + streak + '\n';
        }

        return section;
    },

    getShortName(fullName) {
        if (fullName.includes('/')) {
            return fullName.split('/').pop();
        }
        return fullName;
    },

    truncate(str, maxLen) {
        if (!str) return '';
        if (str.length <= maxLen) return str;
        return str.substring(0, maxLen - 1) + '…';
    },

    padRight(str, len) {
        return (str || '').toString().padEnd(len);
    },

    padLeft(str, len) {
        return (str || '').toString().padStart(len);
    },

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('Report copied to clipboard');
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }
};
