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
    
    // Sorting state
    let unacquiredFigures = [];
    let currentSortField = 'actual_price';
    let currentSortDirection = 'desc';

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
            unacquiredFigures = figures.filter(f => f.status !== 'purchased' && f.status !== 'preordered');
            processUnacquiredFigures();

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

    function sortUnacquiredFigures(field = currentSortField) {
        // If clicking the same header, reverse the sort direction
        if (field === currentSortField) {
            currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentSortField = field;
            // Default to descending for price, ascending for name and date
            currentSortDirection = field === 'actual_price' ? 'desc' : 'asc';
        }

        unacquiredFigures.sort((a, b) => {
            let valueA, valueB;
            
            if (field === 'actual_price') {
                valueA = a.actual_price || 0;
                valueB = b.actual_price || 0;
            } else if (field === '名称') {
                valueA = a['名称'] || '';
                valueB = b['名称'] || '';
                return currentSortDirection === 'asc' 
                    ? valueA.localeCompare(valueB) 
                    : valueB.localeCompare(valueA);
            } else if (field === '发售日') {
                valueA = a['发售日'] || '';
                valueB = b['发售日'] || '';
                return currentSortDirection === 'asc' 
                    ? valueA.localeCompare(valueB) 
                    : valueB.localeCompare(valueA);
            }
            
            return currentSortDirection === 'asc' ? valueA - valueB : valueB - valueA;
        });

        // Update UI to show sorting state
        renderUnacquiredFigures();
        updateSortingIndicators();
    }

    function updateSortingIndicators() {
        // Remove all sorting indicators
        document.querySelectorAll('#unacquired-table th').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            const icon = th.querySelector('.sort-icon');
            if (icon) {
                icon.remove();
            }
        });

        // Add sorting indicator to current column
        const columnIndex = {
            '名称': 0,
            'actual_price': 1,
            '发售日': 2
        }[currentSortField];

        if (columnIndex !== undefined) {
            const th = document.querySelector(`#unacquired-table th:nth-child(${columnIndex + 1})`);
            if (th) {
                th.classList.add(`sort-${currentSortDirection}`);
                
                const icon = document.createElement('span');
                icon.className = 'sort-icon';
                icon.innerHTML = currentSortDirection === 'asc' ? ' ↑' : ' ↓';
                th.appendChild(icon);
            }
        }
    }

    function renderUnacquiredFigures() {
        unacquiredTbody.innerHTML = unacquiredFigures.map(figure => `
            <tr>
                <td>${figure['名称'] || '未知'}</td>
                <td>${Utils.formatPrice(figure.actual_price)}</td>
                <td>${figure['发售日'] || '--'}</td>
            </tr>
        `).join('');
    }

    function processUnacquiredFigures() {
        // Initialize the table with headers including sorting functionality
        const unacquiredTable = document.getElementById('unacquired-table');
        
        // Clear and repopulate the thead with click handlers
        const thead = unacquiredTable.querySelector('thead');
        thead.innerHTML = `
            <tr>
                <th data-sort="名称">名称</th>
                <th data-sort="actual_price">咸鱼现价</th>
                <th data-sort="发售日">发售日期</th>
            </tr>
        `;
        
        // Add sorting functionality to headers
        thead.querySelectorAll('th').forEach(th => {
            th.style.cursor = 'pointer';
            th.addEventListener('click', function() {
                const field = this.getAttribute('data-sort');
                sortUnacquiredFigures(field);
            });
        });

        // Toggle unacquired figures list
        unacquiredToggleBtn.addEventListener('click', function() {
            unacquiredList.classList.toggle('hidden');
            const icon = this.querySelector('i');
            const buttonText = this.textContent.trim().replace(/^[▼▲]\s*/, '');
            
            if (unacquiredList.classList.contains('hidden')) {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
                this.innerHTML = `<i class="fas fa-chevron-down"></i> 展开`;
            } else {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
                this.innerHTML = `<i class="fas fa-chevron-up"></i> 收起`;
            }
        });

        // Initial sort (by default, price descending)
        sortUnacquiredFigures('actual_price');
    }

    // Load stats on page load
    loadFigureStats();
});