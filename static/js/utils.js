/**
 * Utility functions for the Hpoi Figure Scraper
 */

// Utility object to hold shared functions
const Utils = {
    /**
     * Shows the loading indicator
     * @param {boolean} show - Whether to show or hide the indicator
     */
    showLoading: function(show) {
        const loadingIndicator = document.getElementById('loading');
        if (loadingIndicator) {
            loadingIndicator.style.display = show ? 'block' : 'none';
        }
    },

    /**
     * Shows an error message
     * @param {string} message - The error message to display
     */
    showError: function(message) {
        const errorText = document.getElementById('error-text');
        const errorMessage = document.getElementById('error-message');
        
        if (errorText && errorMessage) {
            errorText.textContent = message;
            errorMessage.style.display = 'flex';
            errorMessage.classList.remove('success-message');
        }
    },

    /**
     * Shows a success message
     * @param {string} message - The success message to display
     * @param {number} timeout - Time in ms before the message disappears (default: 3000)
     */
    showSuccess: function(message, timeout = 3000) {
        const errorText = document.getElementById('error-text');
        const errorMessage = document.getElementById('error-message');
        
        if (errorText && errorMessage) {
            errorText.textContent = message;
            errorMessage.style.display = 'flex';
            errorMessage.classList.add('success-message');
            
            // Auto hide after timeout
            setTimeout(function() {
                Utils.hideError();
            }, timeout);
        }
    },

    /**
     * Hides the error/success message
     */
    hideError: function() {
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
            errorMessage.style.display = 'none';
        }
    },

    /**
     * Fetches data from the API
     * @param {string} url - The API endpoint URL
     * @param {Object} options - Fetch options
     * @returns {Promise} - Resolves to the JSON response
     */
    fetchAPI: async function(url, options = {}) {
        try {
            const response = await fetch(url, options);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            return data;
        } catch (error) {
            Utils.showError(`请求出错: ${error.message}`);
            throw error;
        }
    },

    /**
     * Updates a figure's status, price, and remaining payment
     * @param {string} uuid - The figure's UUID
     * @param {string} status - The new status ('tracking', 'preordered', or 'purchased')
     * @param {number} price - The price value
     * @param {number} remainingPayment - The remaining payment value (for preordered items)
     * @returns {Promise} - Resolves to the updated figure data
     */
    updateFigureStatus: async function(uuid, status, price, remainingPayment = 0) {
        if (!uuid) {
            Utils.showError('没有选择手办');
            throw new Error('没有选择手办');
        }
        
        if (isNaN(price) || price < 0) {
            Utils.showError('请输入有效的价格');
            throw new Error('请输入有效的价格');
        }
        
        if (status === 'preordered' && (isNaN(remainingPayment) || remainingPayment < 0)) {
            Utils.showError('请输入有效的待付尾款');
            throw new Error('请输入有效的待付尾款');
        }
        
        try {
            Utils.showLoading(true);
            Utils.hideError();
            
            const data = await Utils.fetchAPI(`/api/figures/update/${uuid}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: status,
                    actual_price: price,
                    remaining_payment: remainingPayment
                })
            });
            
            Utils.showSuccess('状态更新成功！');
            
            return data.figure;
        } finally {
            Utils.showLoading(false);
        }
    },

    /**
     * Saves figure data to database (after confirmation)
     * @param {Object} figureData - The figure data to save
     * @returns {Promise} - Resolves to the saved figure data
     */
    saveFigureToDatabase: async function(figureData) {
        if (!figureData || !figureData.uuid || !figureData.url) {
            Utils.showError('没有可用的手办数据');
            throw new Error('没有可用的手办数据');
        }
        
        try {
            Utils.showLoading(true);
            Utils.hideError();
            
            const data = await Utils.fetchAPI('/api/figures/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(figureData)
            });
            
            Utils.showSuccess('手办已成功保存到数据库！');
            
            return data;
        } finally {
            Utils.showLoading(false);
        }
    },

    /**
     * Gets a badge HTML for a status
     * @param {string} status - The status ('tracking', 'preordered', or 'purchased')
     * @returns {string} - HTML for the badge
     */
    getStatusBadge: function(status) {
        let statusText = '追踪中';
        if (status === 'purchased') {
            statusText = '已购入';
        } else if (status === 'preordered') {
            statusText = '已预订';
        }
        return `<span class="badge badge-${status}">${statusText}</span>`;
    },

    /**
     * Formats a price for display
     * @param {number} price - The price value
     * @returns {string} - Formatted price string
     */
    formatPrice: function(price) {
        if (!price) return '--';
        return `¥${parseFloat(price).toFixed(2)}`;
    },

    /**
     * Sets the active filter button
     * @param {string} filter - The filter to activate
     * @param {NodeList} filterBtns - The filter buttons
     */
    setActiveFilter: function(filter, filterBtns) {
        filterBtns.forEach(btn => {
            if (btn.getAttribute('data-filter') === filter) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    },

    /**
     * Update price label based on status
     * @param {string} status - The status ('tracking', 'preordered', or 'purchased')
     * @param {HTMLElement} priceLabel - The price label element
     */
    updatePriceLabel: function(status, priceLabel) {
        if (priceLabel) {
            if (status === 'tracking') {
                priceLabel.textContent = '咸鱼现价 (元)';
            } else if (status === 'preordered') {
                priceLabel.textContent = '预订定金 (元)';
            } else if (status === 'purchased') {
                priceLabel.textContent = '购入价格 (元)';
            }
        }
    },
    
    /**
     * Toggle remaining payment input visibility based on status
     * @param {string} status - The status ('tracking', 'preordered', or 'purchased')
     * @param {HTMLElement} container - The remaining payment container element
     */
    toggleRemainingPayment: function(status, container) {
        if (container) {
            container.style.display = status === 'preordered' ? 'block' : 'none';
        }
    },

    /**
     * Truncates text if it's too long
     * @param {string} text - The text to truncate
     * @param {number} maxLength - Maximum length before truncation
     * @returns {string} - Truncated text
     */
    truncateText: function(text, maxLength = 25) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
};