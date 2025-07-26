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
        this.transactionsBody = document.getElementById('transactionsBody'); // Legacy element (will be replaced)
        this.myTotalElement = document.getElementById('myTotal');
        this.spouseTotalElement = document.getElementById('spouseTotal');
        this.netBalanceElement = document.getElementById('netBalance');
        this.payAllBtn = document.getElementById('payAllBtn');
        this.confirmModal = document.getElementById('confirmModal');
        this.confirmPayAllBtn = document.getElementById('confirmPayAll');
        this.cancelPayAllBtn = document.getElementById('cancelPayAll');
        
        // Transaction tab elements
        this.unpaidTab = document.getElementById('unpaidTab');
        this.paidTab = document.getElementById('paidTab');
        this.unpaidTransactions = document.getElementById('unpaidTransactions');
        this.paidTransactions = document.getElementById('paidTransactions');
        this.unpaidTransactionsBody = document.getElementById('unpaidTransactionsBody');
        this.paidTransactionsBody = document.getElementById('paidTransactionsBody');
        
        // Individual payment modal elements (iOS style bottom sheet)
        this.payTransactionModal = document.getElementById('payTransactionModal');
        this.payTransactionDetails = document.getElementById('payTransactionDetails');
        this.payTransactionMessage = document.getElementById('payTransactionMessage');
        this.confirmPayTransactionBtn = document.getElementById('confirmPayTransaction');
        this.cancelPayTransactionBtn = document.getElementById('cancelPayTransaction');
        this.closeBottomSheetBtn = document.getElementById('closeBottomSheet');
        this.receiptImageContainer = document.getElementById('receiptImageContainer');
        this.receiptImage = document.getElementById('receiptImage');
        this.currentPaymentTransaction = null;
        
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
        this.splitReceiptItems = new Map(); // Track which items are set to split (50/50)
        
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
            } else {
                console.log('Server returned error:', response.status);
            }
        } catch (error) {
            console.log('Server API not available:', error);
        }
        
        // For now, enable receipt tab regardless of API availability for testing
        console.log('Enabling receipt tab for testing');
        return 'testing-mode';
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
        
        // Pay All button
        if (this.payAllBtn) {
            this.payAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showConfirmModal();
            });
        } else {
            console.error('Pay All button not found!');
        }
        
        // Modal buttons
        if (this.confirmPayAllBtn) {
            this.confirmPayAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.payAllTransactions();
                this.hideConfirmModal();
            });
        } else {
            console.error('Confirm Pay All button not found!');
        }
        
        if (this.cancelPayAllBtn) {
            this.cancelPayAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideConfirmModal();
            });
        } else {
            console.error('Cancel Pay All button not found!');
        }
        
        // Individual payment modal buttons
        if (this.confirmPayTransactionBtn) {
            this.confirmPayTransactionBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.payTransaction();
                this.hidePayTransactionModal();
            });
        } else {
            console.error('Confirm Pay Transaction button not found!');
        }
        
        if (this.cancelPayTransactionBtn) {
            this.cancelPayTransactionBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.hidePayTransactionModal();
            });
        } else {
            console.error('Cancel Pay Transaction button not found!');
        }
        
        if (this.closeBottomSheetBtn) {
            this.closeBottomSheetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.hidePayTransactionModal();
            });
        } else {
            console.error('Close bottom sheet button not found!');
        }
        
        // Click outside modal to close
        this.confirmModal.addEventListener('click', (e) => {
            if (e.target === this.confirmModal) {
                this.hideConfirmModal();
            }
        });
        
        // Bottom sheet backdrop click
        this.payTransactionModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('bottom-sheet-backdrop')) {
                this.hidePayTransactionModal();
            }
        });
        
        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.confirmModal.style.display === 'block') {
                    this.hideConfirmModal();
                } else if (this.payTransactionModal.style.display === 'block') {
                    this.hidePayTransactionModal();
                }
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
        
        // Transaction tabs
        this.unpaidTab.addEventListener('click', () => {
            this.switchTransactionTab('unpaid');
        });
        
        this.paidTab.addEventListener('click', () => {
            this.switchTransactionTab('paid');
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
            this.receiptProcessor.validateReceiptFile(file);
            
            // Check if it's a PDF
            const isPdf = this.receiptProcessor.isPdfFile(file);
            
            // Show appropriate preview
            this.receiptPreview.classList.remove('hidden');
            this.uploadArea.style.display = 'none';
            
            if (isPdf) {
                // Show PDF preview
                this.previewImage.classList.add('hidden');
                document.getElementById('pdfPreview').classList.remove('hidden');
                document.getElementById('pdfFileName').textContent = file.name;
            } else {
                // Show image preview
                document.getElementById('pdfPreview').classList.add('hidden');
                this.previewImage.classList.remove('hidden');
                const imageUrl = URL.createObjectURL(file);
                this.previewImage.src = imageUrl;
            }
            
            // Store file for processing
            this.currentReceiptFile = file;
            
        } catch (error) {
            alert(error.message);
            this.clearReceiptUpload();
        }
    }
    
    /**
     * Process the current receipt file (image or PDF)
     */
    async processCurrentReceipt() {
        if (!this.currentReceiptFile || !this.receiptProcessor) {
            return;
        }
        
        try {
            // Show processing status
            this.receiptPreview.classList.add('hidden');
            this.processingStatus.classList.remove('hidden');
            
            // Check if it's a PDF
            const isPdf = this.receiptProcessor.isPdfFile(this.currentReceiptFile);
            
            // Convert file to base64 and process
            const base64Data = await this.receiptProcessor.imageToBase64(this.currentReceiptFile);
            const receiptData = await this.receiptProcessor.processReceipt(base64Data, isPdf);
            
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
            } else if (error.message.includes('PDF')) {
                errorMessage += 'Please ensure the PDF is readable and contains a clear receipt.';
            } else {
                errorMessage += 'Please try with a clearer file.';
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
        this.splitReceiptItems.clear();
        
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
                    this.splitReceiptItems.delete(index); // Remove from split map if unselected
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
            
            // Create split toggle button
            const splitButton = document.createElement('button');
            splitButton.type = 'button';
            splitButton.className = 'split-toggle-btn active';
            splitButton.textContent = 'Split';
            splitButton.title = 'Split: Both pay 50%. Individual: Other person owes the payer';
            splitButton.addEventListener('click', (e) => {
                e.preventDefault();
                const isSplit = splitButton.classList.contains('active');
                if (isSplit) {
                    // Currently split, change to individual 
                    splitButton.classList.remove('active');
                    splitButton.textContent = 'Individual';
                    this.splitReceiptItems.delete(index);
                } else {
                    // Currently individual, change to split
                    splitButton.classList.add('active');
                    splitButton.textContent = 'Split';
                    this.splitReceiptItems.set(index, true);
                }
                this.updateReceiptSummary();
            });
            
            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(itemDetails);
            itemDiv.appendChild(splitButton);
            itemsList.appendChild(itemDiv);
            
            // Start with all items selected and set to split
            this.selectedReceiptItems.add(index);
            this.splitReceiptItems.set(index, true); // Default to split
            itemDiv.classList.add('selected');
        });
        
        // Update summary
        this.updateReceiptSummary();
        
        // Show results section
        this.receiptResults.classList.remove('hidden');
    }
    
    /**
     * Update receipt summary based on selected items and split settings
     */
    updateReceiptSummary() {
        if (!this.currentReceiptData) return;
        
        let grandTotal = 0;           // Total of ALL items on receipt
        let uncheckedTotal = 0;       // Items Bryan pays (unchecked)
        let individualTotal = 0;      // Items Ayako owes (individual)
        let splitTotal = 0;           // Items to split 50/50
        
        // Calculate grand total of ALL items on receipt
        this.currentReceiptData.items.forEach(item => {
            grandTotal += item.price;
        });
        
        // Calculate unchecked items (Bryan pays these)
        this.currentReceiptData.items.forEach((item, index) => {
            if (!this.selectedReceiptItems.has(index)) {
                uncheckedTotal += item.price;
            }
        });
        
        // Calculate checked items based on split settings
        this.selectedReceiptItems.forEach(index => {
            const itemPrice = this.currentReceiptData.items[index].price;
            
            if (this.splitReceiptItems.has(index)) {
                splitTotal += itemPrice;
            } else {
                individualTotal += itemPrice;
            }
        });
        
        // Calculate split portions for each person
        const bryanSplitPortion = splitTotal / 2;
        const ayakoSplitPortion = splitTotal / 2;
        
        // Calculate fees (always split 50/50)
        const totalFees = this.currentReceiptData.tax + this.currentReceiptData.tip + this.currentReceiptData.fees;
        const bryanFees = totalFees / 2;
        const ayakoFees = totalFees / 2;
        
        // Calculate each person's total responsibility including fees
        const bryanTotal = uncheckedTotal + bryanSplitPortion + bryanFees;
        const ayakoTotal = individualTotal + ayakoSplitPortion + ayakoFees;
        
        // Final calculation: Total - Bryan's responsibility = what Ayako owes Bryan
        const ayakoOwes = grandTotal + totalFees - bryanTotal;
        
        // Update display
        document.getElementById('receiptGrandTotal').textContent = this.formatCurrency(grandTotal + totalFees);
        document.getElementById('bryanUnchecked').textContent = this.formatCurrency(uncheckedTotal);
        document.getElementById('bryanSplit').textContent = this.formatCurrency(bryanSplitPortion);
        document.getElementById('bryanFees').textContent = this.formatCurrency(bryanFees);
        document.getElementById('ayakoIndividual').textContent = this.formatCurrency(individualTotal);
        document.getElementById('ayakoSplit').textContent = this.formatCurrency(ayakoSplitPortion);
        document.getElementById('ayakoFees').textContent = this.formatCurrency(ayakoFees);
        document.getElementById('splitTotal').textContent = this.formatCurrency(splitTotal);
        document.getElementById('bryanTotal').textContent = this.formatCurrency(bryanTotal);
        document.getElementById('ayakoTotal').textContent = this.formatCurrency(ayakoTotal);
        document.getElementById('receiptFees').textContent = this.formatCurrency(totalFees);
        document.getElementById('receiptNetAmount').textContent = this.formatCurrency(ayakoOwes);
    }
    
    /**
     * Add selected receipt items to transactions as a single combined transaction
     */
    addSelectedReceiptItems() {
        if (!this.currentReceiptData || this.selectedReceiptItems.size === 0) {
            alert('Please select at least one item to add.');
            return;
        }
        
        const whoPaid = document.getElementById('receiptWhoPaid').value;
        const timestamp = Date.now();
        
        // Use same calculation logic as receipt summary
        let grandTotal = 0;
        let uncheckedTotal = 0;
        let individualTotal = 0;
        let splitTotal = 0;
        const selectedItemNames = [];
        const splitDetails = [];
        
        // Calculate grand total of ALL items on receipt
        this.currentReceiptData.items.forEach(item => {
            grandTotal += item.price;
        });
        
        // Calculate unchecked items (Bryan pays these)
        this.currentReceiptData.items.forEach((item, index) => {
            if (!this.selectedReceiptItems.has(index)) {
                uncheckedTotal += item.price;
            }
        });
        
        // Calculate checked items based on split settings
        this.selectedReceiptItems.forEach(index => {
            const item = this.currentReceiptData.items[index];
            selectedItemNames.push(item.name);
            
            if (this.splitReceiptItems.has(index)) {
                splitTotal += item.price;
                splitDetails.push(`${item.name} (split 50/50)`);
            } else {
                individualTotal += item.price;
                splitDetails.push(`${item.name} (individual)`);
            }
        });
        
        // Calculate fees (always split 50/50)
        const totalFees = this.currentReceiptData.tax + this.currentReceiptData.tip + this.currentReceiptData.fees;
        const bryanFees = totalFees / 2;
        const ayakoFees = totalFees / 2;
        
        // Calculate each person's total responsibility
        const bryanTotal = uncheckedTotal + (splitTotal / 2) + bryanFees;
        const ayakoTotal = individualTotal + (splitTotal / 2) + ayakoFees;
        
        // Final calculation: what Ayako owes Bryan
        const ayakoOwes = grandTotal + totalFees - bryanTotal;
        
        const totalReceiptAmount = grandTotal + totalFees;
        
        // Debug the calculations
        console.log('=== Transaction Creation Debug ===');
        console.log('Grand Total:', grandTotal);
        console.log('Total Fees:', totalFees);
        console.log('Bryan Total:', bryanTotal);
        console.log('Calculated Ayako Owes:', ayakoOwes);
        
        // Get the exact amount from the receipt summary display
        const receiptNetAmountElement = document.getElementById('receiptNetAmount');
        const displayedNetAmount = parseFloat(receiptNetAmountElement.textContent.replace(/[$,]/g, ''));
        console.log('Displayed Net Amount:', displayedNetAmount);
        console.log('=== End Debug ===');
        
        // Create a single combined transaction for the entire receipt
        // Bryan paid the full amount, Ayako owes him the calculated amount
        const receiptTransaction = {
            id: timestamp,
            date: new Date().toISOString(),
            whoPaid: whoPaid,
            amount: totalReceiptAmount,
            category: this.getMostCommonCategory() || 'groceries',
            notes: this.createReceiptNotesWithSplits(selectedItemNames, splitDetails, totalFees),
            youOwe: displayedNetAmount, // Use exact amount from receipt summary (positive = what Ayako owes Bryan)
            receiptImage: this.getReceiptImageData(),
            isFromReceipt: true,
            // Store receipt breakdown data for modal display
            receiptBreakdown: {
                grandTotal: grandTotal,
                totalFees: totalFees,
                uncheckedTotal: uncheckedTotal,
                individualTotal: individualTotal,
                splitTotal: splitTotal,
                bryanFees: bryanFees,
                ayakoFees: ayakoFees,
                bryanTotal: bryanTotal,
                ayakoTotal: ayakoTotal,
                ayakoOwes: displayedNetAmount
            }
        };
        
        // Add the single transaction
        this.transactions.unshift(receiptTransaction);
        this.totals[whoPaid] += totalReceiptAmount;
        
        // Save and update display
        this.saveToStorage();
        this.updateDisplay();
        
        // Clear receipt data
        this.clearReceiptResults();
        
        // Switch back to manual tab
        this.switchTab('manual');
        
        // Show success message with split info
        const splitCount = Array.from(this.splitReceiptItems.values()).length;
        const individualCount = selectedItemNames.length - splitCount;
        alert(`✅ Receipt added! ${selectedItemNames.length} item(s) combined into one transaction (${splitCount} split, ${individualCount} individual) totaling ${this.formatCurrency(totalReceiptAmount)}.`);
    }
    
    /**
     * Get the most common category from selected items
     */
    getMostCommonCategory() {
        if (!this.currentReceiptData || this.selectedReceiptItems.size === 0) {
            return 'groceries';
        }
        
        const categoryCount = {};
        this.selectedReceiptItems.forEach(index => {
            const category = this.currentReceiptData.items[index].category;
            categoryCount[category] = (categoryCount[category] || 0) + 1;
        });
        
        return Object.keys(categoryCount).reduce((a, b) => 
            categoryCount[a] > categoryCount[b] ? a : b
        );
    }
    
    /**
     * Create descriptive notes for receipt transaction with split details
     */
    createReceiptNotesWithSplits(itemNames, splitDetails, fees) {
        let notes = itemNames.slice(0, 2).join(', ');
        if (itemNames.length > 2) {
            notes += ` + ${itemNames.length - 2} more items`;
        }
        
        // Count split vs individual items
        const splitCount = splitDetails.filter(d => d.includes('(split)')).length;
        const individualCount = splitDetails.filter(d => d.includes('(individual)')).length;
        
        if (splitCount > 0 && individualCount > 0) {
            notes += ` (${splitCount} split, ${individualCount} individual)`;
        } else if (splitCount > 0) {
            notes += ` (${splitCount} split items)`;
        } else if (individualCount > 0) {
            notes += ` (${individualCount} individual items)`;
        }
        
        if (fees > 0) {
            notes += ` + ${this.formatCurrency(fees)} fees split 50/50`;
        }
        return notes;
    }
    
    /**
     * Create descriptive notes for receipt transaction (legacy method)
     */
    createReceiptNotes(itemNames, subtotal, fees) {
        return this.createReceiptNotesWithSplits(itemNames, [], fees);
    }
    
    /**
     * Get receipt image data for storage
     */
    getReceiptImageData() {
        if (!this.currentReceiptFile) {
            console.log('No current receipt file');
            return null;
        }
        
        console.log('Getting receipt image data for file type:', this.currentReceiptFile.type);
        
        // For images, return the data URL
        if (this.currentReceiptFile.type.startsWith('image/')) {
            const img = document.getElementById('previewImage');
            console.log('Image preview element:', img);
            console.log('Image src:', img?.src);
            return img?.src || null;
        }
        
        // For PDFs, we need to get the converted image from canvas or preview
        const canvas = document.querySelector('#previewContainer canvas');
        console.log('Canvas element found:', !!canvas);
        if (canvas) {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            console.log('Canvas data URL length:', dataUrl.length);
            return dataUrl;
        }
        
        // Fallback: try to get from the preview image that might have been set by PDF conversion
        const img = document.getElementById('previewImage');
        console.log('Checking preview image fallback:', img, img?.src, img?.classList.contains('hidden'));
        if (img && img.src && !img.classList.contains('hidden')) {
            console.log('Using preview image as fallback for PDF');
            return img.src;
        }
        
        // For PDFs without canvas, try to store the file reference for later display
        if (this.currentReceiptFile && this.currentReceiptFile.type === 'application/pdf') {
            console.log('PDF file detected, storing file for later processing');
            return 'PDF_FILE_REFERENCE'; // Special marker for PDF files
        }
        
        console.log('No image data found');
        return null;
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
        
        // Clear image preview
        this.previewImage.classList.add('hidden');
        if (this.previewImage.src) {
            URL.revokeObjectURL(this.previewImage.src);
            this.previewImage.src = '';
        }
        
        // Clear PDF preview
        document.getElementById('pdfPreview').classList.add('hidden');
        document.getElementById('pdfFileName').textContent = '';
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
        this.updatePayAllButton();
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
            this.netBalanceElement.textContent = `Bryan owes Ayako ${this.formatCurrency(netBalance)}`;
            this.netBalanceElement.classList.add('you-owe');
        } else {
            // Spouse owes you
            this.netBalanceElement.textContent = `Ayako owes Bryan ${this.formatCurrency(Math.abs(netBalance))}`;
            this.netBalanceElement.classList.add('spouse-owes');
        }
    }
    
    /**
     * Switch between transaction tabs (unpaid/paid)
     */
    switchTransactionTab(tab) {
        // Update tab buttons
        this.unpaidTab.classList.toggle('active', tab === 'unpaid');
        this.paidTab.classList.toggle('active', tab === 'paid');
        
        // Update tab content
        this.unpaidTransactions.classList.toggle('active', tab === 'unpaid');
        this.paidTransactions.classList.toggle('active', tab === 'paid');
    }

    /**
     * Update the transaction history tables (both unpaid and paid)
     */
    updateTransactionTable() {
        // Separate transactions into unpaid and paid
        const unpaidTransactions = this.transactions.filter(t => !t.settled);
        const paidTransactions = this.transactions.filter(t => t.settled);
        
        // Update unpaid transactions table
        this.updateUnpaidTransactionsTable(unpaidTransactions);
        
        // Update paid transactions table
        this.updatePaidTransactionsTable(paidTransactions);
    }
    
    /**
     * Update unpaid transactions table
     */
    updateUnpaidTransactionsTable(unpaidTransactions) {
        this.unpaidTransactionsBody.innerHTML = '';
        
        if (unpaidTransactions.length === 0) {
            const row = document.createElement('tr');
            row.className = 'no-transactions';
            row.innerHTML = '<td colspan="6">No unpaid transactions! 🎉</td>';
            this.unpaidTransactionsBody.appendChild(row);
            return;
        }
        
        unpaidTransactions.forEach(transaction => {
            const row = this.createTransactionRow(transaction, true);
            this.unpaidTransactionsBody.appendChild(row);
        });
    }
    
    /**
     * Update paid transactions table
     */
    updatePaidTransactionsTable(paidTransactions) {
        this.paidTransactionsBody.innerHTML = '';
        
        if (paidTransactions.length === 0) {
            const row = document.createElement('tr');
            row.className = 'no-transactions';
            row.innerHTML = '<td colspan="6">No settled transactions yet.</td>';
            this.paidTransactionsBody.appendChild(row);
            return;
        }
        
        paidTransactions.forEach(transaction => {
            const row = this.createTransactionRow(transaction, false);
            this.paidTransactionsBody.appendChild(row);
        });
    }
    
    /**
     * Create a transaction row element
     */
    createTransactionRow(transaction, isUnpaid) {
        const row = document.createElement('tr');
        row.className = 'transaction-row';
        
        const date = new Date(transaction.date).toLocaleDateString();
        const whoPaidDisplay = transaction.whoPaid === 'me' ? 'Bryan' : 'Ayako';
        const category = this.getCategoryDisplay(transaction.category);
        const notes = transaction.notes || '-';
        
        if (isUnpaid) {
            // Unpaid transaction - show "You Owe" column
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
                <td>${date}</td>
                <td><strong>${whoPaidDisplay}</strong></td>
                <td class="amount-cell">${this.formatCurrency(transaction.amount)}</td>
                <td class="category-cell">${category}</td>
                <td>${notes}</td>
                <td class="${youOweClass}">${youOweDisplay}</td>
            `;
            
            // Add click handler for individual transaction payment
            if (Math.abs(youOweAmount) >= 0.01) {
                row.style.cursor = 'pointer';
                row.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showPayTransactionModal(transaction);
                });
                row.title = 'Tap to pay this item individually';
            }
        } else {
            // Paid transaction - show "Settled Date" column
            const settledDate = transaction.settledDate ? new Date(transaction.settledDate).toLocaleDateString() : '-';
            
            row.innerHTML = `
                <td>${date}</td>
                <td><strong>${whoPaidDisplay}</strong></td>
                <td class="amount-cell">${this.formatCurrency(transaction.amount)}</td>
                <td class="category-cell">${category}</td>
                <td>${notes}</td>
                <td>${settledDate}</td>
            `;
        }
        
        return row;
    }
    
    /**
     * Update the settle up button state
     */
    updatePayAllButton() {
        const hasUnpaidTransactions = this.transactions.some(t => !t.settled && Math.abs(t.youOwe) > 0.01);
        this.payAllBtn.disabled = !hasUnpaidTransactions;
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
     * Show individual payment modal for a specific transaction
     */
    showPayTransactionModal(transaction) {
        this.currentPaymentTransaction = transaction;
        
        // Show receipt image if available
        console.log('Transaction has receipt image:', !!transaction.receiptImage);
        if (transaction.receiptImage && transaction.receiptImage !== 'PDF_FILE_REFERENCE') {
            console.log('Showing receipt image');
            this.receiptImageContainer.classList.remove('hidden');
            this.receiptImage.src = transaction.receiptImage;
        } else if (transaction.receiptImage === 'PDF_FILE_REFERENCE') {
            // For PDF files, show a placeholder or message
            console.log('Transaction from PDF receipt - showing placeholder');
            this.receiptImageContainer.classList.remove('hidden');
            this.receiptImage.src = 'data:image/svg+xml;base64,' + btoa(`
                <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
                    <rect width="200" height="150" fill="#f3f4f6" stroke="#d1d5db" stroke-width="2"/>
                    <text x="100" y="75" text-anchor="middle" font-family="Arial" font-size="14" fill="#6b7280">
                        PDF Receipt
                    </text>
                    <text x="100" y="95" text-anchor="middle" font-family="Arial" font-size="12" fill="#9ca3af">
                        (Original file)
                    </text>
                </svg>
            `);
        } else {
            console.log('No receipt image to show');
            this.receiptImageContainer.classList.add('hidden');
        }
        
        // Format transaction details
        const youOweAmount = Math.abs(transaction.youOwe);
        const whoPaidDisplay = transaction.whoPaid === 'me' ? 'You' : 'Your spouse';
        const categoryDisplay = this.getCategoryDisplay(transaction.category);
        
        this.payTransactionDetails.innerHTML = `
            <div class="payment-transaction-details">
                <p><strong>Item:</strong> ${transaction.notes || categoryDisplay}</p>
                <p><strong>Amount:</strong> ${this.formatCurrency(transaction.amount)}</p>
                <p><strong>Paid by:</strong> ${whoPaidDisplay}</p>
                <p><strong>Category:</strong> ${categoryDisplay}</p>
                <p><strong>Date:</strong> ${new Date(transaction.date).toLocaleDateString()}</p>
            </div>
        `;
        
        // Show receipt if available
        if (transaction.receiptImage) {
            this.receiptImage.src = transaction.receiptImage;
            this.receiptImageContainer.classList.remove('hidden');
        } else {
            this.receiptImageContainer.classList.add('hidden');
        }
        
        // Show receipt breakdown if available
        const receiptBreakdownSection = document.getElementById('receiptBreakdownSection');
        console.log('Transaction data:', JSON.stringify(transaction, null, 2));
        
        if (transaction.isFromReceipt && transaction.receiptBreakdown) {
            console.log('Showing receipt breakdown for transaction:', transaction.receiptBreakdown);
            this.showReceiptBreakdown(transaction.receiptBreakdown);
            receiptBreakdownSection.classList.remove('hidden');
            receiptBreakdownSection.style.display = 'block';
        } else if (transaction.isFromReceipt) {
            // For existing receipt transactions without breakdown data, create a simple breakdown
            console.log('Receipt transaction without breakdown data, creating simple version');
            const simpleBreakdown = {
                grandTotal: transaction.amount - 0.71, // Assuming $0.71 fees from the example
                totalFees: 0.71,
                ayakoOwes: Math.abs(transaction.youOwe)
            };
            this.showSimpleReceiptBreakdown(simpleBreakdown);
            receiptBreakdownSection.classList.remove('hidden');
            receiptBreakdownSection.style.display = 'block';
        } else {
            console.log('Hiding receipt breakdown - isFromReceipt:', transaction.isFromReceipt, 'hasBreakdown:', !!transaction.receiptBreakdown);
            receiptBreakdownSection.classList.add('hidden');
            receiptBreakdownSection.style.display = 'none';
        }
        
        // Set payment message
        if (transaction.isFromReceipt) {
            // For receipt transactions, always show what Ayako owes Bryan
            this.payTransactionMessage.textContent = `Ayako owes Bryan: ${this.formatCurrency(youOweAmount)}`;
            this.confirmPayTransactionBtn.textContent = `Mark as Settled`;
        } else if (transaction.youOwe > 0) {
            this.payTransactionMessage.textContent = `Pay your share: ${this.formatCurrency(youOweAmount)}`;
            this.confirmPayTransactionBtn.textContent = `Pay ${this.formatCurrency(youOweAmount)}`;
        } else {
            this.payTransactionMessage.textContent = `Settle this item: ${this.formatCurrency(youOweAmount)} owed to you`;
            this.confirmPayTransactionBtn.textContent = `Mark as Settled`;
        }
        
        // Show modal with iOS-style animation
        this.payTransactionModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Trigger animation after a small delay to ensure display is set
        requestAnimationFrame(() => {
            this.payTransactionModal.classList.add('show');
        });
    }

    /**
     * Hide individual payment modal with iOS-style animation
     */
    hidePayTransactionModal() {
        // Start exit animation
        this.payTransactionModal.classList.remove('show');
        
        // After animation completes, hide the modal
        setTimeout(() => {
            this.payTransactionModal.style.display = 'none';
            document.body.style.overflow = 'auto';
            this.currentPaymentTransaction = null;
        }, 300); // Match the CSS transition duration
    }

    /**
     * Show simple receipt breakdown for transactions without full breakdown data
     */
    showSimpleReceiptBreakdown(breakdown) {
        const modalReceiptSummary = document.getElementById('modalReceiptSummary');
        
        modalReceiptSummary.innerHTML = `
            <div class="summary-row">
                <span class="label">Total receipt amount:</span>
                <span class="amount">${this.formatCurrency(breakdown.grandTotal + breakdown.totalFees)}</span>
            </div>
            <div class="summary-row">
                <span class="label">Taxes and fees:</span>
                <span class="amount">${this.formatCurrency(breakdown.totalFees)}</span>
            </div>
            <div class="summary-row total">
                <span class="label">Ayako owes Bryan:</span>
                <span class="amount">${this.formatCurrency(breakdown.ayakoOwes)}</span>
            </div>
        `;
    }

    /**
     * Show receipt breakdown in the modal
     */
    showReceiptBreakdown(breakdown) {
        const modalReceiptSummary = document.getElementById('modalReceiptSummary');
        
        modalReceiptSummary.innerHTML = `
            <div class="summary-row">
                <span class="label">Total (all items):</span>
                <span class="amount">${this.formatCurrency(breakdown.grandTotal + breakdown.totalFees)}</span>
            </div>
            <div class="summary-divider"></div>
            <div class="summary-row">
                <span class="label">Bryan pays (unchecked items):</span>
                <span class="amount">${this.formatCurrency(breakdown.uncheckedTotal)}</span>
            </div>
            <div class="summary-row">
                <span class="label">Bryan split portion:</span>
                <span class="amount">${this.formatCurrency(breakdown.splitTotal / 2)}</span>
            </div>
            <div class="summary-row">
                <span class="label">Bryan's taxes and fees:</span>
                <span class="amount">${this.formatCurrency(breakdown.bryanFees)}</span>
            </div>
            <div class="summary-row">
                <span class="label">Ayako owes (individual items):</span>
                <span class="amount">${this.formatCurrency(breakdown.individualTotal)}</span>
            </div>
            <div class="summary-row">
                <span class="label">Ayako split portion:</span>
                <span class="amount">${this.formatCurrency(breakdown.splitTotal / 2)}</span>
            </div>
            <div class="summary-row">
                <span class="label">Ayako's taxes and fees:</span>
                <span class="amount">${this.formatCurrency(breakdown.ayakoFees)}</span>
            </div>
            <div class="summary-row">
                <span class="label">Split items total:</span>
                <span class="amount">${this.formatCurrency(breakdown.splitTotal)}</span>
            </div>
            <div class="summary-divider"></div>
            <div class="summary-row">
                <span class="label">Bryan total (unchecked + split + fees):</span>
                <span class="amount">${this.formatCurrency(breakdown.bryanTotal)}</span>
            </div>
            <div class="summary-row">
                <span class="label">Ayako total (individual + split + fees):</span>
                <span class="amount">${this.formatCurrency(breakdown.ayakoTotal)}</span>
            </div>
            <div class="summary-row">
                <span class="label">Total taxes and fees:</span>
                <span class="amount">${this.formatCurrency(breakdown.totalFees)}</span>
            </div>
            <div class="summary-row total">
                <span class="label">Ayako owes Bryan:</span>
                <span class="amount">${this.formatCurrency(breakdown.ayakoOwes)}</span>
            </div>
        `;
    }

    /**
     * Pay/settle individual transaction
     */
    payTransaction() {
        if (!this.currentPaymentTransaction) return;
        
        const transaction = this.currentPaymentTransaction;
        const originalYouOwe = transaction.youOwe; // Save original before modifying
        const originalAmount = Math.abs(originalYouOwe);
        
        // When someone pays their share, we need to adjust the transaction as if 
        // they had paid their half from the beginning
        if (originalYouOwe > 0) {
            // You were owing money - adjust as if you paid your half originally
            // Remove the amount you owed from the original payer's total
            // and add your half to your total
            if (transaction.whoPaid === 'spouse') {
                this.totals.spouse -= originalAmount;
                this.totals.me += originalAmount;
            }
        } else {
            // Spouse was owing money - adjust as if spouse paid their half originally
            if (transaction.whoPaid === 'me') {
                this.totals.me -= originalAmount;
                this.totals.spouse += originalAmount;
            }
        }
        
        // Mark the transaction as settled by setting youOwe to 0
        transaction.youOwe = 0;
        transaction.settled = true;
        transaction.settledDate = new Date().toISOString();
        
        // Save and update display
        this.saveToStorage();
        this.updateDisplay();
        
        // Show success message
        const itemName = transaction.notes || this.getCategoryDisplay(transaction.category);
        alert(`✅ Payment completed! Bryan has settled "${itemName}" for ${this.formatCurrency(originalAmount)}.`);
    }
    
    /**
     * Pay all outstanding transactions - settle all unpaid transactions and move them to paid tab
     */
    payAllTransactions() {
        let totalSettled = 0;
        let transactionsSettled = 0;
        
        // Process all unpaid transactions
        this.transactions.forEach(transaction => {
            if (!transaction.settled && Math.abs(transaction.youOwe) > 0.01) {
                const originalYouOwe = transaction.youOwe;
                const originalAmount = Math.abs(originalYouOwe);
                
                // Adjust totals to balance the payment (same logic as individual payments)
                if (originalYouOwe > 0) {
                    // User was owing money - adjust as if user paid their half originally
                    if (transaction.whoPaid === 'spouse') {
                        this.totals.spouse -= originalAmount;
                        this.totals.me += originalAmount;
                    }
                } else {
                    // Spouse was owing money - adjust as if spouse paid their half originally
                    if (transaction.whoPaid === 'me') {
                        this.totals.me -= originalAmount;
                        this.totals.spouse += originalAmount;
                    }
                }
                
                // Mark transaction as settled
                transaction.youOwe = 0;
                transaction.settled = true;
                transaction.settledDate = new Date().toISOString();
                
                totalSettled += originalAmount;
                transactionsSettled++;
            }
        });
        
        // Save and update display
        this.saveToStorage();
        this.updateDisplay();
        
        // Show success message
        if (transactionsSettled > 0) {
            alert(`✅ Bryan has successfully paid ${transactionsSettled} transaction(s) totaling ${this.formatCurrency(totalSettled)}!`);
        } else {
            alert('ℹ️ No outstanding transactions for Bryan to pay.');
        }
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
     * Clear all data and reset the application
     */
    clearAllData() {
        console.log('Clearing all stored data...');
        try {
            // Clear localStorage
            localStorage.removeItem('splitmate-data');
            
            // Reset application state
            this.transactions = [];
            this.totals = {
                me: 0,
                spouse: 0
            };
            
            // Update display
            this.updateDisplay();
            
            console.log('All data cleared successfully');
        } catch (error) {
            console.error('Failed to clear data:', error);
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
    
    // Add global function to clear data for troubleshooting
    window.clearSplitMateData = () => {
        window.splitMateApp.clearAllData();
        console.log('SplitMate data cleared. Page will refresh in 2 seconds...');
        setTimeout(() => window.location.reload(), 2000);
    };
    
    // Automatically clear old incompatible data if found
    const storedData = localStorage.getItem('splitmate-data');
    if (storedData) {
        try {
            const data = JSON.parse(storedData);
            // Check if data has old structure that needs clearing
            if (data.transactions && data.transactions.length > 0) {
                const hasOldTransaction = data.transactions.some(t => 
                    t.amount === 100 || !t.hasOwnProperty('youOwe')
                );
                if (hasOldTransaction) {
                    console.log('Found old incompatible transaction data, clearing...');
                    localStorage.removeItem('splitmate-data');
                    window.location.reload();
                }
            }
        } catch (e) {
            console.log('Invalid stored data found, clearing...');
            localStorage.removeItem('splitmate-data');
            window.location.reload();
        }
    }
    
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
