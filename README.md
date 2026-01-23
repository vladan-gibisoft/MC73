# MC73 Generator Uplatnica

A web application for managing apartment building maintenance payments, generating Serbian payment slips (uplatnica) with NBS IPS QR codes, and tracking payments for residential building communities.

## Features

- **Building Management**: Configure building address, bank account, and default payment amount
- **Apartment Management**: CRUD operations for apartments with optional custom payment amounts
- **User Management**: Admin and user roles with appropriate access control
- **Payment Slip Generation**: A4 PDF with 3 payment slips per page, Serbian Cyrillic labels, NBS IPS QR codes
- **Payment Tracking**: Record payments and track balances per apartment
- **Balance Management**: View payment history and current balance for all apartments

## Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: SQLite (better-sqlite3)
- **Frontend**: Static HTML/CSS/JavaScript (vanilla)
- **PDF Generation**: PDFKit
- **QR Codes**: NBS IPS QR API integration

## Installation

### Prerequisites

- Node.js 18.x or higher
- npm

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd mc73-generator-uplatnica
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Initialize the database:
```bash
npm run init-db
```

This creates the SQLite database with:
- All required tables (building, apartments, users, billings, payments)
- Default admin account
- Sample building data

4. Start the development server:
```bash
npm run dev
```

5. Open the application:
- Frontend: http://localhost:3000
- API: http://localhost:3000/api

## Default Admin Account

After initialization, you can log in with:
- **Email**: `admin@zgrada.local`
- **Password**: `Admin123!`

**Important**: Change this password after first login!

## Configuration

Environment variables (`.env` file in backend directory):

```env
PORT=3000
JWT_SECRET=your-secret-key-change-in-production
DATABASE_PATH=./data/database.sqlite
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Building (Admin only for PUT)
- `GET /api/building` - Get building info
- `PUT /api/building` - Update building info

### Apartments
- `GET /api/apartments` - List apartments
- `GET /api/apartments/:id` - Get apartment details
- `POST /api/apartments` - Create apartment (admin)
- `PUT /api/apartments/:id` - Update apartment (admin)
- `DELETE /api/apartments/:id` - Delete apartment (admin)

### Users (Admin only)
- `GET /api/users` - List users
- `GET /api/users/:id` - Get user details
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Billings
- `GET /api/billings` - List billings
- `POST /api/billings/generate` - Generate billings for month (admin)
- `DELETE /api/billings/:year/:month` - Delete billings for month (admin)
- `GET /api/billings/pdf/:year/:month` - Download PDF payment slips (admin)

### Payments
- `GET /api/payments` - List payments
- `POST /api/payments` - Record payment (admin)
- `DELETE /api/payments/:id` - Delete payment (admin)
- `GET /api/payments/balance/:apartmentId` - Get apartment balance
- `GET /api/payments/balances` - Get all balances (admin)
- `GET /api/payments/history/:apartmentId` - Get payment history

## Bank Account Format

Serbian bank accounts use the format: `XXX-XXXXXXXXXXXXX-XX` (18 digits)
- First 3 digits: Bank code
- Middle 13 digits: Account number (zero-padded)
- Last 2 digits: Control number

The application auto-formats short input:
- Input: `16054891267`
- Output: `160-0000000548912-67`

## Payment Slip (Uplatnica) Format

The PDF payment slips follow the Serbian standard format with:
- Left side: Payer info, payment purpose, recipient
- Right side: Payment code, currency, amount, account, model, reference number
- QR code: NBS IPS QR code for mobile banking payment
- Labels: Serbian Cyrillic
- Data: As stored in database (Latin or Cyrillic)

## Reference Number Format

`XX/YY` where:
- XX = Apartment number (2 digits, zero-padded)
- YY = Billing month (2 digits, zero-padded)

Example: Apartment 3, February = `03/02`

## Project Structure

```
mc73-generator-uplatnica/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js      # SQLite configuration
│   │   │   └── init-db.js       # Database initialization
│   │   ├── middleware/
│   │   │   ├── auth.js          # JWT authentication
│   │   │   └── validation.js    # Input validation
│   │   ├── routes/
│   │   │   ├── auth.js          # Authentication routes
│   │   │   ├── building.js      # Building routes
│   │   │   ├── apartments.js    # Apartments routes
│   │   │   ├── users.js         # Users routes
│   │   │   ├── billings.js      # Billings routes
│   │   │   └── payments.js      # Payments routes
│   │   ├── services/
│   │   │   ├── bankAccount.js   # Bank account formatting
│   │   │   ├── qrCode.js        # NBS IPS QR generation
│   │   │   └── pdfGenerator.js  # Payment slip PDF
│   │   └── app.js               # Express application
│   ├── data/
│   │   └── database.sqlite      # SQLite database
│   ├── package.json
│   └── .env
├── frontend/
│   ├── css/
│   │   └── styles.css           # Main stylesheet
│   ├── js/
│   │   ├── api.js               # API client
│   │   ├── auth.js              # Authentication
│   │   └── app.js               # Shared utilities
│   ├── index.html               # Dashboard
│   ├── login.html               # Login page
│   ├── building.html            # Building settings
│   ├── apartments.html          # Apartments management
│   ├── users.html               # Users management
│   ├── slips.html               # Payment slips
│   ├── payments.html            # Payments
│   └── balance.html             # Balance tracking
├── docs/
│   ├── Empty Payment Slip Example.png
│   └── Guidelines for using the NBS IPS QR Generator-Validator.pdf
├── project-specs/
│   └── uplatnica-setup.md       # Project specification
├── project-tasks/
│   └── uplatnica-tasklist.md    # Implementation task list
├── CLAUDE.md
└── README.md
```

## Security

- Passwords hashed with bcrypt
- JWT tokens for API authentication
- Role-based access control
- Input validation and sanitization
- Parameterized SQL queries (SQL injection prevention)

## License

Private project for residential building management.
