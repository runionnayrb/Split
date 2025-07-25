# SplitMate - Expense Splitter for Couples

## Overview

SplitMate is a simple, client-side web application designed for couples to track and split shared expenses. The application allows users to add expenses, track who paid what, categorize transactions, and maintain a running balance to see who owes whom money. It's built as a pure frontend application using vanilla HTML, CSS, and JavaScript with local storage for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

SplitMate follows a simple client-side architecture with no backend dependencies:

- **Frontend**: Pure HTML/CSS/JavaScript single-page application
- **Data Storage**: Browser's localStorage for persistence
- **Architecture Pattern**: Object-oriented JavaScript with a single SplitMate class managing all functionality
- **No Server Required**: Completely client-side application

## Key Components

### 1. Frontend Structure
- **index.html**: Main HTML structure containing the expense form, balance summary, and transaction history
- **styles.css**: Modern, responsive CSS with gradient backgrounds and clean UI design
- **script.js**: Core application logic implemented as a SplitMate class

### 2. Core Functionality
- **Transaction Management**: Add, display, and delete expense transactions
- **Balance Calculation**: Real-time calculation of who owes whom
- **Data Persistence**: Automatic saving to and loading from localStorage
- **Settlement Feature**: Ability to "settle up" and clear balances

### 3. User Interface Components
- **Header Section**: App title, subtitle, and balance summary display
- **Transaction Form**: Input form for adding new expenses with fields for:
  - Who paid (Me/Spouse)
  - Amount
  - Category (appears to be dropdown-based)
  - Description
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

SplitMate has minimal external dependencies:

- **No Framework Dependencies**: Built with vanilla JavaScript
- **No CDN Dependencies**: All code is self-contained
- **Font Stack**: Uses system fonts (-apple-system, BlinkMacSystemFont, etc.)
- **No API Calls**: Purely client-side with no external service integrations

## Deployment Strategy

SplitMate can be deployed in several simple ways:

1. **Static File Hosting**: Can be hosted on any static file server (GitHub Pages, Netlify, Vercel)
2. **Local Development**: Can be run directly by opening index.html in a browser
3. **Web Server**: Can be served through any basic HTTP server (Python's http.server, Node's http-server, etc.)

The application requires no build process, database setup, or server-side configuration, making deployment extremely straightforward.

### Technical Considerations

- **Browser Compatibility**: Uses modern JavaScript features (classes, arrow functions)
- **Responsive Design**: CSS includes responsive design patterns
- **Data Persistence**: Relies on localStorage, so data is browser-specific
- **No User Authentication**: Single-user application per browser session
- **Offline Capable**: Works completely offline once loaded