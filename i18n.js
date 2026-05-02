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
                bryanHasPaid: '{p1} has paid:',
                ayakoHasPaid: '{p2} has paid:',
                allSettledUp: 'All settled up! 🎉',
                bryanOwes: '{p1} owes {p2}:',
                ayakoOwes: '{p2} owes {p1}:',
                
                // Form fields and buttons
                whoPaid: 'Who paid?',
                bryan: '{p1}',
                ayako: '{p2}',
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
                bryanPaysUnchecked: '{p1} pays (unchecked items):',
                bryanSplitPortion: '{p1} split portion:',
                bryanTaxesFees: "{p1}'s taxes and fees:",
                ayakoOwesIndividual: '{p2} owes (individual items):',
                ayakoSplitPortion: '{p2} split portion:',
                ayakoTaxesFees: "{p2}'s taxes and fees:",
                splitItemsTotal: 'Split items total:',
                bryanTotal: '{p1} total (unchecked + split + fees):',
                ayakoTotal: '{p2} total (individual + split + fees):',
                totalTaxesFees: 'Total taxes and fees:',
                ayakoOwesBryan: '{p2} owes {p1}:',
                ayakoPaidBryan: '{p2} paid {p1}:',
                storeLocation: 'Store/Location:',
                storeLocationPlaceholder: 'e.g., Publix, Target, Whole Foods...',
                addSelectedItems: 'Add Selected Items',
                clearReceipt: 'Clear Receipt',
                
                // Transaction table headers
                date: 'Date',
                whoPaidHeader: 'Who Paid',
                amountHeader: 'Amount',
                descriptionHeader: 'Description',
                bryanOwesHeader: '{p1} Owes',
                ayakoOwesHeader: '{p2} Owes',
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
                payBryanShare: "Pay {p1}'s Share",
                deleteReceiptButton: 'Delete Receipt',
                
                // Settings
                settings: 'Settings',
                partnerNames: 'Partner Names',
                partner1Name: 'Partner 1 Name',
                partner2Name: 'Partner 2 Name',
                partner1Placeholder: 'e.g. Alex',
                partner2Placeholder: 'e.g. Jordan',
                saveSettings: 'Save',
                settingsSaved: 'Names saved!',
                
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
                bryanHasPaid: '{p1}が支払った金額:',
                ayakoHasPaid: '{p2}が支払った金額:',
                allSettledUp: '全て清算済み！ 🎉',
                bryanOwes: '{p1}が{p2}に借りている金額:',
                ayakoOwes: '{p2}が{p1}に借りている金額:',
                
                // Form fields and buttons
                whoPaid: '誰が支払いましたか？',
                bryan: '{p1}',
                ayako: '{p2}',
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
                bryanPaysUnchecked: '{p1}の支払い（未チェック項目）:',
                bryanSplitPortion: '{p1}の分割分:',
                bryanTaxesFees: '{p1}の税金・手数料:',
                ayakoOwesIndividual: '{p2}の負担（個別項目）:',
                ayakoSplitPortion: '{p2}の分割分:',
                ayakoTaxesFees: '{p2}の税金・手数料:',
                splitItemsTotal: '分割項目合計:',
                bryanTotal: '{p1}合計（未チェック+分割+手数料）:',
                ayakoTotal: '{p2}合計（個別+分割+手数料）:',
                totalTaxesFees: '税金・手数料合計:',
                ayakoOwesBryan: '{p2}が{p1}に借りている金額:',
                ayakoPaidBryan: '{p2}が{p1}に支払った金額:',
                storeLocation: '店舗・場所:',
                storeLocationPlaceholder: '例：パブリックス、ターゲット、ホールフーズ...',
                addSelectedItems: '選択した項目を追加',
                clearReceipt: 'レシートをクリア',
                
                // Transaction table headers
                date: '日付',
                whoPaidHeader: '支払者',
                amountHeader: '金額',
                descriptionHeader: '説明',
                bryanOwesHeader: '{p1}の負担',
                ayakoOwesHeader: '{p2}の負担',
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
                payBryanShare: '{p1}の分を支払う',
                deleteReceiptButton: 'レシートを削除',
                
                // Settings
                settings: '設定',
                partnerNames: 'パートナー名',
                partner1Name: 'パートナー1の名前',
                partner2Name: 'パートナー2の名前',
                partner1Placeholder: '例：田中',
                partner2Placeholder: '例：佐藤',
                saveSettings: '保存',
                settingsSaved: '名前を保存しました！',
                
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
    
    getP1Name() {
        return localStorage.getItem('splitmate_partner1_name') || 'Partner 1';
    }
    
    getP2Name() {
        return localStorage.getItem('splitmate_partner2_name') || 'Partner 2';
    }
    
    setPartnerNames(p1, p2) {
        const trimP1 = (p1 || '').trim();
        const trimP2 = (p2 || '').trim();
        localStorage.setItem('splitmate_partner1_name', trimP1 || 'Partner 1');
        localStorage.setItem('splitmate_partner2_name', trimP2 || 'Partner 2');
        this.updateAllTexts();
        window.dispatchEvent(new CustomEvent('partnerNamesChanged', {
            detail: { p1: this.getP1Name(), p2: this.getP2Name() }
        }));
    }
    
    setLanguage(lang) {
        this.currentLanguage = lang;
        localStorage.setItem('splitmate_language', lang);
        this.updateAllTexts();
        document.documentElement.lang = lang;
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    }
    
    t(key) {
        const raw = this.translations[this.currentLanguage][key] || this.translations.en[key] || key;
        return raw
            .replace(/{p1}/g, this.getP1Name())
            .replace(/{p2}/g, this.getP2Name());
    }
    
    updateAllTexts() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'number')) {
                element.placeholder = this.t(key);
            } else {
                element.textContent = this.t(key);
            }
        });
        
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.t(key);
        });
        
        document.querySelectorAll('[data-i18n-alt]').forEach(element => {
            const key = element.getAttribute('data-i18n-alt');
            element.alt = this.t(key);
        });
        
        document.title = this.t('appTitle') + ' - ' + this.t('appSubtitle');
        this.updateLanguageToggle();
    }
    
    setupLanguageToggle() {
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
                document.getElementById('languageToggle').addEventListener('click', () => {
                    this.toggleLanguage();
                });
            } else {
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

window.i18n = new I18n();
