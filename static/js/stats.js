document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const totalFigures = document.getElementById('total-figures');
    const purchasedFiguresCount = document.getElementById('purchased-figures');
    const preorderedFiguresCount = document.getElementById('preordered-figures');
    const trackingFigures = document.getElementById('tracking-figures');
    const totalPurchasedAmount = document.getElementById('total-purchased-amount');
    const totalPreorderAmount = document.getElementById('total-preorder-amount');
    const totalRemainingPayment = document.getElementById('total-remaining-payment');
    const totalMarketValue = document.getElementById('total-market-value');
    const yearlyStatsContainer = document.getElementById('yearly-stats-container');
    const unacquiredToggleBtn = document.getElementById('toggle-unacquired');
    const unacquiredList = document.getElementById('unacquired-list');
    const unacquiredTbody = document.getElementById('unacquired-tbody');
    const preorderedToggleBtn = document.getElementById('toggle-preordered');
    const preorderedList = document.getElementById('preordered-list');
    const preorderedTbody = document.getElementById('preordered-tbody');
    
    // Sorting state
    let figures = []; // 所有手办数据
    let unacquiredFigures = [];
    let preorderedFigures = []; // 预购手办
    let currentSortField = 'actual_price';
    let currentSortDirection = 'desc';
    let currentPreorderedSortField = 'remaining_payment';
    let currentPreorderedSortDirection = 'desc';

    // Fetch and process figures data
    async function loadFigureStats() {
        try {
            Utils.showLoading(true);
            figures = await Utils.fetchAPI('/api/figures');
            
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
            purchasedFiguresCount.textContent = purchasedCount;
            preorderedFiguresCount.textContent = preorderedCount;
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
            
            // Process preordered figures
            preorderedFigures = figures.filter(f => f.status === 'preordered');
            processPreorderedFigures();

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
                // 使用解析函数将中文日期转为时间戳
                valueA = parseChineseDateToTimestamp(a['发售日']);
                valueB = parseChineseDateToTimestamp(b['发售日']);
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
    
    /**
     * 解析中文日期字符串转为时间戳
     * 支持 "XXXX年XX月XX日", "XXXX年XX月" 等格式
     * @param {string} dateStr - 中文日期字符串
     * @return {number} - 时间戳，无效日期返回0
     */
    function parseChineseDateToTimestamp(dateStr) {
        if (!dateStr || dateStr === '--') return 0;
        
        // 创建一个正则表达式匹配模式
        // 匹配 "XXXX年XX月XX日" 或 "XXXX年XX月" 格式
        const pattern = /(\d{4})年(\d{1,2})月(?:(\d{1,2})日)?/;
        const match = dateStr.match(pattern);
        
        if (!match) return 0;
        
        // 提取年月日
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // 月份从0开始
        const day = match[3] ? parseInt(match[3]) : 1; // 如果没有日，默认为1日
        
        // 创建日期对象并返回时间戳
        return new Date(year, month, day).getTime();
    }
    function processPreorderedFigures() {
        // 初始化表格头部，包括排序功能
        const preorderedTable = document.getElementById('preordered-table');
        
        // 清除并重新填充thead，添加点击事件处理
        const thead = preorderedTable.querySelector('thead');
        thead.innerHTML = `
            <tr>
                <th data-sort="名称">名称</th>
                <th data-sort="remaining_payment">待补尾款</th>
                <th data-sort="发售日">发售日期</th>
                <th>操作</th>
            </tr>
        `;
        
        // 为表头添加排序功能
        thead.querySelectorAll('th[data-sort]').forEach(th => {
            th.style.cursor = 'pointer';
            th.addEventListener('click', function() {
                const field = this.getAttribute('data-sort');
                sortPreorderedFigures(field);
            });
        });

        // 切换预购手办列表的展开/折叠
        preorderedToggleBtn.addEventListener('click', function() {
            preorderedList.classList.toggle('hidden');
            const icon = this.querySelector('i');
            
            if (preorderedList.classList.contains('hidden')) {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
                this.innerHTML = `<i class="fas fa-chevron-down"></i> 展开`;
            } else {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
                this.innerHTML = `<i class="fas fa-chevron-up"></i> 收起`;
            }
        });

        // 首次载入时，按待补尾款降序排序
        sortPreorderedFigures('remaining_payment');
    }

    // 预购手办排序
    function sortPreorderedFigures(field = currentPreorderedSortField) {
        // 如果点击的是同一个表头，反转排序方向
        if (field === currentPreorderedSortField) {
            currentPreorderedSortDirection = currentPreorderedSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentPreorderedSortField = field;
            // 设置默认排序方向：尾款默认降序，名称默认升序，日期默认按升序（先发售的在前）
            currentPreorderedSortDirection = field === 'remaining_payment' ? 'desc' : 'asc';
        }

        preorderedFigures.sort((a, b) => {
            let valueA, valueB;
            
            if (field === 'remaining_payment') {
                valueA = a.remaining_payment || 0;
                valueB = b.remaining_payment || 0;
            } else if (field === '名称') {
                valueA = a['名称'] || '';
                valueB = b['名称'] || '';
                return currentPreorderedSortDirection === 'asc' 
                    ? valueA.localeCompare(valueB) 
                    : valueB.localeCompare(valueA);
            } else if (field === '发售日') {
                // 使用解析函数将中文日期转为时间戳
                valueA = parseChineseDateToTimestamp(a['发售日']);
                valueB = parseChineseDateToTimestamp(b['发售日']);
            }
            
            return currentPreorderedSortDirection === 'asc' ? valueA - valueB : valueB - valueA;
        });

        // 更新UI显示排序状态
        renderPreorderedFigures();
        updatePreorderedSortingIndicators();
    }

    // 更新排序指示器
    function updatePreorderedSortingIndicators() {
        // 移除所有排序指示器
        document.querySelectorAll('#preordered-table th').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            const icon = th.querySelector('.sort-icon');
            if (icon) {
                icon.remove();
            }
        });

        // 为当前列添加排序指示器
        const columnMap = {
            '名称': 0,
            'remaining_payment': 1,
            '发售日': 2
        };
        
        const columnIndex = columnMap[currentPreorderedSortField];

        if (columnIndex !== undefined) {
            const th = document.querySelector(`#preordered-table th:nth-child(${columnIndex + 1})`);
            if (th) {
                th.classList.add(`sort-${currentPreorderedSortDirection}`);
                
                const icon = document.createElement('span');
                icon.className = 'sort-icon';
                icon.innerHTML = currentPreorderedSortDirection === 'asc' ? ' ↑' : ' ↓';
                th.appendChild(icon);
            }
        }
    }

    // 渲染预购手办列表
    function renderPreorderedFigures() {
        preorderedTbody.innerHTML = '';

        preorderedFigures.forEach(figure => {
            const row = document.createElement('tr');
            
            // 格式化日期和尾款
            const formattedDate = figure['发售日'] || '--';
            const formattedPayment = Utils.formatPrice(figure.remaining_payment || 0);
            
            row.innerHTML = `
                <td>${figure['名称'] || '未知'}</td>
                <td>${formattedPayment}</td>
                <td>
                    <span class="release-date">${formattedDate}</span>
                    <button class="edit-date-btn" data-uuid="${figure.uuid}" title="修改发售日期">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
                <td>
                    <a href="${figure.url}" target="_blank" class="link-btn" title="查看详情">
                        <i class="fas fa-external-link-alt"></i> 详情
                    </a>
                </td>
            `;
            
            // 添加日期编辑按钮事件
            const editBtn = row.querySelector('.edit-date-btn');
            if (editBtn) {
                editBtn.addEventListener('click', function() {
                    const uuid = this.getAttribute('data-uuid');
                    editReleaseDate(uuid);
                });
            }
            
            preorderedTbody.appendChild(row);
        });
    }

    // 编辑发售日期
    async function editReleaseDate(uuid) {
        const figure = preorderedFigures.find(f => f.uuid === uuid);
        if (!figure) return;
        
        // 提示用户输入新的发售日期
        const newDate = prompt(`请输入 "${figure['名称']}" 的新发售日期:`, figure['发售日'] || '');
        
        if (newDate === null) return; // 用户取消
        
        try {
            Utils.showLoading(true);
            
            // 发送更新请求
            const updatedFigure = await Utils.fetchAPI(`/api/figures/update/${uuid}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    '发售日': newDate
                })
            });
            
            // 更新本地数据
            const allIndex = figures.findIndex(f => f.uuid === uuid);
            if (allIndex !== -1) {
                figures[allIndex]['发售日'] = newDate;
            }
            
            const preorderedIndex = preorderedFigures.findIndex(f => f.uuid === uuid);
            if (preorderedIndex !== -1) {
                preorderedFigures[preorderedIndex]['发售日'] = newDate;
            }
            
            // 刷新显示
            renderPreorderedFigures();
            
            Utils.showSuccess('发售日期已更新');
        } catch (error) {
            console.error('更新发售日期失败:', error);
            Utils.showError('更新失败');
        } finally {
            Utils.showLoading(false);
        }
    }

    // Load stats on page load
    loadFigureStats();
});