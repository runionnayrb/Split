# SplitMate - Expense Splitter for Couples

## Overview

SplitMate is a simple, client-side web application designed for couples to track and split shared expenses. The application allows users to add expenses, track who paid what, categorize transactions, and maintain a running balance to see who owes whom money. It's built as a pure frontend application using vanilla HTML, CSS, and JavaScript with local storage for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

SplitMate has been enhanced with receipt scanning capabilities using a hybrid architecture:

- **Frontend**: HTML/CSS/JavaScript single-page application with dual input modes
- **Backend**: Node.js server for OpenAI API integration and secure key handling
- **Data Storage**: Browser's localStorage for persistence
- **Architecture Pattern**: Object-oriented JavaScript with SplitMate class + ReceiptProcessor
- **API Integration**: OpenAI GPT-4o Vision API for receipt text extraction and parsing

## Key Components

### 1. Frontend Structure
- **index.html**: Main HTML structure containing the expense form, balance summary, and transaction history
- **styles.css**: Modern, responsive CSS with gradient backgrounds and clean UI design
- **script.js**: Core application logic implemented as a SplitMate class

### 2. Core Functionality
- **Dual Input Modes**: Manual expense entry and receipt scanning via tabs
- **Receipt Processing**: AI-powered receipt scanning with itemized expense extraction
- **Smart Splitting**: Automatic 50/50 split of taxes, tips, and fees from receipts
- **Transaction Management**: Add, display, and delete expense transactions
- **Balance Calculation**: Real-time calculation of who owes whom
- **Data Persistence**: Automatic saving to and loading from localStorage
- **Settlement Feature**: Ability to "settle up" and clear balances

### 3. User Interface Components
- **Header Section**: App title, subtitle, and balance summary display
- **Tabbed Input Interface**: Switch between "Manual Entry" and "Scan Receipt"
- **Manual Transaction Form**: Traditional input form with fields for:
  - Who paid (Me/Spouse)
  - Amount
  - Category (groceries, dining, travel, shopping, other)
  - Description
- **Receipt Upload Interface**: Drag-and-drop or click-to-upload with image preview
- **Receipt Processing Results**: Interactive itemized list with:
  - Checkbox selection for each item
  - Automatic category assignment
  - Subtotal calculation and 50/50 fee splitting
  - Summary showing taxes, tips, and fees split evenly
- **Transaction History**: Table showing all past transactions
- **Settlement Modal**: Confirmation dialog for settling up balances

## Data Flow

1. **User Input**: User fills out expense form with transaction details
2. **Data Processing**: JavaScript validates and processes the form data
3. **State Update**: Transaction is added to the internal transactions array
4. **Balance Calculation**: Totals are recalculated for both parties
5. **UI Update**: Display is refreshed to show new transaction and updated balances
6. **Persistence**: Data is automatically saved to localStorage

## External Dependencies

SplitMate now includes AI-powered receipt processing:

- **Runtime**: Node.js server for backend API handling
- **OpenAI Integration**: GPT-4o Vision API for receipt text extraction
- **No Framework Dependencies**: Frontend built with vanilla JavaScript
- **No CDN Dependencies**: All code is self-contained
- **Font Stack**: Uses system fonts (-apple-system, BlinkMacSystemFont, etc.)
- **API Requirements**: OpenAI API key required for receipt scanning functionality

## Deployment Strategy

SplitMate now requires a Node.js server for full functionality:

1. **Node.js Deployment**: Primary deployment method using server.js
2. **Environment Variables**: OPENAI_API_KEY required for receipt scanning
3. **Fallback Mode**: Manual entry still works without API key
4. **Static Hosting**: Basic manual-entry-only version can still be hosted statically

The application now requires server-side configuration for receipt scanning, but maintains backward compatibility for manual expense entry.

### Technical Considerations

- **Browser Compatibility**: Uses modern JavaScript features (classes, arrow functions, fetch API)
- **Responsive Design**: CSS includes responsive design patterns for mobile devices
- **Data Persistence**: Relies on localStorage, so data is browser-specific
- **No User Authentication**: Single-user application per browser session
- **Hybrid Offline/Online**: Manual entry works offline, receipt scanning requires internet
- **File Processing**: Supports JPG, PNG, WebP, and PDF files up to 10MB for receipt scanning
- **AI Integration**: Uses OpenAI GPT-4o Vision API for receipt text extraction and categorization

## Recent Changes (July 25, 2025)

✓ Added receipt scanning functionality with OpenAI Vision API integration
✓ Implemented tabbed interface for manual vs receipt entry modes
✓ Created Node.js server backend for secure API key handling
✓ Added drag-and-drop receipt upload with image preview
✓ Built intelligent expense parsing with automatic categorization
✓ Implemented 50/50 splitting logic for taxes, tips, and delivery fees
✓ Enhanced UI with receipt processing workflow and item selection
✓ Maintained backward compatibility with manual entry mode
✓ Optimized entire interface for iPhone and mobile use
✓ Added iOS-specific meta tags for web app functionality
✓ Implemented touch-friendly buttons and gestures
✓ Enhanced mobile form inputs to prevent zoom on iOS
✓ Added sticky table headers and smooth scrolling
✓ Optimized upload area for touch interaction
✓ Fixed deployment configuration with proper run command setup
✓ Added Procfile and start.sh for deployment compatibility
✓ Verified server properly binds to 0.0.0.0:5000 for deployment
✓ Created Procfile with "web: node server.js" for deployment health checks
✓ Added executable start.sh script for alternative deployment methods
✓ Confirmed server uses process.env.PORT for dynamic port binding
✓ Extended receipt scanning to support PDF files alongside images
✓ Implemented PDF to image conversion using pdf2pic library
✓ Added PDF-specific preview interface with file icon and name display
✓ Enhanced file validation to accept both images and PDFs up to 10MB
✓ Updated backend to convert PDF first page to high-resolution image for AI processing
✓ Implemented frontend PDF to image conversion using PDF.js for scanned PDF receipts
✓ Added hybrid PDF processing: frontend conversion for better compatibility with Publix app PDFs
✓ Integrated PDF.js CDN for client-side PDF rendering and image extraction
✓ Enhanced receipt processor to automatically detect and convert PDF files to images
✓ Implemented iOS-style bottom sheet modal for individual transaction payments
✓ Added smooth slide-up/slide-down animations with cubic-bezier easing
✓ Integrated receipt image storage and display within transaction modals
✓ Enhanced transaction rows with hover effects and clickable indicators
✓ Added receipt image preservation for transactions created from receipt scanning
✓ Implemented comprehensive internationalization system with English/Japanese language switching
✓ Created language toggle button in header with EN/JP options and proper centering
✓ Added complete Japanese translations for all interface elements and dynamic content
✓ Implemented persistent language preferences using localStorage (unique per browser/device)
✓ Enhanced date formatting for both English and Japanese languages
✓ Added mobile-responsive language switcher with proper header layout