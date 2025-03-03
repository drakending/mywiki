/**
 * Scraper page functionality
 */
document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const urlInput = document.getElementById('url-input');
    const scrapeBtn = document.getElementById('scrape-btn');
    const figureData = document.getElementById('figure-data');
    const figureTitle = document.getElementById('figure-title');
    const figureImage = document.getElementById('figure-image');
    const figurePrice = document.getElementById('figure-price');
    const figureReleaseDate = document.getElementById('figure-release-date');
    const figureReleaseYear = document.getElementById('figure-release-year');
    const figureScale = document.getElementById('figure-scale');
    const figureManufacturer = document.getElementById('figure-manufacturer');
    const figureCharacter = document.getElementById('figure-character');
    const figureSeries = document.getElementById('figure-series');
    const figureDimensions = document.getElementById('figure-dimensions');
    const figureUrl = document.getElementById('figure-url');
    const saveJsonBtn = document.getElementById('save-json-btn');
    
    // Status related elements
    const statusRadios = document.querySelectorAll('input[name="figure-status"]');
    const priceLabel = document.getElementById('price-label');
    const actualPriceInput = document.getElementById('actual-price');
    const remainingPaymentContainer = document.getElementById('remaining-payment-container');
    const remainingPaymentInput = document.getElementById('remaining-payment');
    const updateStatusBtn = document.getElementById('update-status-btn');
    const saveToDbBtn = document.getElementById('save-to-db-btn');
    
    // Current figure data
    let currentFigureData = null;
    
    // Event listeners
    scrapeBtn.addEventListener('click', scrapeFigure);
    saveJsonBtn.addEventListener('click', saveJson);
    updateStatusBtn.addEventListener('click', updateFigureStatus);
    saveToDbBtn.addEventListener('click', saveFigureToDatabase);
    urlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            scrapeFigure();
        }
    });
    
    // Add event listeners to status radios
    statusRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const status = this.value;
            Utils.updatePriceLabel(status, priceLabel);
            Utils.toggleRemainingPayment(status, remainingPaymentContainer);
        });
    });
    
    /**
     * Scrape figure data from URL
     */
    async function scrapeFigure() {
        const url = urlInput.value.trim();
        if (!url) {
            Utils.showError('请输入有效的链接');
            return;
        }
        
        try {
            Utils.showLoading(true);
            Utils.hideError();
            hideFigureData();
            
            const data = await Utils.fetchAPI('/api/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url })
            });
            
            currentFigureData = data;
            displayFigureData(data);
            
            // Update status inputs to match data
            updateStatusInputs(data);
            
        } catch (error) {
            console.error('Error scraping figure:', error);
        } finally {
            Utils.showLoading(false);
        }
    }
    
    /**
     * Update status inputs to match figure data
     * @param {Object} data - The figure data
     */
    function updateStatusInputs(data) {
        const status = data.status || 'tracking';
        document.querySelector(`input[name="figure-status"][value="${status}"]`).checked = true;
        actualPriceInput.value = data.actual_price || '';
        remainingPaymentInput.value = data.remaining_payment || '';
        
        Utils.updatePriceLabel(status, priceLabel);
        Utils.toggleRemainingPayment(status, remainingPaymentContainer);
    }
    
    /**
     * Update figure status and price
     */
    async function updateFigureStatus() {
        if (!currentFigureData || !currentFigureData.uuid) {
            Utils.showError('没有选择手办');
            return;
        }
        
        const status = document.querySelector('input[name="figure-status"]:checked').value;
        const priceStr = actualPriceInput.value.trim();
        
        if (!priceStr) {
            Utils.showError('请输入价格');
            return;
        }
        
        const price = parseFloat(priceStr);
        
        // Get remaining payment if it's a preordered item
        let remainingPayment = 0;
        if (status === 'preordered') {
            const remainingStr = remainingPaymentInput.value.trim();
            if (!remainingStr) {
                Utils.showError('请输入待付尾款');
                return;
            }
            remainingPayment = parseFloat(remainingStr);
        }
        
        try {
            // Update the figure data without saving to database yet
            currentFigureData.status = status;
            currentFigureData.actual_price = price;
            currentFigureData.remaining_payment = remainingPayment;
            
            Utils.showSuccess('状态已更新！（尚未保存到数据库）');
            
        } catch (error) {
            console.error('Error updating figure:', error);
        }
    }
    
    /**
     * Save figure data to database
     */
    async function saveFigureToDatabase() {
        if (!currentFigureData || !currentFigureData.uuid) {
            Utils.showError('没有选择手办');
            return;
        }
        
        // Update status and price before saving
        const status = document.querySelector('input[name="figure-status"]:checked').value;
        const priceStr = actualPriceInput.value.trim();
        
        if (!priceStr) {
            Utils.showError('请输入价格');
            return;
        }
        
        const price = parseFloat(priceStr);
        
        // Get remaining payment if it's a preordered item
        let remainingPayment = 0;
        if (status === 'preordered') {
            const remainingStr = remainingPaymentInput.value.trim();
            if (!remainingStr) {
                Utils.showError('请输入待付尾款');
                return;
            }
            remainingPayment = parseFloat(remainingStr);
        }
        
        // Update current figure data
        currentFigureData.status = status;
        currentFigureData.actual_price = price;
        currentFigureData.remaining_payment = remainingPayment;
        
        try {
            // Save to database
            const savedFigure = await Utils.saveFigureToDatabase(currentFigureData);
            currentFigureData = savedFigure;
            
            // Show confirmation
            Utils.showSuccess('手办已成功保存到数据库！');
            
        } catch (error) {
            console.error('Error saving figure to database:', error);
        }
    }
    
    /**
     * Display figure data in the UI
     * @param {Object} data - The figure data
     */
    function displayFigureData(data) {
        figureTitle.textContent = data['名称'] || '未知手办';
        
        if (data.main_image) {
            figureImage.src = data.main_image;
            figureImage.alt = data['名称'] || '手办图片';
        } else {
            figureImage.src = 'placeholder.jpg';
        }
        
        figurePrice.textContent = data['定价'] || '--';
        figureReleaseDate.textContent = data['发售日'] || '--';
        figureReleaseYear.textContent = data['发售年份'] || '--';
        figureScale.textContent = data['比例'] || '--';
        figureManufacturer.textContent = data['制作'] || '--';
        figureCharacter.textContent = data['角色'] || '--';
        figureSeries.textContent = data['作品'] || '--';
        figureDimensions.textContent = data['尺寸'] || '--';
        
        figureUrl.textContent = data.url || '--';
        figureUrl.href = data.url || '#';
        
        figureData.style.display = 'block';
    }
    
    /**
     * Save figure data as JSON file
     */
    function saveJson() {
        if (!currentFigureData) return;
        
        const dataStr = JSON.stringify(currentFigureData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentFigureData['名称'] || 'figure'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    /**
     * Hide figure data
     */
    function hideFigureData() {
        figureData.style.display = 'none';
    }
});