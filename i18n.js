/**
 * Internationalization (i18n) system for SplitMate
 * Supports English and Japanese languages
 */

class I18n {
    constructor() {
        this.currentLanguage = this.getStoredLanguage() || 'en';
        this.translations = {
            en: {
                // App title and main headers
                appTitle: 'SplitMate',
                appSubtitle: 'Expense Splitter for Couples',
                addNewExpense: 'Add New Expense',
                transactionHistory: 'Transaction History',
                
                // Balance summary
                bryanHasPaid: 'Bryan has paid:',
                ayakoHasPaid: 'Ayako has paid:',
                allSettledUp: 'All settled up! 🎉',
                bryanOwes: 'Bryan owes Ayako:',
                ayakoOwes: 'Ayako owes Bryan:',
                
                // Form fields and buttons
                whoPaid: 'Who paid?',
                bryan: 'Bryan',
                ayako: 'Ayako',
                amount: 'Amount ($)',
                description: 'Description (optional)',
                descriptionPlaceholder: 'What was this for?',
                addExpense: 'Add Expense',
                manualEntry: 'Manual Entry',
                scanReceipt: 'Scan Receipt',
                
                // Receipt upload
                dropReceiptHere: 'Drop receipt file here or',
                clickToUpload: 'click to upload',
                supportsFiles: 'Supports JPG, PNG, PDF files up to 10MB',
                receiptPreview: 'Receipt preview',
                pdfReadyForProcessing: 'PDF receipt ready for processing',
                processReceipt: 'Process Receipt',
                cancel: 'Cancel',
                scanningReceipt: 'Scanning receipt...',
                
                // Receipt processing
                receiptItems: 'Receipt Items',
                whoPaidReceipt: 'Who paid for this receipt?',
                totalAllItems: 'Total (all items):',
                bryanPaysUnchecked: 'Bryan pays (unchecked items):',
                bryanSplitPortion: 'Bryan split portion:',
                bryanTaxesFees: "Bryan's taxes and fees:",
                ayakoOwesIndividual: 'Ayako owes (individual items):',
                ayakoSplitPortion: 'Ayako split portion:',
                ayakoTaxesFees: "Ayako's taxes and fees:",
                splitItemsTotal: 'Split items total:',
                bryanTotal: 'Bryan total (unchecked + split + fees):',
                ayakoTotal: 'Ayako total (individual + split + fees):',
                totalTaxesFees: 'Total taxes and fees:',
                ayakoOwesBryan: 'Ayako owes Bryan:',
                storeLocation: 'Store/Location:',
                storeLocationPlaceholder: 'e.g., Publix, Target, Whole Foods...',
                addSelectedItems: 'Add Selected Items',
                clearReceipt: 'Clear Receipt',
                
                // Transaction table headers
                date: 'Date',
                whoPaidHeader: 'Who Paid',
                amountHeader: 'Amount',
                descriptionHeader: 'Description',
                bryanOwesHeader: 'Bryan Owes',
                ayakoOwesHeader: 'Ayako Owes',
                settledDate: 'Settled Date',
                
                // Transaction tabs
                unpaid: 'Unpaid',
                paid: 'Paid',
                noUnpaidTransactions: 'No unpaid transactions! 🎉',
                noSettledTransactions: 'No settled transactions yet.',
                
                // Action buttons
                payAllOutstanding: 'Pay All Outstanding',
                
                // Modals
                confirmPayAll: '💸 Confirm Pay All',
                confirmPayAllMessage: 'This will settle all outstanding transactions and move them to the Paid tab. Your running balances will be adjusted accordingly.',
                yesPayAll: 'Yes, Pay All',
                
                deleteReceipt: '🗑️ Delete Receipt',
                deleteReceiptMessage: 'Are you sure you want to delete this receipt transaction? This action cannot be undone.',
                delete: 'Delete',
                
                payIndividualItem: '💸 Pay Individual Item',
                receiptBreakdown: 'Receipt Breakdown',
                receipt: 'Receipt',
                payBryanShare: "Pay Bryan's Share",
                deleteReceiptButton: 'Delete Receipt',
                
                // Categories
                groceries: '🥬 Groceries',
                dining: '🍽️ Dining',
                travel: '✈️ Travel',
                shopping: '🛍️ Shopping',
                other: '📋 Other',
                
                // Language switcher
                language: 'Language',
                english: 'English',
                japanese: '日本語',
                
                // Dynamic receipt items
                split: 'Split',
                individual: 'Individual',
                splitTooltip: 'Split: Both pay 50%. Individual: Other person owes the payer'
            },
            ja: {
                // App title and main headers
                appTitle: 'SplitMate',
                appSubtitle: '夫婦の支出分割アプリ',
                addNewExpense: '新しい支出を追加',
                transactionHistory: '取引履歴',
                
                // Balance summary
                bryanHasPaid: 'Bryanが支払った金額:',
                ayakoHasPaid: 'Ayakoが支払った金額:',
                allSettledUp: '全て清算済み！ 🎉',
                bryanOwes: 'BryanがAyakoに借りている金額:',
                ayakoOwes: 'AyakoがBryanに借りている金額:',
                
                // Form fields and buttons
                whoPaid: '誰が支払いましたか？',
                bryan: 'Bryan',
                ayako: 'Ayako',
                amount: '金額 ($)',
                description: '説明（任意）',
                descriptionPlaceholder: '何のための支出ですか？',
                addExpense: '支出を追加',
                manualEntry: '手動入力',
                scanReceipt: 'レシートスキャン',
                
                // Receipt upload
                dropReceiptHere: 'レシートファイルをここにドロップするか、',
                clickToUpload: 'クリックしてアップロード',
                supportsFiles: 'JPG、PNG、PDF（最大10MB）をサポート',
                receiptPreview: 'レシートプレビュー',
                pdfReadyForProcessing: 'PDFレシートの処理準備完了',
                processReceipt: 'レシートを処理',
                cancel: 'キャンセル',
                scanningReceipt: 'レシートをスキャン中...',
                
                // Receipt processing
                receiptItems: 'レシート項目',
                whoPaidReceipt: 'このレシートは誰が支払いましたか？',
                totalAllItems: '合計（全項目）:',
                bryanPaysUnchecked: 'Bryanの支払い（未チェック項目）:',
                bryanSplitPortion: 'Bryanの分割分:',
                bryanTaxesFees: 'Bryanの税金・手数料:',
                ayakoOwesIndividual: 'Ayakoの負担（個別項目）:',
                ayakoSplitPortion: 'Ayakoの分割分:',
                ayakoTaxesFees: 'Ayakoの税金・手数料:',
                splitItemsTotal: '分割項目合計:',
                bryanTotal: 'Bryan合計（未チェック+分割+手数料）:',
                ayakoTotal: 'Ayako合計（個別+分割+手数料）:',
                totalTaxesFees: '税金・手数料合計:',
                ayakoOwesBryan: 'AyakoがBryanに借りている金額:',
                storeLocation: '店舗・場所:',
                storeLocationPlaceholder: '例：パブリックス、ターゲット、ホールフーズ...',
                addSelectedItems: '選択した項目を追加',
                clearReceipt: 'レシートをクリア',
                
                // Transaction table headers
                date: '日付',
                whoPaidHeader: '支払者',
                amountHeader: '金額',
                descriptionHeader: '説明',
                bryanOwesHeader: 'Bryanの負担',
                ayakoOwesHeader: 'Ayakoの負担',
                settledDate: '清算日',
                
                // Transaction tabs
                unpaid: '未払い',
                paid: '支払済み',
                noUnpaidTransactions: '未払いの取引はありません！ 🎉',
                noSettledTransactions: 'まだ清算された取引はありません。',
                
                // Action buttons
                payAllOutstanding: '全ての未払いを清算',
                
                // Modals
                confirmPayAll: '💸 全支払いの確認',
                confirmPayAllMessage: 'これにより、すべての未処理取引が清算され、支払済みタブに移動されます。残高が適切に調整されます。',
                yesPayAll: 'はい、全て支払う',
                
                deleteReceipt: '🗑️ レシートを削除',
                deleteReceiptMessage: 'このレシート取引を削除してもよろしいですか？この操作は取り消せません。',
                delete: '削除',
                
                payIndividualItem: '💸 個別項目の支払い',
                receiptBreakdown: 'レシート内訳',
                receipt: 'レシート',
                payBryanShare: 'Bryanの分を支払う',
                deleteReceiptButton: 'レシートを削除',
                
                // Categories
                groceries: '🥬 食料品',
                dining: '🍽️ 外食',
                travel: '✈️ 旅行',
                shopping: '🛍️ ショッピング',
                other: '📋 その他',
                
                // Language switcher
                language: '言語',
                english: 'English',
                japanese: '日本語',
                
                // Dynamic receipt items
                split: '分割',
                individual: '個別',
                splitTooltip: '分割：両方が50%支払い。個別：相手が支払者に借りている'
            }
        };
        
        this.init();
    }
    
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.updateAllTexts();
                this.setupLanguageToggle();
            });
        } else {
            this.updateAllTexts();
            this.setupLanguageToggle();
        }
    }
    
    getStoredLanguage() {
        return localStorage.getItem('splitmate_language');
    }
    
    setLanguage(lang) {
        this.currentLanguage = lang;
        localStorage.setItem('splitmate_language', lang);
        this.updateAllTexts();
        
        // Update HTML lang attribute
        document.documentElement.lang = lang;
        
        // Dispatch custom event for other components to listen to
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    }
    
    t(key) {
        return this.translations[this.currentLanguage][key] || this.translations.en[key] || key;
    }
    
    updateAllTexts() {
        // Update static text elements with data-i18n attributes
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'number')) {
                element.placeholder = this.t(key);
            } else {
                element.textContent = this.t(key);
            }
        });
        
        // Update placeholder texts
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.t(key);
        });
        
        // Update alt texts
        document.querySelectorAll('[data-i18n-alt]').forEach(element => {
            const key = element.getAttribute('data-i18n-alt');
            element.alt = this.t(key);
        });
        
        // Update title and subtitle specifically
        document.title = this.t('appTitle') + ' - ' + this.t('appSubtitle');
        
        // Update language toggle button text
        this.updateLanguageToggle();
    }
    
    setupLanguageToggle() {
        // Create language toggle if it doesn't exist
        if (!document.getElementById('languageToggle')) {
            const header = document.querySelector('.header');
            if (header) {
                const languageToggle = document.createElement('div');
                languageToggle.className = 'language-toggle';
                languageToggle.innerHTML = `
                    <button id="languageToggle" class="language-btn" title="${this.t('language')}">
                        ${this.currentLanguage === 'en' ? 'EN' : 'JP'}
                    </button>
                `;
                header.appendChild(languageToggle);
                
                // Add event listener
                document.getElementById('languageToggle').addEventListener('click', () => {
                    this.toggleLanguage();
                });
            } else {
                // If header not found, try again later
                setTimeout(() => this.setupLanguageToggle(), 100);
            }
        }
    }
    
    updateLanguageToggle() {
        const toggleBtn = document.getElementById('languageToggle');
        if (toggleBtn) {
            toggleBtn.textContent = this.currentLanguage === 'en' ? 'EN' : 'JP';
            toggleBtn.title = this.t('language');
        }
    }
    
    toggleLanguage() {
        const newLang = this.currentLanguage === 'en' ? 'ja' : 'en';
        this.setLanguage(newLang);
    }
    
    formatCurrency(amount) {
        // Always use USD format for now, but could be extended for Japanese Yen
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }
    
    formatDate(date) {
        const dateObj = new Date(date);
        if (this.currentLanguage === 'ja') {
            return dateObj.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } else {
            return dateObj.toLocaleDateString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        }
    }
}

// Initialize i18n system
window.i18n = new I18n();