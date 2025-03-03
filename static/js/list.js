/**
 * List page functionality
 */
document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const figuresTable = document.getElementById('figures-table');
    const figuresList = document.getElementById('figures-list');
    const noDataMessage = document.getElementById('no-data-message');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const filterCountNumber = document.getElementById('filter-count-number');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    // Modal elements
    const figureModal = document.getElementById('figure-modal');
    const modalTitle = document.getElementById('modal-figure-title');
    const modalImage = document.getElementById('modal-figure-image');
    const modalPrice = document.getElementById('modal-figure-price');
    const modalReleaseDate = document.getElementById('modal-figure-release-date');
    const modalReleaseYear = document.getElementById('modal-figure-release-year');
    const modalScale = document.getElementById('modal-figure-scale');
    const modalManufacturer = document.getElementById('modal-figure-manufacturer');
    const modalCharacter = document.getElementById('modal-figure-character');
    const modalSeries = document.getElementById('modal-figure-series');
    const modalDimensions = document.getElementById('modal-figure-dimensions');
    const modalUrl = document.getElementById('modal-figure-url');
    const modalStatusRadios = document.querySelectorAll('input[name="modal-figure-status"]');
    const modalPriceLabel = document.getElementById('modal-price-label');
    const modalActualPrice = document.getElementById('modal-actual-price');
    const modalRemainingPaymentContainer = document.getElementById('modal-remaining-payment-container');
    const modalRemainingPayment = document.getElementById('modal-remaining-payment');
    const modalUpdateBtn = document.getElementById('modal-update-btn');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const closeModalBtn = document.querySelector('.close-modal');
    
    // Current figure data and filters
    let currentFigureData = null;
    let currentFilter = 'all';
    let currentSearchTerm = '';
    let allFigures = [];
    
    // Load figures on page load
    loadFigures();
    
    // Event listeners
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            currentFilter = filter;
            Utils.setActiveFilter(filter, filterBtns);
            filterFigures();
        });
    });
    
    searchBtn.addEventListener('click', function() {
        currentSearchTerm = searchInput.value.trim().toLowerCase();
        filterFigures();
    });
    
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            currentSearchTerm = this.value.trim().toLowerCase();
            filterFigures();
        }
    });
    
    // Modal event listeners
    modalUpdateBtn.addEventListener('click', updateModalFigure);
    modalCloseBtn.addEventListener('click', closeModal);
    closeModalBtn.addEventListener('click', closeModal);
    
    // Add event listeners to modal status radios
    modalStatusRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const status = this.value;
            Utils.updatePriceLabel(status, modalPriceLabel);
            Utils.toggleRemainingPayment(status, modalRemainingPaymentContainer);
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target == figureModal) {
            closeModal();
        }
    });
    
    /**
     * Load all figures from API
     */
    async function loadFigures() {
        try {
            Utils.showLoading(true);
            
            allFigures = await Utils.fetchAPI('/api/figures');
            filterFigures();
            
        } catch (error) {
            console.error('Error loading figures:', error);
            noDataMessage.style.display = 'block';
            figuresTable.style.display = 'none';
        } finally {
            Utils.showLoading(false);
        }
    }
    
    /**
     * Filter and display figures based on current filter and search term
     */
    function filterFigures() {
        // Filter by status
        let filteredFigures = allFigures;
        if (currentFilter !== 'all') {
            filteredFigures = allFigures.filter(fig => fig.status === currentFilter);
        }
        
        // Filter by search term
        if (currentSearchTerm) {
            filteredFigures = filteredFigures.filter(fig => {
                return (
                    (fig['名称'] && fig['名称'].toLowerCase().includes(currentSearchTerm)) ||
                    (fig['制作'] && fig['制作'].toLowerCase().includes(currentSearchTerm)) ||
                    (fig['角色'] && fig['角色'].toLowerCase().includes(currentSearchTerm)) ||
                    (fig['作品'] && fig['作品'].toLowerCase().includes(currentSearchTerm))
                );
            });
        }
        
        // Update count
        filterCountNumber.textContent = filteredFigures.length;
        
        // Display figures or no data message
        if (filteredFigures.length === 0) {
            noDataMessage.style.display = 'block';
            figuresTable.style.display = 'none';
            return;
        }
        
        noDataMessage.style.display = 'none';
        figuresTable.style.display = 'table';
        
        // Render figures
        renderFiguresList(filteredFigures);
    }
    
    /**
     * Render figures list as table rows
     * @param {Array} figures - The figures to display
     */
    function renderFiguresList(figures) {
        figuresList.innerHTML = '';
        
        figures.forEach(figure => {
            const row = document.createElement('tr');
            row.setAttribute('data-uuid', figure.uuid);
            
            // Format status badge
            const statusBadge = Utils.getStatusBadge(figure.status);
            
            // Format price
            const priceDisplay = Utils.formatPrice(figure.actual_price);
            
            // Prepare remaining payment display if it's a preordered item
            let remainingPaymentDisplay = '';
            if (figure.status === 'preordered' && figure.remaining_payment > 0) {
                remainingPaymentDisplay = ` (尾款: ${Utils.formatPrice(figure.remaining_payment)})`;
            }
            
            row.innerHTML = `
                <td class="truncate" title="${figure['名称'] || 'Unknown'}">${figure['名称'] || 'Unknown'}</td>
                <td>${figure['制作'] || '--'}</td>
                <td>${figure['角色'] || '--'}</td>
                <td>${figure['作品'] || '--'}</td>
                <td>${figure['发售日'] || '--'}</td>
                <td>${statusBadge} ${remainingPaymentDisplay}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-details" data-uuid="${figure.uuid}">详情</button>
                    </div>
                </td>
            `;
            
            // Add click event to the details button
            row.querySelector('.btn-details').addEventListener('click', function() {
                const uuid = this.getAttribute('data-uuid');
                openFigureModal(uuid);
            });
            
            figuresList.appendChild(row);
        });
    }
    

    function makeFieldEditable(cellId, fieldKey) {
        const cell = document.getElementById(cellId);
        if (!cell) return;

        // 创建可编辑结构
        cell.innerHTML = `
            <div class="editable-field">
                <input type="text" 
                       class="editable-input" 
                       value="${currentFigureData[fieldKey] || ''}" 
                       placeholder="点击编辑"
                       data-field="${fieldKey}"
                >
                <i class="fas fa-edit edit-icon" title="编辑"></i>
            </div>
        `;

        const input = cell.querySelector('.editable-input');
        const editIcon = cell.querySelector('.edit-icon');

        // 切换编辑状态
        function toggleEdit(edit = true) {
            input.readOnly = !edit;
            input.classList.toggle('editable-input', edit);
        }

        // 初始状态为只读
        toggleEdit(false);

        // 编辑图标点击事件
        editIcon.addEventListener('click', () => {
            toggleEdit(true);
            input.focus();
        });

        // 失去焦点时保存
        input.addEventListener('blur', async () => {
            const newValue = input.value.trim();
            const field = input.getAttribute('data-field');



            try {
                // 准备更新数据
                const updateData = {
                    [field]: newValue
                };

                // 调用更新接口
                const updatedFigure = await Utils.fetchAPI(`/api/figures/update/${currentFigureData.uuid}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updateData)
                });

                // 更新当前图数据
                currentFigureData = updatedFigure;

                // 切换回只读状态
                toggleEdit(false);

                // 更新列表显示
                const index = allFigures.findIndex(fig => fig.uuid === updatedFigure.uuid);
                if (index !== -1) {
                    allFigures[index] = updatedFigure;
                }

                // 刷新列表
                filterFigures();

                Utils.showSuccess('信息更新成功！');

            } catch (error) {
                console.error('更新失败:', error);
                Utils.showError('更新失败，请重试');
            }
        });

        // 回车键保存
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        });
    }


    /**
     * Open modal with figure details
     * @param {string} uuid - The figure's UUID
     */
    async function openFigureModal(uuid) {
        if (!uuid) return;
        
        try {
            Utils.showLoading(true);
            
            const figure = await Utils.fetchAPI(`/api/figures/${uuid}`);
            currentFigureData = figure;
            
            // Populate modal with figure data
            modalTitle.textContent = figure['名称'] || '未知手办';
            
            if (figure.main_image) {
                modalImage.src = figure.main_image;
                modalImage.alt = figure['名称'] || '手办图片';
            } else {
                modalImage.src = 'placeholder.jpg';
            }
            
            modalPrice.textContent = figure['定价'] || '--';
            modalReleaseDate.textContent = figure['发售日'] || '--';
            modalReleaseYear.innerHTML = `
                <div class="editable-field">
                    <input type="number" 
                           class="editable-input" 
                           value="${figure['发售年份'] || ''}" 
                           placeholder="输入发售年份" 
                           min="1900" 
                           max="2099"
                           data-field="发售年份"
                    >
                    <i class="fas fa-edit edit-icon" title="编辑"></i>
                </div>
            `;
            modalScale.textContent = figure['比例'] || '--';
            modalManufacturer.textContent = figure['制作'] || '--';
            modalCharacter.textContent = figure['角色'] || '--';
            modalSeries.textContent = figure['作品'] || '--';
            modalDimensions.textContent = figure['尺寸'] || '--';
            
            modalUrl.textContent = figure.url || '--';
            modalUrl.href = figure.url || '#';
            makeFieldEditable('modal-figure-release-year', '发售年份');
            makeFieldEditable('modal-figure-character', '角色');

            // Set status and price
            const status = figure.status || 'tracking';
            const statusRadio = document.querySelector(`input[name="modal-figure-status"][value="${status}"]`);
            if (statusRadio) {
                statusRadio.checked = true;
            }
            
            if (modalActualPrice) {
                modalActualPrice.value = figure.actual_price || '';
            }
            
            if (modalRemainingPayment) {
                modalRemainingPayment.value = figure.remaining_payment || '';
            }
            
            Utils.updatePriceLabel(status, modalPriceLabel);
            
            if (modalRemainingPaymentContainer) {
                Utils.toggleRemainingPayment(status, modalRemainingPaymentContainer);
            }
            
            // Show modal
            figureModal.style.display = 'block';
            
        } catch (error) {
            console.error('Error loading figure details:', error);
            Utils.showError('加载手办详情失败：' + error.message);
        } finally {
            Utils.showLoading(false);
        }
    }
    
    async function updateModalFigure() {
        if (!currentFigureData || !currentFigureData.uuid) {
            Utils.showError('没有选择手办');
            return;
        }
        
        const statusRadio = document.querySelector('input[name="modal-figure-status"]:checked');
        if (!statusRadio) {
            Utils.showError('请选择状态');
            return;
        }
        
        const status = statusRadio.value;
        const priceStr = modalActualPrice ? modalActualPrice.value.trim() : '';
        
        if (!priceStr) {
            Utils.showError('请输入价格');
            return;
        }
        
        const price = parseFloat(priceStr);
        
        // Get remaining payment if it's a preordered item
        let remainingPayment = 0;
        if (status === 'preordered' && modalRemainingPayment) {
            const remainingStr = modalRemainingPayment.value.trim();
            if (!remainingStr) {
                Utils.showError('请输入待付尾款');
                return;
            }
            remainingPayment = parseFloat(remainingStr);
        }
        
        try {
            const updateData = {
                status: status,
                actual_price: price,
                remaining_payment: remainingPayment
            };
            
            const updatedFigure = await Utils.fetchAPI(`/api/figures/update/${currentFigureData.uuid}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });
            
            // Update current figure data and refresh list
            currentFigureData = updatedFigure;
            
            // Find and update the figure in allFigures array
            const index = allFigures.findIndex(fig => fig.uuid === updatedFigure.uuid);
            if (index !== -1) {
                allFigures[index] = updatedFigure;
            }
            
            // Refresh the display
            filterFigures();
            
            // Close the modal
            closeModal();
            
            Utils.showSuccess('手办信息更新成功！');
            
        } catch (error) {
            console.error('Error updating figure:', error);
            Utils.showError('更新手办信息失败');
        }
    }

    /**
     * Close the figure modal
     */
    function closeModal() {
        figureModal.style.display = 'none';
    }
});