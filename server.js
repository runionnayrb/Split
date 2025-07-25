/**
 * Simple Node.js server to serve SplitMate with OpenAI API proxy
 * This handles the OpenAI API key securely on the server side
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const pdf2pic = require('pdf2pic');

const PORT = process.env.PORT || 5000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        // API endpoint to process receipts (supports both images and PDFs)
        if (pathname === '/api/process-receipt' && req.method === 'POST') {
            await handleReceiptProcessing(req, res);
            return;
        }

        // API endpoint to get OpenAI key availability (for client to check)
        if (pathname === '/api/openai-available' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ available: !!OPENAI_API_KEY }));
            return;
        }

        // Serve static files
        let filePath = pathname === '/' ? '/index.html' : pathname;
        filePath = path.join(__dirname, filePath);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
            return;
        }

        // Get file extension and MIME type
        const ext = path.extname(filePath);
        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        // Read and serve file
        const fileContent = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(fileContent);

    } catch (error) {
        console.error('Server error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
    }
});

/**
 * Convert PDF to image using pdf2pic
 */
async function convertPdfToImage(base64Pdf) {
    try {
        // Create temp directory for PDF processing
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        // Generate unique filename
        const tempId = Date.now() + Math.random().toString(36).substr(2, 9);
        const pdfPath = path.join(tempDir, `${tempId}.pdf`);
        
        // Write PDF to temp file
        const pdfBuffer = Buffer.from(base64Pdf, 'base64');
        fs.writeFileSync(pdfPath, pdfBuffer);

        // Convert PDF to image (first page only)
        const convert = pdf2pic.fromPath(pdfPath, {
            density: 300,           // Higher density for better text recognition
            saveFilename: tempId,
            savePath: tempDir,
            format: "jpeg",
            width: 2480,           // High resolution for better OCR
            height: 3508
        });

        const result = await convert(1); // Convert first page only
        
        // Read the converted image
        const imagePath = result.path;
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');

        // Clean up temp files
        try {
            fs.unlinkSync(pdfPath);
            fs.unlinkSync(imagePath);
        } catch (cleanupError) {
            console.warn('Cleanup warning:', cleanupError.message);
        }

        return base64Image;
        
    } catch (error) {
        console.error('PDF conversion error:', error);
        throw new Error('Failed to convert PDF to image');
    }
}

/**
 * Handle receipt processing using OpenAI API
 */
async function handleReceiptProcessing(req, res) {
    if (!OPENAI_API_KEY) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'OpenAI API key not configured' }));
        return;
    }

    try {
        // Read request body
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { image, isPdf } = JSON.parse(body);

                if (!image) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No image or PDF provided' }));
                    return;
                }

                let imageToProcess = image;
                
                // If it's a PDF, convert it to image first
                if (isPdf) {
                    try {
                        imageToProcess = await convertPdfToImage(image);
                    } catch (pdfError) {
                        console.error('PDF conversion error:', pdfError);
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to process PDF file. Please ensure it\'s a valid PDF with readable content.' }));
                        return;
                    }
                }

                // Call OpenAI API
                const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
                        messages: [
                            {
                                role: "user",
                                content: [
                                    {
                                        type: "text",
                                        text: `Analyze this receipt image and extract all itemized expenses. I need to split expenses with my partner, where:
                                        
1. Extract each individual item with its price
2. Identify subtotal, taxes, tips, delivery fees, and other charges
3. Calculate the total amount
4. Return in JSON format with this structure:

{
  "items": [
    {"name": "item name", "price": 12.99, "category": "groceries|dining|travel|shopping|other"}
  ],
  "subtotal": 45.67,
  "tax": 3.65,
  "tip": 8.00,
  "fees": 2.50,
  "total": 59.82,
  "merchant": "Store Name",
  "date": "2024-01-15"
}

Rules:
- Only include actual purchased items in "items" array
- Put taxes, tips, delivery fees, service charges in separate fields
- Guess the most appropriate category for each item
- If you can't read something clearly, make your best estimate
- Ensure all prices are numbers (not strings)
- Make sure subtotal + tax + tip + fees = total`
                                    },
                                    {
                                        type: "image_url",
                                        image_url: {
                                            url: `data:image/jpeg;base64,${imageToProcess}`
                                        }
                                    }
                                ]
                            }
                        ],
                        response_format: { type: "json_object" },
                        max_tokens: 1000
                    })
                });

                if (!openaiResponse.ok) {
                    const errorData = await openaiResponse.json();
                    throw new Error(`OpenAI API Error: ${errorData.error?.message || openaiResponse.statusText}`);
                }

                const data = await openaiResponse.json();
                const content = data.choices[0].message.content;

                try {
                    const receiptData = JSON.parse(content);
                    const cleanedData = validateAndCleanReceiptData(receiptData);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(cleanedData));
                } catch (parseError) {
                    throw new Error('Failed to parse receipt data from AI response');
                }

            } catch (error) {
                console.error('Receipt processing error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });

    } catch (error) {
        console.error('Request handling error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to process request' }));
    }
}

/**
 * Validate and clean the receipt data from AI
 */
function validateAndCleanReceiptData(data) {
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
            category: normalizeCategory(item.category)
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
 */
function normalizeCategory(category) {
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

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`SplitMate server running on http://0.0.0.0:${PORT}`);
    if (!OPENAI_API_KEY) {
        console.warn('Warning: OPENAI_API_KEY not set - receipt scanning will be disabled');
    }
});

module.exports = server;