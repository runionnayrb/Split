/**
 * Receipt Processing Module using OpenAI Vision API
 * Handles receipt image analysis and expense extraction
 */

class ReceiptProcessor {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    /**
     * Process receipt file (image or PDF) and extract expense data via server API
     * @param {string} base64Data - Base64 encoded file data
     * @param {boolean} isPdf - Whether the file is a PDF
     * @returns {Promise<Object>} Parsed receipt data
     */
    async processReceipt(base64Data, isPdf = false) {
        try {
            const response = await fetch('/api/process-receipt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    image: base64Data,
                    isPdf: isPdf
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Server Error: ${errorData.error || response.statusText}`);
            }

            const receiptData = await response.json();
            return receiptData;
            
        } catch (error) {
            console.error('Receipt processing error:', error);
            throw error;
        }
    }

    /**
     * Validate and clean the receipt data from AI
     * @param {Object} data - Raw receipt data from AI
     * @returns {Object} Cleaned receipt data
     */
    validateAndCleanReceiptData(data) {
        const cleaned = {
            items: [],
            subtotal: 0,
            tax: 0,
            tip: 0,
            fees: 0,
            total: 0,
            merchant: '',
            date: ''
        };

        // Clean items
        if (Array.isArray(data.items)) {
            cleaned.items = data.items.map(item => ({
                name: String(item.name || 'Unknown Item'),
                price: parseFloat(item.price) || 0,
                category: this.normalizeCategory(item.category)
            })).filter(item => item.price > 0);
        }

        // Clean numeric fields
        cleaned.subtotal = parseFloat(data.subtotal) || 0;
        cleaned.tax = parseFloat(data.tax) || 0;
        cleaned.tip = parseFloat(data.tip) || 0;
        cleaned.fees = parseFloat(data.fees) || 0;
        cleaned.total = parseFloat(data.total) || 0;

        // Clean string fields
        cleaned.merchant = String(data.merchant || '').trim();
        cleaned.date = String(data.date || '').trim();

        // Validate total
        const calculatedTotal = cleaned.subtotal + cleaned.tax + cleaned.tip + cleaned.fees;
        if (Math.abs(cleaned.total - calculatedTotal) > 0.01) {
            // If totals don't match, recalculate
            cleaned.total = Math.round(calculatedTotal * 100) / 100;
        }

        return cleaned;
    }

    /**
     * Normalize category to match our predefined categories
     * @param {string} category - Category from AI
     * @returns {string} Normalized category
     */
    normalizeCategory(category) {
        if (!category) return 'other';
        
        const normalized = category.toLowerCase();
        
        if (normalized.includes('grocery') || normalized.includes('food') || normalized.includes('supermarket')) {
            return 'groceries';
        }
        if (normalized.includes('restaurant') || normalized.includes('dining') || normalized.includes('cafe')) {
            return 'dining';
        }
        if (normalized.includes('travel') || normalized.includes('transport') || normalized.includes('hotel')) {
            return 'travel';
        }
        if (normalized.includes('shop') || normalized.includes('retail') || normalized.includes('store')) {
            return 'shopping';
        }
        
        return 'other';
    }

    /**
     * Convert image file to base64
     * @param {File} file - Image file
     * @returns {Promise<string>} Base64 string
     */
    async imageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1]; // Remove data:image/jpeg;base64, prefix
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Validate receipt file (image or PDF)
     * @param {File} file - Receipt file
     * @returns {boolean} True if valid
     */
    validateReceiptFile(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
        
        if (file.size > maxSize) {
            throw new Error('File is too large. Please use a file smaller than 10MB.');
        }
        
        if (!allowedTypes.includes(file.type)) {
            throw new Error('Unsupported file format. Please use JPG, PNG, WebP, or PDF.');
        }
        
        return true;
    }

    /**
     * Check if file is a PDF
     * @param {File} file - File to check
     * @returns {boolean} True if PDF
     */
    isPdfFile(file) {
        return file.type === 'application/pdf';
    }
}

// Make available globally
window.ReceiptProcessor = ReceiptProcessor;