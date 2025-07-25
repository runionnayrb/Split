/**
 * SplitMate - Expense Splitter for Couples
 * A simple web app to track and split shared expenses between two people
 */

class SplitMate {
    constructor() {
        // Initialize data structure for transactions
        this.transactions = [];
        this.totals = {
            me: 0,
            spouse: 0
        };
        
        // DOM elements
        this.form = document.getElementById('expenseForm');
        this.transactionsBody = document.getElementById('transactionsBody');
        this.myTotalElement = document.getElementById('myTotal');
        this.spouseTotalElement = document.getElementById('spouseTotal');
        this.netBalanceElement = document.getElementById('netBalance');
        this.settleUpBtn = document.getElementById('settleUpBtn');
        this.confirmModal = document.getElementById('confirmModal');
        this.confirmSettleBtn = document.getElementById('confirmSettle');
        this.cancelSettleBtn = document.getElementById('cancelSettle');
        
        // Receipt upload elements
        this.manualTab = document.getElementById('manualTab');
        this.receiptTab = document.getElementById('receiptTab');
        this.manualForm = document.getElementById('manualForm');
        this.receiptUpload = document.getElementById('receiptUpload');
        this.uploadArea = document.getElementById('uploadArea');
        this.receiptFile = document.getElementById('receiptFile');
        this.receiptPreview = document.getElementById('receiptPreview');
        this.previewImage = document.getElementById('previewImage');
        this.processReceiptBtn = document.getElementById('processReceipt');
        this.cancelUploadBtn = document.getElementById('cancelUpload');
        this.processingStatus = document.getElementById('processingStatus');
        this.receiptResults = document.getElementById('receiptResults');
        this.addReceiptItemsBtn = document.getElementById('addReceiptItems');
        this.clearReceiptBtn = document.getElementById('clearReceipt');
        
        // Receipt processing
        this.receiptProcessor = null;
        this.currentReceiptData = null;
        this.selectedReceiptItems = new Set();
        
        // Initialize the app
        this.init();
    }
    
    /**
     * Initialize the application - load data and set up event listeners
     */
    init() {
        this.loadFromStorage();
        this.setupEventListeners();
        this.updateDisplay();
        this.initializeReceiptProcessor();
    }
    
    /**
     * Initialize receipt processor with API key
     */
    async initializeReceiptProcessor() {
        try {
            // Get API key from environment or prompt user
            const apiKey = await this.getOpenAIKey();
            if (apiKey) {
                this.receiptProcessor = new ReceiptProcessor(apiKey);
            } else {
                console.warn('OpenAI API key not available - receipt scanning disabled');
                this.disableReceiptTab();
            }
        } catch (error) {
            console.error('Failed to initialize receipt processor:', error);
            this.disableReceiptTab();
        }
    }
    
    /**
     * Check if OpenAI API is available on server
     */
    async getOpenAIKey() {
        try {
            const response = await fetch('/api/openai-available');
            if (response.ok) {
                const data = await response.json();
                return data.available ? 'server-side-available' : null;
            }
        } catch (error) {
            console.log('Server API not available');
        }
        return null;
    }
    
    /**
     * Disable receipt tab if API key not available
     */
    disableReceiptTab() {
        this.receiptTab.disabled = true;
        this.receiptTab.style.opacity = '0.5';
        this.receiptTab.title = 'Receipt scanning requires OpenAI API key';
    }
    
    /**
     * Set up all event listeners for the application
     */
    setupEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTransaction();
        });
        
        // Settle up button
        this.settleUpBtn.addEventListener('click', () => {
            this.showConfirmModal();
        });
        
        // Modal buttons
        this.confirmSettleBtn.addEventListener('click', () => {
            this.settleUp();
            this.hideConfirmModal();
        });
        
        this.cancelSettleBtn.addEventListener('click', () => {
            this.hideConfirmModal();
        });
        
        // Click outside modal to close
        this.confirmModal.addEventListener('click', (e) => {
            if (e.target === this.confirmModal) {
                this.hideConfirmModal();
            }
        });
        
        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.confirmModal.style.display === 'block') {
                this.hideConfirmModal();
            }
        });
        
        // Tab switching
        this.manualTab.addEventListener('click', () => {
            this.switchTab('manual');
        });
        
        this.receiptTab.addEventListener('click', () => {
            if (!this.receiptTab.disabled) {
                this.switchTab('receipt');
            }
        });
        
        // Receipt upload events
        this.setupReceiptUploadListeners();
    }
    
    /**
     * Set up receipt upload event listeners
     */
    setupReceiptUploadListeners() {
        // File input change
        this.receiptFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFileSelect(file);
            }
        });
        
        // Upload area click
        this.uploadArea.addEventListener('click', () => {
            this.receiptFile.click();
        });
        
        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });
        
        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });
        
        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });
        
        // Preview buttons
        this.processReceiptBtn.addEventListener('click', () => {
            this.processCurrentReceipt();
        });
        
        this.cancelUploadBtn.addEventListener('click', () => {
            this.clearReceiptUpload();
        });
        
        // Receipt results buttons
        this.addReceiptItemsBtn.addEventListener('click', () => {
            this.addSelectedReceiptItems();
        });
        
        this.clearReceiptBtn.addEventListener('click', () => {
            this.clearReceiptResults();
        });
    }
    
    /**
     * Switch between manual and receipt tabs
     */
    switchTab(tabName) {
        if (tabName === 'manual') {
            this.manualTab.classList.add('active');
            this.receiptTab.classList.remove('active');
            this.manualForm.style.display = 'block';
            this.receiptUpload.classList.add('hidden');
            this.receiptResults.classList.add('hidden');
        } else if (tabName === 'receipt') {
            this.receiptTab.classList.add('active');
            this.manualTab.classList.remove('active');
            this.manualForm.style.display = 'none';
            this.receiptUpload.classList.remove('hidden');
        }
    }
    
    /**
     * Handle file selection for receipt upload
     */
    async handleFileSelect(file) {
        try {
            if (!this.receiptProcessor) {
                throw new Error('Receipt processor not initialized');
            }
            
            // Validate file
            this.receiptProcessor.validateImageFile(file);
            
            // Show preview
            const imageUrl = URL.createObjectURL(file);
            this.previewImage.src = imageUrl;
            this.receiptPreview.classList.remove('hidden');
            this.uploadArea.style.display = 'none';
            
            // Store file for processing
            this.currentReceiptFile = file;
            
        } catch (error) {
            alert(error.message);
            this.clearReceiptUpload();
        }
    }
    
    /**
     * Process the current receipt image
     */
    async processCurrentReceipt() {
        if (!this.currentReceiptFile || !this.receiptProcessor) {
            return;
        }
        
        try {
            // Show processing status
            this.receiptPreview.classList.add('hidden');
            this.processingStatus.classList.remove('hidden');
            
            // Convert image to base64 and process
            const base64Image = await this.receiptProcessor.imageToBase64(this.currentReceiptFile);
            const receiptData = await this.receiptProcessor.processReceipt(base64Image);
            
            // Store receipt data
            this.currentReceiptData = receiptData;
            
            // Hide processing status
            this.processingStatus.classList.add('hidden');
            
            // Show results
            this.displayReceiptResults(receiptData);
            
        } catch (error) {
            console.error('Receipt processing error:', error);
            this.processingStatus.classList.add('hidden');
            this.receiptPreview.classList.remove('hidden');
            
            let errorMessage = 'Failed to process receipt. ';
            if (error.message.includes('API')) {
                errorMessage += 'Please check your internet connection and try again.';
            } else {
                errorMessage += 'Please try with a clearer image.';
            }
            
            alert(errorMessage);
        }
    }
    
    /**
     * Display receipt processing results
     */
    displayReceiptResults(receiptData) {
        // Clear existing results
        const itemsList = document.getElementById('receiptItemsList');
        itemsList.innerHTML = '';
        this.selectedReceiptItems.clear();
        
        // Create item checkboxes
        receiptData.items.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'receipt-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `item-${index}`;
            checkbox.className = 'item-checkbox';
            checkbox.checked = true;
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.selectedReceiptItems.add(index);
                    itemDiv.classList.add('selected');
                } else {
                    this.selectedReceiptItems.delete(index);
                    itemDiv.classList.remove('selected');
                }
                this.updateReceiptSummary();
            });
            
            const itemDetails = document.createElement('div');
            itemDetails.className = 'item-details';
            itemDetails.innerHTML = `
                <span class="item-name">${item.name}</span>
                <span class="item-price">${this.formatCurrency(item.price)}</span>
            `;
            
            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(itemDetails);
            itemsList.appendChild(itemDiv);
            
            // Start with all items selected
            this.selectedReceiptItems.add(index);
            itemDiv.classList.add('selected');
        });
        
        // Update summary
        this.updateReceiptSummary();
        
        // Show results section
        this.receiptResults.classList.remove('hidden');
    }
    
    /**
     * Update receipt summary based on selected items
     */
    updateReceiptSummary() {
        if (!this.currentReceiptData) return;
        
        let selectedSubtotal = 0;
        this.selectedReceiptItems.forEach(index => {
            selectedSubtotal += this.currentReceiptData.items[index].price;
        });
        
        // Calculate proportional fees (tax, tip, delivery fees split 50/50)
        const totalFees = this.currentReceiptData.tax + this.currentReceiptData.tip + this.currentReceiptData.fees;
        const selectedTotal = selectedSubtotal + (totalFees / 2); // Split fees 50/50
        
        // Update display
        document.getElementById('receiptSubtotal').textContent = this.formatCurrency(selectedSubtotal);
        document.getElementById('receiptFees').textContent = this.formatCurrency(totalFees / 2);
        document.getElementById('receiptTotal').textContent = this.formatCurrency(selectedTotal);
    }
    
    /**
     * Add selected receipt items to transactions
     */
    addSelectedReceiptItems() {
        if (!this.currentReceiptData || this.selectedReceiptItems.size === 0) {
            alert('Please select at least one item to add.');
            return;
        }
        
        const whoPaid = document.getElementById('receiptWhoPaid').value;
        const timestamp = Date.now();
        
        // Add individual items
        this.selectedReceiptItems.forEach(index => {
            const item = this.currentReceiptData.items[index];
            
            const transaction = {
                id: timestamp + index,
                date: new Date().toISOString(),
                whoPaid: whoPaid,
                amount: item.price,
                category: item.category,
                notes: `${item.name} (from receipt)`,
                youOwe: whoPaid === 'spouse' ? item.price / 2 : -(item.price / 2)
            };
            
            this.transactions.unshift(transaction);
            this.totals[whoPaid] += item.price;
        });
        
        // Add shared fees as a separate transaction if there are any
        const totalFees = this.currentReceiptData.tax + this.currentReceiptData.tip + this.currentReceiptData.fees;
        if (totalFees > 0) {
            const feesTransaction = {
                id: timestamp + 1000,
                date: new Date().toISOString(),
                whoPaid: whoPaid,
                amount: totalFees,
                category: 'other',
                notes: 'Tax, tips & fees (split 50/50)',
                youOwe: whoPaid === 'spouse' ? totalFees / 2 : -(totalFees / 2)
            };
            
            this.transactions.unshift(feesTransaction);
            this.totals[whoPaid] += totalFees;
        }
        
        // Save and update display
        this.saveToStorage();
        this.updateDisplay();
        
        // Show success message (before clearing data)
        const itemCount = this.selectedReceiptItems.size;
        const feeText = totalFees > 0 ? ' and shared fees' : '';
        alert(`Successfully added ${itemCount} item${itemCount > 1 ? 's' : ''}${feeText} from receipt!`);
        
        // Clear receipt and return to manual tab
        this.clearReceiptResults();
        this.switchTab('manual');
    }
    
    /**
     * Clear receipt upload
     */
    clearReceiptUpload() {
        this.receiptFile.value = '';
        this.currentReceiptFile = null;
        this.receiptPreview.classList.add('hidden');
        this.processingStatus.classList.add('hidden');
        this.uploadArea.style.display = 'block';
        
        if (this.previewImage.src) {
            URL.revokeObjectURL(this.previewImage.src);
            this.previewImage.src = '';
        }
    }
    
    /**
     * Clear receipt results
     */
    clearReceiptResults() {
        this.receiptResults.classList.add('hidden');
        this.currentReceiptData = null;
        this.selectedReceiptItems.clear();
        this.clearReceiptUpload();
    }
    
    /**
     * Add a new transaction from the form data
     */
    addTransaction() {
        // Get form data
        const whoPaid = document.getElementById('whoPaid').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const category = document.getElementById('category').value;
        const notes = document.getElementById('notes').value.trim();
        
        // Validate amount
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount greater than 0.');
            return;
        }
        
        // Create transaction object
        const transaction = {
            id: Date.now(), // Simple ID using timestamp
            date: new Date().toISOString(),
            whoPaid: whoPaid,
            amount: amount,
            category: category,
            notes: notes || '',
            // For 50/50 split, each person owes half of what the other paid
            youOwe: whoPaid === 'spouse' ? amount / 2 : -(amount / 2)
        };
        
        // Add to transactions array (newest first)
        this.transactions.unshift(transaction);
        
        // Update totals
        this.totals[whoPaid] += amount;
        
        // Save to localStorage
        this.saveToStorage();
        
        // Update display
        this.updateDisplay();
        
        // Reset form
        this.form.reset();
        
        // Focus back to amount field for quick entry
        document.getElementById('amount').focus();
    }
    
    /**
     * Update all display elements with current data
     */
    updateDisplay() {
        this.updateBalanceDisplay();
        this.updateTransactionTable();
        this.updateSettleUpButton();
    }
    
    /**
     * Update the balance summary at the top
     */
    updateBalanceDisplay() {
        // Update individual totals
        this.myTotalElement.textContent = this.formatCurrency(this.totals.me);
        this.spouseTotalElement.textContent = this.formatCurrency(this.totals.spouse);
        
        // Calculate net balance (positive means you owe, negative means spouse owes you)
        const netBalance = (this.totals.spouse - this.totals.me) / 2;
        
        // Update net balance display
        this.netBalanceElement.className = 'net-balance';
        
        if (Math.abs(netBalance) < 0.01) {
            // Essentially settled up
            this.netBalanceElement.textContent = 'All settled up! 🎉';
        } else if (netBalance > 0) {
            // You owe spouse
            this.netBalanceElement.textContent = `You owe your spouse ${this.formatCurrency(netBalance)}`;
            this.netBalanceElement.classList.add('you-owe');
        } else {
            // Spouse owes you
            this.netBalanceElement.textContent = `Your spouse owes you ${this.formatCurrency(Math.abs(netBalance))}`;
            this.netBalanceElement.classList.add('spouse-owes');
        }
    }
    
    /**
     * Update the transaction history table
     */
    updateTransactionTable() {
        // Clear existing rows
        this.transactionsBody.innerHTML = '';
        
        if (this.transactions.length === 0) {
            // Show empty state
            const row = document.createElement('tr');
            row.className = 'no-transactions';
            row.innerHTML = '<td colspan="6">No transactions yet. Add your first expense above! 👆</td>';
            this.transactionsBody.appendChild(row);
            return;
        }
        
        // Add transaction rows
        this.transactions.forEach(transaction => {
            const row = document.createElement('tr');
            
            // Format date
            const date = new Date(transaction.date);
            const dateStr = date.toLocaleDateString();
            
            // Get category display with emoji
            const categoryDisplay = this.getCategoryDisplay(transaction.category);
            
            // Format who paid
            const whoPaidDisplay = transaction.whoPaid === 'me' ? 'You' : 'Spouse';
            
            // Format you owe amount
            const youOweAmount = transaction.youOwe;
            let youOweDisplay = '';
            let youOweClass = 'you-owe-cell';
            
            if (Math.abs(youOweAmount) < 0.01) {
                youOweDisplay = '-';
            } else if (youOweAmount > 0) {
                youOweDisplay = this.formatCurrency(youOweAmount);
                youOweClass += ' you-owe-positive';
            } else {
                youOweDisplay = `(${this.formatCurrency(Math.abs(youOweAmount))})`;
                youOweClass += ' you-owe-negative';
            }
            
            row.innerHTML = `
                <td>${dateStr}</td>
                <td><strong>${whoPaidDisplay}</strong></td>
                <td class="amount-cell">${this.formatCurrency(transaction.amount)}</td>
                <td class="category-cell">${categoryDisplay}</td>
                <td>${transaction.notes}</td>
                <td class="${youOweClass}">${youOweDisplay}</td>
            `;
            
            this.transactionsBody.appendChild(row);
        });
    }
    
    /**
     * Update the settle up button state
     */
    updateSettleUpButton() {
        const hasTransactions = this.transactions.length > 0;
        this.settleUpBtn.disabled = !hasTransactions;
    }
    
    /**
     * Get category display with emoji
     */
    getCategoryDisplay(category) {
        const categoryMap = {
            'groceries': '🛒 Groceries',
            'dining': '🍽️ Dining',
            'travel': '✈️ Travel',
            'shopping': '🛍️ Shopping',
            'other': '📋 Other'
        };
        return categoryMap[category] || category;
    }
    
    /**
     * Format number as currency
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }
    
    /**
     * Show the settle up confirmation modal
     */
    showConfirmModal() {
        this.confirmModal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
    
    /**
     * Hide the settle up confirmation modal
     */
    hideConfirmModal() {
        this.confirmModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore scrolling
    }
    
    /**
     * Settle up - reset all balances and clear transaction history
     */
    settleUp() {
        // Reset all data
        this.transactions = [];
        this.totals = {
            me: 0,
            spouse: 0
        };
        
        // Save empty state to localStorage
        this.saveToStorage();
        
        // Update display
        this.updateDisplay();
        
        // Show success message briefly
        const originalText = this.netBalanceElement.textContent;
        this.netBalanceElement.textContent = 'Successfully settled up! ✅';
        this.netBalanceElement.className = 'net-balance';
        
        setTimeout(() => {
            this.updateBalanceDisplay();
        }, 2000);
    }
    
    /**
     * Save current data to localStorage
     */
    saveToStorage() {
        const data = {
            transactions: this.transactions,
            totals: this.totals,
            lastUpdated: new Date().toISOString()
        };
        
        try {
            localStorage.setItem('splitmate-data', JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save data to localStorage:', error);
            alert('Warning: Your data could not be saved. Please check if your browser supports localStorage.');
        }
    }
    
    /**
     * Load data from localStorage
     */
    loadFromStorage() {
        try {
            const savedData = localStorage.getItem('splitmate-data');
            
            if (savedData) {
                const data = JSON.parse(savedData);
                
                // Validate data structure
                if (data.transactions && data.totals) {
                    this.transactions = data.transactions;
                    this.totals = data.totals;
                } else {
                    console.warn('Invalid data structure in localStorage, starting fresh');
                }
            }
        } catch (error) {
            console.error('Failed to load data from localStorage:', error);
            // Continue with empty data
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create global instance
    window.splitMateApp = new SplitMate();
    
    // Focus on amount field for immediate use on desktop, skip on mobile to prevent keyboard popup
    if (window.innerWidth > 768) {
        document.getElementById('amount').focus();
    }
    
    // Add touch-friendly behavior for iOS
    if (navigator.platform.match(/iPhone|iPad|iPod/)) {
        document.body.classList.add('ios-device');
        
        // Prevent zoom on input focus for iOS
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('focus', function() {
                if (input.type !== 'number') {
                    input.style.fontSize = '16px';
                }
            });
        });
        
        // Add haptic feedback simulation for buttons (visual feedback)
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            button.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.95)';
            });
            button.addEventListener('touchend', function() {
                this.style.transform = 'scale(1)';
            });
        });
    }
});

// Service worker registration for offline capability (future enhancement)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Note: Service worker file not implemented in this MVP
        // Can be added later for offline functionality
    });
}

// Handle browser back/forward button (maintain state)
window.addEventListener('popstate', (event) => {
    if (window.splitMateApp) {
        window.splitMateApp.updateDisplay();
    }
});

// Auto-save on page unload (backup)
window.addEventListener('beforeunload', () => {
    if (window.splitMateApp) {
        window.splitMateApp.saveToStorage();
    }
});

// Utility function for debugging (can be removed in production)
window.debugSplitMate = () => {
    if (window.splitMateApp) {
        console.log('Current transactions:', window.splitMateApp.transactions);
        console.log('Current totals:', window.splitMateApp.totals);
        console.log('LocalStorage data:', JSON.parse(localStorage.getItem('splitmate-data') || '{}'));
    }
};
