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
    
    // Focus on amount field for immediate use
    document.getElementById('amount').focus();
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
