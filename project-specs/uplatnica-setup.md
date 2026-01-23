# Uplatnica Generator - Project Specification

## Project Overview

**Project Name**: MC73 Generator Uplatnica
**Purpose**: A web application to manage apartment building maintenance payments, generate payment slips (uplatnica), and track payments for a residential building community (~30 apartments).

**Problem Statement**: Currently, payment slips are generated manually, printed, cut, and distributed to mailboxes. This application automates the process by providing:
- Digital management of building and apartment data
- Automatic payment slip (uplatnica) generation with IPS QR codes
- Payment tracking and balance management
- Role-based access for administrators and residents

## Core Features

### 1. Building Management
- Single building configuration (one building per installation)
- Building data fields:
  - **Address**: Street name and number
  - **City**: City name
  - **Bank Account Number**: Building's bank account for receiving payments (see Bank Account Format below)
  - **Current Payment Amount**: Default monthly maintenance fee (in RSD)

#### Bank Account Format
Serbian bank accounts are 18 digits in format: `XXX-XXXXXXXXXXXXX-XX`
- First 3 digits: Bank code
- Middle 13 digits: Account number (zero-padded)
- Last 2 digits: Control number

**Auto-formatting requirement**: When a user enters a shorter number, transform it automatically:
- Input: `16054891267`
- Parse: Bank=`160`, Control=`67`, Account=`548912`
- Pad account to 13 digits: `0000000548912`
- Output: `160-0000000548912-67`

This transformation must happen:
1. **On UI**: Immediately as user finishes typing (on blur)
2. **On API**: Validate and transform before storing in database
3. **In Database**: Always store the full 18-digit formatted version

### 2. Apartment Management
- CRUD operations for apartments (~30 apartments)
- Apartment data fields:
  - **Apartment Number**: Unique identifier (1-99)
  - **Owner Name**: First and last name of the apartment owner
  - **Floor Number**: Building floor (for address display)
  - **Apartment Number on Floor**: Apartment position on floor
  - **Overridden Payment Amount**: Optional custom amount (if different from building default)
- Link apartments to user accounts for resident access

### 3. User Management
- Two fixed roles: **admin** and **user**
- Users can have one or both roles
- Admin capabilities:
  - Full CRUD on building data
  - Full CRUD on apartments
  - Full CRUD on users
  - Generate payment slips
  - Enter payment records
  - View all data
- User capabilities:
  - View their own payment slips
  - View their payment history
  - View their current balance
- Authentication: Email/password login
- Default admin account created on first run:
  - **Email**: `admin@zgrada.local`
  - **Password**: `Admin123!`
  - **Name**: `Administrator`
  - User should be prompted to change password on first login (optional enhancement)

### 4. Payment Slip Generation

#### Serbian Language Handling
- **Database storage**: UTF-8 encoding, stores text as entered (Latin or Cyrillic)
- **Payment slip labels**: Use Serbian Cyrillic (official alphabet)
- **Payment slip data**: Display as stored in database (can be Latin or Cyrillic)
- **Mixing is normal**: Serbian users commonly mix Latin and Cyrillic

#### Payment Slip Format (Serbian "Uplatnica")
Based on the standard Serbian payment slip format. All field labels in Cyrillic:

**Left Side Fields:**
- **уплатилац** (Payer Info) - 3 lines max:
  - Line 1: Payer full name (apartment owner) - from database
  - Line 2: Payer address with floor/apartment (e.g., "Marka Čelebonovića 73, sprat 2, stan 5") - from database
  - Line 3: Payer city - from database
- **сврха уплате** (Payment Purpose):
  - Fixed text: "Месечно одржавање зграде"
- **прималац** (Recipient Info):
  - Fixed format: "Стамбена заједница [Building Address], [City]"
  - Example: "Стамбена заједница Marka Čelebonovića 73, Beograd"
  - Note: "Стамбена заједница" is fixed Cyrillic, address comes from database as-is

**Right Side Fields:**
- **шифра плаћања** (Payment Code): Empty
- **валута** (Currency): Fixed "RSD"
- **износ** (Amount): Building default or apartment override amount
- **рачун примаоца** (Recipient Account): Building bank account number
- **број модела** (Model): Empty
- **позив на број (одобрење)** (Reference Number): Format "XX/YY" where:
  - XX = apartment number (2 digits, zero-padded)
  - YY = billing month (2 digits, zero-padded)
  - Example: Apartment 3, February = "03/02"
  - Example: Apartment 20, November = "20/11"

#### IPS QR Code Integration
Generate NBS IPS QR codes for easy mobile banking payment:

**API Endpoint**: `https://nbs.rs/QRcode/api/qr/v1/gen/{size}`
**Method**: POST with JSON body

**QR Code Data Format**:
```json
{
  "K": "PR",
  "V": "01",
  "C": "1",
  "R": "[18-digit bank account number, digits only, no dashes]",
  "N": "Стамбена заједница\r\n[Building Address], [City]",
  "I": "RSD[amount without decimals or with comma for decimals]",
  "SF": "289",
  "S": "Месечно одржавање зграде",
  "RO": "[reference number without slash, e.g., 0302 for apt 3, February]"
}
```

**Example for Apartment 5, March, Amount 3500 RSD**:
```json
{
  "K": "PR",
  "V": "01",
  "C": "1",
  "R": "160000054891267",
  "N": "Стамбена заједница\r\nMarka Čelebonovića 73, Beograd",
  "I": "RSD3500",
  "SF": "289",
  "S": "Месечно одржавање зграде",
  "RO": "0503"
}
```

**Important Notes**:
- The "P" (payer) tag should be omitted as per NBS recommendations
- SF code 289 = "Ostale komunalne usluge" (Other communal services)
- QR code should be placed in bottom-right corner of payment slip
- QR code size should be maximized for easy scanning
- Label "NBS IPS QR" must appear near the QR code

**Reference Documentation**:
- API Guide: `docs/Guidelines for using the NBS IPS QR Generator-Validator.pdf`
- NBS IPS QR Portal: https://ips.nbs.rs/en/qr-validacija-generisanje

#### PDF Generation
- A4 format output
- 3 payment slips per page
- Dotted cut lines between slips
- Generate PDF for all apartments for selected month
- Each slip includes the IPS QR code
- Signature lines remain empty

### 5. Payment/Billing Tracking

#### Monthly Billing
- When generating payment slips for a month:
  - Create billing records for each apartment
  - Amount = building default or apartment override
  - Reference = "XX/YY" format

#### Payment Recording (Admin only)
- Record payments received:
  - Select apartment
  - Enter amount paid
  - Enter payment date
  - Associate with billing month (optional, can be prepayment)
- Multiple payments per month allowed

#### Balance Tracking
- Calculate running balance per apartment:
  - Positive balance = prepayment/credit
  - Negative balance = amount owed
- Display balance history
- Show current balance prominently

## Technical Requirements

### Architecture
- **Frontend**: Static HTML pages with vanilla JavaScript and CSS
- **Backend**: Node.js with Express.js REST API
- **Database**: SQLite (file-based, no installation required)

### Database Schema

```sql
-- Building configuration (single record)
CREATE TABLE building (
  id INTEGER PRIMARY KEY,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  bank_account TEXT NOT NULL,
  default_amount DECIMAL(10,2) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Apartments
CREATE TABLE apartments (
  id INTEGER PRIMARY KEY,
  apartment_number INTEGER NOT NULL UNIQUE,
  owner_name TEXT NOT NULL,
  floor_number INTEGER NOT NULL,
  apartment_on_floor INTEGER NOT NULL,
  override_amount DECIMAL(10,2),
  user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Users
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  is_user BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Monthly billing records
CREATE TABLE billings (
  id INTEGER PRIMARY KEY,
  apartment_id INTEGER NOT NULL,
  billing_month INTEGER NOT NULL,
  billing_year INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reference_number TEXT NOT NULL,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (apartment_id) REFERENCES apartments(id),
  UNIQUE(apartment_id, billing_month, billing_year)
);

-- Payment records
CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  apartment_id INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  billing_id INTEGER,
  notes TEXT,
  recorded_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (apartment_id) REFERENCES apartments(id),
  FOREIGN KEY (billing_id) REFERENCES billings(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id)
);
```

### API Endpoints

```
Authentication:
POST   /api/auth/login          - User login
POST   /api/auth/logout         - User logout
GET    /api/auth/me             - Get current user

Building:
GET    /api/building            - Get building info
PUT    /api/building            - Update building info (admin)

Apartments:
GET    /api/apartments          - List all apartments (admin) or user's apartment
GET    /api/apartments/:id      - Get apartment details
POST   /api/apartments          - Create apartment (admin)
PUT    /api/apartments/:id      - Update apartment (admin)
DELETE /api/apartments/:id      - Delete apartment (admin)

Users:
GET    /api/users               - List users (admin)
GET    /api/users/:id           - Get user details (admin or self)
POST   /api/users               - Create user (admin)
PUT    /api/users/:id           - Update user (admin or self)
DELETE /api/users/:id           - Delete user (admin)

Billing:
GET    /api/billings            - List billings (filtered by user if not admin)
POST   /api/billings/generate   - Generate billings for month (admin)
GET    /api/billings/pdf/:year/:month - Download PDF payment slips (admin)

Payments:
GET    /api/payments            - List payments (filtered by user if not admin)
POST   /api/payments            - Record payment (admin)
GET    /api/payments/balance/:apartmentId - Get apartment balance
```

### Frontend Pages

1. **Login Page** (`/login.html`)
   - Email/password form
   - Redirect to dashboard on success

2. **Dashboard** (`/index.html`)
   - Admin: Overview with quick actions
   - User: View own payment slips and balance

3. **Building Settings** (`/building.html`) - Admin only
   - Edit building information

4. **Apartments List** (`/apartments.html`) - Admin only
   - List all apartments
   - Add/edit/delete apartments

5. **Users Management** (`/users.html`) - Admin only
   - List users
   - Add/edit/delete users
   - Assign roles

6. **Payment Slips** (`/slips.html`)
   - Admin: Select month, generate slips, download PDF
   - User: View own slips for selected month

7. **Payments** (`/payments.html`)
   - Admin: Record payments, view all payment history
   - User: View own payment history

8. **Balance** (`/balance.html`)
   - Admin: View balances for all apartments
   - User: View own balance and history

### Security Requirements
- Password hashing using bcrypt
- JWT tokens for API authentication
- Session-based auth for frontend
- CORS configuration for localhost
- Input validation and sanitization
- SQL injection prevention (use parameterized queries)

### UI/UX Requirements
- Clean, simple, professional design
- Serbian language interface:
  - **Web UI**: Serbian Latin script (easier to type)
  - **Payment slips (PDF)**: Cyrillic labels, data as-entered
  - **Database**: UTF-8 supports both scripts
- Responsive layout (works on mobile/tablet)
- Clear navigation between sections
- Loading states and error messages
- Confirmation dialogs for destructive actions
- Bank account field: Auto-format on blur to `XXX-XXXXXXXXXXXXX-XX`

## Project Structure

```
mc73-generator-uplatnica/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── validation.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── building.js
│   │   │   ├── apartments.js
│   │   │   ├── users.js
│   │   │   ├── billings.js
│   │   │   └── payments.js
│   │   ├── services/
│   │   │   ├── qrCode.js
│   │   │   ├── pdfGenerator.js
│   │   │   └── bankAccount.js
│   │   └── app.js
│   ├── data/
│   │   └── database.sqlite
│   ├── package.json
│   └── .env
├── frontend/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── api.js
│   │   ├── auth.js
│   │   └── app.js
│   ├── index.html
│   ├── login.html
│   ├── building.html
│   ├── apartments.html
│   ├── users.html
│   ├── slips.html
│   ├── payments.html
│   └── balance.html
├── docs/
│   ├── Empty Payment Slip Example.png
│   └── Guidelines for using the NBS IPS QR Generator-Validator.pdf
├── project-specs/
│   └── uplatnica-setup.md
├── project-tasks/
│   └── (generated task lists)
├── CLAUDE.md
└── README.md
```

## Development Guidelines

### Utility Services

#### Bank Account Service (`bankAccount.js`)
```javascript
/**
 * Parse and format Serbian bank account number
 * Input: "16054891267" or "160-0000000548912-67"
 * Output: { bank: "160", account: "0000000548912", control: "67", formatted: "160-0000000548912-67", digits: "160000000054891267" }
 */
function parseBankAccount(input) {
  // Remove any dashes/spaces
  const digits = input.replace(/[-\s]/g, '');

  if (digits.length === 18) {
    // Already full format
    return {
      bank: digits.slice(0, 3),
      account: digits.slice(3, 16),
      control: digits.slice(16, 18),
      formatted: `${digits.slice(0, 3)}-${digits.slice(3, 16)}-${digits.slice(16, 18)}`,
      digits: digits
    };
  }

  if (digits.length >= 5 && digits.length < 18) {
    // Short format: first 3 = bank, last 2 = control, middle = account
    const bank = digits.slice(0, 3);
    const control = digits.slice(-2);
    const account = digits.slice(3, -2).padStart(13, '0');
    return {
      bank,
      account,
      control,
      formatted: `${bank}-${account}-${control}`,
      digits: `${bank}${account}${control}`
    };
  }

  throw new Error('Invalid bank account format');
}

function formatForDisplay(bankAccount) {
  const parsed = parseBankAccount(bankAccount);
  return parsed.formatted; // "160-0000000548912-67"
}

function formatForQR(bankAccount) {
  const parsed = parseBankAccount(bankAccount);
  return parsed.digits; // "160000000054891267"
}
```

### Node.js Dependencies
```json
{
  "dependencies": {
    "express": "^4.18.x",
    "better-sqlite3": "^9.x",
    "bcrypt": "^5.x",
    "jsonwebtoken": "^9.x",
    "pdfkit": "^0.14.x",
    "cors": "^2.x",
    "dotenv": "^16.x",
    "express-validator": "^7.x"
  },
  "devDependencies": {
    "nodemon": "^3.x"
  }
}
```

### Environment Variables
```
PORT=3000
JWT_SECRET=your-secret-key
DATABASE_PATH=./data/database.sqlite
```

### Running the Application
```bash
# Install dependencies
cd backend && npm install

# Initialize database (first run)
npm run init-db

# Start development server
npm run dev

# Frontend: Serve static files or open directly in browser
```

## Quality Checklist

- [ ] All API endpoints working and tested
- [ ] Authentication and authorization working
- [ ] Default admin account (`admin@zgrada.local` / `Admin123!`) works on first run
- [ ] Payment slip PDF generation with correct Cyrillic labels
- [ ] IPS QR codes generating correctly via NBS API
- [ ] Bank account auto-formatting works (UI and API)
- [ ] Balance calculations accurate
- [ ] Responsive design on mobile
- [ ] Error handling for all edge cases
- [ ] Input validation on all forms
- [ ] Serbian text displays correctly (UTF-8, both Latin and Cyrillic)
- [ ] Mixed Latin/Cyrillic text renders properly in PDF
- [ ] No security vulnerabilities (injection, XSS)

## Future Considerations (Out of Scope for MVP)
- Email notifications for new slips
- Payment reminders
- Export to Excel/CSV
- Multiple buildings support
- Online payment integration
- Audit logging
- Multi-language support

---

**Document Version**: 1.0
**Created**: 2026-01-23
**Author**: Project Specification for Multi-Agent Development
