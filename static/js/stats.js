document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const totalFigures = document.getElementById('total-figures');
    const purchasedFigures = document.getElementById('purchased-figures');
    const preorderedFigures = document.getElementById('preordered-figures');
    const trackingFigures = document.getElementById('tracking-figures');
    const totalPurchasedAmount = document.getElementById('total-purchased-amount');
    const totalPreorderAmount = document.getElementById('total-preorder-amount');
    const totalRemainingPayment = document.getElementById('total-remaining-payment');
    const totalMarketValue = document.getElementById('total-market-value');
    const yearlyStatsContainer = document.getElementById('yearly-stats-container');
    const unacquiredToggleBtn = document.getElementById('toggle-unacquired');
    const unacquiredList = document.getElementById('unacquired-list');
    const unacquiredTbody = document.getElementById('unacquired-tbody');

    // Fetch and process figures data
    async function loadFigureStats() {
        try {
            Utils.showLoading(true);
            const figures = await Utils.fetchAPI('/api/figures');
            
            // Overall stats
            const totalCount = figures.length;
            const purchasedCount = figures.filter(f => f.status === 'purchased').length;
            const preorderedCount = figures.filter(f => f.status === 'preordered').length;
            const trackingCount = figures.filter(f => f.status === 'tracking').length;

            // Financial stats
            const purchasedAmount = figures
                .filter(f => f.status === 'purchased')
                .reduce((sum, f) => sum + (f.actual_price || 0), 0);
            
            const preorderAmount = figures
                .filter(f => f.status === 'preordered')
                .reduce((sum, f) => sum + (f.actual_price || 0), 0);
            
            const remainingPayment = figures
                .filter(f => f.status === 'preordered')
                .reduce((sum, f) => sum + (f.remaining_payment || 0), 0);
            
            const marketValue = figures
                .filter(f => f.status !== 'purchased' && f.status !== 'preordered')
                .reduce((sum, f) => sum + (f.actual_price || 0), 0);

            // Update overall stats
            totalFigures.textContent = totalCount;
            purchasedFigures.textContent = purchasedCount;
            preorderedFigures.textContent = preorderedCount;
            trackingFigures.textContent = trackingCount;

            // Update financial stats
            totalPurchasedAmount.textContent = `¥${purchasedAmount.toFixed(2)}`;
            totalPreorderAmount.textContent = `¥${preorderAmount.toFixed(2)}`;
            totalRemainingPayment.textContent = `¥${remainingPayment.toFixed(2)}`;
            totalMarketValue.textContent = `¥${marketValue.toFixed(2)}`;

            // Process yearly stats
            processYearlyStats(figures);

            // Process unacquired figures
            processUnacquiredFigures(figures);

        } catch (error) {
            console.error('Error loading figure stats:', error);
            Utils.showError('加载统计数据失败');
        } finally {
            Utils.showLoading(false);
        }
    }

    function processYearlyStats(figures) {
        // Group figures by release year
        const yearlyGroups = {};
        
        figures.forEach(figure => {
            const year = figure['发售年份'] || '未知';
            if (!yearlyGroups[year]) {
                yearlyGroups[year] = {
                    total: 0,
                    purchased: 0,
                    preordered: 0,
                    tracking: 0
                };
            }
            
            yearlyGroups[year].total++;
            
            if (figure.status === 'purchased') {
                yearlyGroups[year].purchased++;
            } else if (figure.status === 'preordered') {
                yearlyGroups[year].preordered++;
            } else {
                yearlyGroups[year].tracking++;
            }
        });

        // Render yearly stats
        yearlyStatsContainer.innerHTML = '';
        
        Object.entries(yearlyGroups).sort((a, b) => {
            // Sort years, with 'unknown' at the end
            if (a[0] === '未知') return 1;
            if (b[0] === '未知') return -1;
            return b[0].localeCompare(a[0]);
        }).forEach(([year, stats]) => {
            const yearRow = document.createElement('div');
            yearRow.classList.add('year-row');

            const purchasePercent = stats.total > 0 
                ? ((stats.purchased / stats.total) * 100).toFixed(1)
                : 0;

            yearRow.innerHTML = `
                <div class="year-row-header">
                    <h4>${year}年 (共${stats.total}个)</h4>
                    <span>${purchasePercent}% 已购)</span>
                </div>
                <div class="year-details">
                    <table>
                        <tr>
                            <td>已购: ${stats.purchased}</td>
                            <td>预订: ${stats.preordered}</td>
                            <td>追踪: ${stats.tracking}</td>
                        </tr>
                    </table>
                </div>
            `;

            yearlyStatsContainer.appendChild(yearRow);
        });

        // Add click event to expand/collapse year details
        yearlyStatsContainer.addEventListener('click', function(e) {
            const yearRowHeader = e.target.closest('.year-row-header');
            if (yearRowHeader) {
                const yearDetails = yearRowHeader.nextElementSibling;
                yearDetails.classList.toggle('active');
            }
        });
    }

    function processUnacquiredFigures(figures) {
        // Filter out figures not purchased
        const unacquiredFigures = figures.filter(f => f.status !== 'purchased');

        // Toggle unacquired figures list
        unacquiredToggleBtn.addEventListener('click', function() {
            unacquiredList.classList.toggle('hidden');
            const icon = this.querySelector('i');
            icon.classList.toggle('fa-chevron-down');
            icon.classList.toggle('fa-chevron-up');
        });

        // Populate unacquired figures table
        unacquiredTbody.innerHTML = unacquiredFigures.map(figure => `
            <tr>
                <td>${figure['名称'] || '未知'}</td>
                <td>${Utils.formatPrice(figure.actual_price)}</td>
                <td>${figure['发售日'] || '--'}</td>
            </tr>
        `).join('');
    }

    // Load stats on page load
    loadFigureStats();
});