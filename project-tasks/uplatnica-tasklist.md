# MC73 Generator Uplatnica - Implementation Task List

**Generated**: 2026-01-23
**Source**: project-specs/uplatnica-setup.md
**Total Tasks**: 15

---

## Task Overview

| # | Task | Category | Dependencies |
|---|------|----------|--------------|
| 1 | Project Setup & Configuration | Infrastructure | None |
| 2 | Database Schema & Initialization | Backend | Task 1 |
| 3 | Bank Account Service | Backend | Task 1 |
| 4 | Authentication System | Backend | Task 2 |
| 5 | Building API Endpoints | Backend | Tasks 2, 4 |
| 6 | Apartments API Endpoints | Backend | Tasks 2, 4 |
| 7 | Users API Endpoints | Backend | Tasks 2, 4 |
| 8 | QR Code Service | Backend | Task 3 |
| 9 | PDF Generation Service | Backend | Task 8 |
| 10 | Billings & Payments API | Backend | Tasks 2, 4, 9 |
| 11 | Frontend Foundation & Auth | Frontend | Task 4 |
| 12 | Admin Pages (Building, Apartments, Users) | Frontend | Tasks 5, 6, 7, 11 |
| 13 | Payment Slips & PDF Download | Frontend | Tasks 9, 10, 11 |
| 14 | Payments & Balance Pages | Frontend | Tasks 10, 11 |
| 15 | Integration Testing & Polish | Testing | All |

---

## Detailed Task Specifications

### [ ] Task 1: Project Setup & Configuration

**Category**: Infrastructure
**Estimated Complexity**: Low

**Requirements** (from spec):
- "Node.js with Express.js REST API" (line 188)
- "SQLite (file-based, no installation required)" (line 189)
- Project structure as defined (lines 354-402)
- Environment variables: PORT, JWT_SECRET, DATABASE_PATH (lines 479-483)

**Deliverables**:
1. Create `backend/` directory structure:
   - `src/config/`, `src/middleware/`, `src/routes/`, `src/services/`
   - `data/` for SQLite database
2. Create `frontend/` directory structure:
   - `css/`, `js/`
3. Create `backend/package.json` with dependencies:
   - express, better-sqlite3, bcrypt, jsonwebtoken, pdfkit, cors, dotenv, express-validator
   - devDependencies: nodemon
4. Create `backend/.env` with default configuration
5. Create `backend/src/app.js` with Express server setup

**Acceptance Criteria**:
- `npm install` completes without errors
- `npm run dev` starts server on configured PORT
- Server responds to health check endpoint

---

### [ ] Task 2: Database Schema & Initialization

**Category**: Backend
**Dependencies**: Task 1

**Requirements** (from spec):
- Database schema exactly as defined (lines 194-258)
- Tables: building, apartments, users, billings, payments
- Default admin account on first run (lines 66-70):
  - Email: `admin@zgrada.local`
  - Password: `Admin123!`
  - Name: `Administrator`

**Deliverables**:
1. Create `backend/src/config/database.js`:
   - SQLite connection using better-sqlite3
   - Schema creation on first run
   - All tables with correct columns and constraints
2. Create database initialization script:
   - Create all tables if not exist
   - Insert default admin user with bcrypt-hashed password
   - Insert sample building data (optional)
3. Add `npm run init-db` script to package.json

**Acceptance Criteria**:
- Database file created at configured path
- All 5 tables exist with correct schema
- Default admin user exists with hashed password
- Foreign key constraints work correctly

---

### [ ] Task 3: Bank Account Service

**Category**: Backend
**Dependencies**: Task 1

**Requirements** (from spec):
- Bank account format: `XXX-XXXXXXXXXXXXX-XX` (18 digits) (lines 25-28)
- Auto-formatting from short input (lines 30-39):
  - Input: `16054891267`
  - Parse: Bank=`160`, Control=`67`, Account=`548912`
  - Pad account to 13 digits: `0000000548912`
  - Output: `160-0000000548912-67`
- Implementation as specified (lines 410-457)

**Deliverables**:
1. Create `backend/src/services/bankAccount.js`:
   - `parseBankAccount(input)` - returns {bank, account, control, formatted, digits}
   - `formatForDisplay(bankAccount)` - returns "XXX-XXXXXXXXXXXXX-XX"
   - `formatForQR(bankAccount)` - returns 18-digit string
   - `isValidBankAccount(input)` - validation function
2. Handle both short and full format inputs
3. Throw meaningful errors for invalid formats

**Acceptance Criteria**:
- Short input transforms correctly: `16054891267` -> `160-0000000548912-67`
- Full input passes through: `160-0000000548912-67` -> `160-0000000548912-67`
- Invalid inputs throw appropriate errors
- Digits-only output works: `160000000054891267`

---

### [ ] Task 4: Authentication System

**Category**: Backend
**Dependencies**: Task 2

**Requirements** (from spec):
- Two fixed roles: admin and user (lines 52-53)
- Users can have one or both roles (line 53)
- JWT tokens for API authentication (line 336)
- Session-based auth for frontend (line 337)
- Password hashing using bcrypt (line 335)
- API endpoints (lines 264-267):
  - POST /api/auth/login
  - POST /api/auth/logout
  - GET /api/auth/me

**Deliverables**:
1. Create `backend/src/middleware/auth.js`:
   - JWT token verification middleware
   - Role-based access control (requireAdmin, requireUser)
   - Extract user from token
2. Create `backend/src/routes/auth.js`:
   - Login endpoint: validate credentials, return JWT
   - Logout endpoint: client-side token removal
   - Me endpoint: return current user info
3. Cookie-based JWT storage for frontend convenience

**Acceptance Criteria**:
- Login with admin@zgrada.local / Admin123! returns valid JWT
- Invalid credentials return 401
- Protected endpoints reject requests without valid token
- Admin-only endpoints reject non-admin users
- Me endpoint returns current user data

---

### [ ] Task 5: Building API Endpoints

**Category**: Backend
**Dependencies**: Tasks 2, 4

**Requirements** (from spec):
- Single building configuration (line 16)
- Building fields (lines 17-22): address, city, bank_account, default_amount
- Bank account auto-formatting on API (lines 37-39)
- API endpoints (lines 269-271):
  - GET /api/building - Get building info
  - PUT /api/building - Update building info (admin)

**Deliverables**:
1. Create `backend/src/routes/building.js`:
   - GET /api/building: Return building configuration (any authenticated user)
   - PUT /api/building: Update building (admin only)
2. Validate bank account format and auto-transform before storing
3. Validate default_amount is positive number

**Acceptance Criteria**:
- GET returns building data with formatted bank account
- PUT updates building data (admin only)
- Bank account auto-formatted before storage
- Non-admin PUT returns 403

---

### [ ] Task 6: Apartments API Endpoints

**Category**: Backend
**Dependencies**: Tasks 2, 4

**Requirements** (from spec):
- CRUD operations for apartments (line 42)
- Apartment fields (lines 43-49): apartment_number, owner_name, floor_number, apartment_on_floor, override_amount
- Link apartments to user accounts (line 49)
- Admin: Full CRUD (line 55)
- User: View own apartment only
- API endpoints (lines 273-279)

**Deliverables**:
1. Create `backend/src/routes/apartments.js`:
   - GET /api/apartments: List all (admin) or own apartment (user)
   - GET /api/apartments/:id: Get details
   - POST /api/apartments: Create (admin)
   - PUT /api/apartments/:id: Update (admin)
   - DELETE /api/apartments/:id: Delete (admin)
2. Validate apartment_number is unique and 1-99
3. Validate override_amount if provided

**Acceptance Criteria**:
- Admin can CRUD all apartments
- User can only view their linked apartment
- Apartment number uniqueness enforced
- Proper error messages for validation failures

---

### [ ] Task 7: Users API Endpoints

**Category**: Backend
**Dependencies**: Tasks 2, 4

**Requirements** (from spec):
- Two fixed roles: admin and user (line 52)
- Users can have one or both roles (line 53)
- Admin capabilities (lines 54-60)
- User capabilities (lines 61-64)
- API endpoints (lines 281-286)

**Deliverables**:
1. Create `backend/src/routes/users.js`:
   - GET /api/users: List users (admin)
   - GET /api/users/:id: Get details (admin or self)
   - POST /api/users: Create user (admin)
   - PUT /api/users/:id: Update user (admin or self)
   - DELETE /api/users/:id: Delete user (admin)
2. Password hashing for new users
3. Prevent deletion of last admin
4. Allow self-update of own profile (name, password only)

**Acceptance Criteria**:
- Admin can CRUD all users
- User can view/update own profile only
- Passwords properly hashed
- Cannot delete last admin user
- Email uniqueness enforced

---

### [ ] Task 8: QR Code Service

**Category**: Backend
**Dependencies**: Task 3

**Requirements** (from spec):
- NBS IPS QR API: `https://nbs.rs/QRcode/api/qr/v1/gen/{size}` (line 110)
- POST with JSON body (line 111)
- QR code data format (lines 114-126)
- Required fields: K, V, C, R, N, I, SF, S, RO
- SF code 289 (line 145)
- Omit P (payer) tag (line 144)
- Reference documentation (lines 150-152)

**Deliverables**:
1. Create `backend/src/services/qrCode.js`:
   - `generateQRCodeUrl(params)` - build API URL
   - `generateQRCodeData(apartment, building, month, year)` - build JSON payload
   - `fetchQRCode(paymentData, size)` - call NBS API, return image buffer
2. Proper formatting:
   - R: 18-digit bank account (no dashes)
   - N: "Stambenazajednica\r\n[address], [city]" (Cyrillic)
   - I: "RSD" + amount (no decimals)
   - RO: 4-digit reference (XXYY)
3. Error handling for API failures

**Acceptance Criteria**:
- QR code data formatted correctly per spec
- NBS API called successfully
- QR code image returned as buffer/base64
- API errors handled gracefully with fallback

---

### [ ] Task 9: PDF Generation Service

**Category**: Backend
**Dependencies**: Task 8

**Requirements** (from spec):
- A4 format output (line 155)
- 3 payment slips per page (line 156)
- Dotted cut lines between slips (line 157)
- Payment slip format (lines 81-106):
  - Left side: uplatilac, svrha uplate, primalac (Cyrillic labels)
  - Right side: sifra placanja, valuta, iznos, racun primaoca, broj modela, poziv na broj
- QR code in bottom-right corner (line 147)
- Label "NBS IPS QR" near QR code (line 148)
- Signature lines remain empty (line 160)
- Reference image: docs/Empty Payment Slip Example.png

**Deliverables**:
1. Create `backend/src/services/pdfGenerator.js`:
   - `generatePaymentSlipPDF(apartments, building, month, year)` - main function
   - Draw payment slip layout matching spec
   - Embed QR codes from QR service
2. Serbian Cyrillic labels:
   - uplatilac, svrha uplate, primalac
   - sifra placanja, valuta, iznos, racun primaoca, broj modela, poziv na broj
3. Proper text encoding (UTF-8 for Cyrillic)
4. 3 slips per A4 page with dotted cut lines

**Acceptance Criteria**:
- PDF generates with correct layout
- All Cyrillic labels display correctly
- QR codes embedded and scannable
- 3 slips per page with cut lines
- Data fields populated from database

---

### [ ] Task 10: Billings & Payments API

**Category**: Backend
**Dependencies**: Tasks 2, 4, 9

**Requirements** (from spec):
- Monthly billing (lines 163-168)
- Payment recording admin only (lines 170-177)
- Balance tracking (lines 179-184)
- API endpoints (lines 288-296):
  - GET /api/billings
  - POST /api/billings/generate
  - GET /api/billings/pdf/:year/:month
  - GET /api/payments
  - POST /api/payments
  - GET /api/payments/balance/:apartmentId

**Deliverables**:
1. Create `backend/src/routes/billings.js`:
   - GET /api/billings: List (filtered by user if not admin)
   - POST /api/billings/generate: Generate for month (admin)
   - GET /api/billings/pdf/:year/:month: Download PDF (admin)
2. Create `backend/src/routes/payments.js`:
   - GET /api/payments: List (filtered by user if not admin)
   - POST /api/payments: Record payment (admin)
   - GET /api/payments/balance/:apartmentId: Calculate balance
3. Balance calculation: sum(payments) - sum(billings)

**Acceptance Criteria**:
- Billing generation creates records for all apartments
- PDF endpoint returns valid PDF file
- Payment recording works with proper validation
- Balance calculation accurate (positive = credit, negative = owed)
- Users can only see their own data

---

### [ ] Task 11: Frontend Foundation & Auth

**Category**: Frontend
**Dependencies**: Task 4

**Requirements** (from spec):
- Static HTML pages with vanilla JavaScript and CSS (line 187)
- Login page (lines 300-302)
- Responsive layout (line 347)
- Serbian Latin script for UI (lines 343-345)
- Loading states and error messages (line 349)

**Deliverables**:
1. Create `frontend/css/styles.css`:
   - Clean, professional design
   - Responsive layout (mobile/tablet)
   - Form styling
   - Navigation styling
   - Loading states
2. Create `frontend/js/api.js`:
   - API client with JWT handling
   - Error handling
   - Base URL configuration
3. Create `frontend/js/auth.js`:
   - Login/logout functions
   - Token storage
   - Auth state management
4. Create `frontend/login.html`:
   - Email/password form
   - Error display
   - Redirect on success

**Acceptance Criteria**:
- Login page displays correctly
- Login with valid credentials redirects to dashboard
- Invalid credentials show error message
- Responsive on mobile devices
- JWT stored securely

---

### [ ] Task 12: Admin Pages (Building, Apartments, Users)

**Category**: Frontend
**Dependencies**: Tasks 5, 6, 7, 11

**Requirements** (from spec):
- Building Settings page (lines 308-309)
- Apartments List page (lines 311-314)
- Users Management page (lines 316-319)
- Confirmation dialogs for destructive actions (line 350)
- Bank account auto-format on blur (line 351)

**Deliverables**:
1. Create `frontend/building.html`:
   - Display/edit building info
   - Bank account field with auto-format on blur
   - Save button with loading state
2. Create `frontend/apartments.html`:
   - List all apartments in table
   - Add/edit/delete functionality
   - Modal or inline forms
3. Create `frontend/users.html`:
   - List all users
   - Add/edit/delete users
   - Role assignment (admin/user checkboxes)
4. Create `frontend/js/app.js`:
   - Shared UI functions
   - Navigation
   - Admin check

**Acceptance Criteria**:
- All admin pages accessible only to admins
- CRUD operations work correctly
- Bank account auto-formats on blur
- Confirmation dialogs for delete actions
- Loading states during API calls

---

### [ ] Task 13: Payment Slips & PDF Download

**Category**: Frontend
**Dependencies**: Tasks 9, 10, 11

**Requirements** (from spec):
- Payment Slips page (lines 321-324):
  - Admin: Select month, generate slips, download PDF
  - User: View own slips for selected month
- Generate PDF for all apartments for selected month (line 158)

**Deliverables**:
1. Create `frontend/slips.html`:
   - Month/year selector
   - Admin view:
     - Generate slips button
     - Download PDF button
     - List of generated slips
   - User view:
     - View own slip for selected month
2. PDF download triggers file download
3. Show slip preview/details

**Acceptance Criteria**:
- Month/year selection works
- Admin can generate slips for all apartments
- PDF download works correctly
- User sees only own slips
- Loading states during generation

---

### [ ] Task 14: Payments & Balance Pages

**Category**: Frontend
**Dependencies**: Tasks 10, 11

**Requirements** (from spec):
- Payments page (lines 326-328):
  - Admin: Record payments, view all history
  - User: View own payment history
- Balance page (lines 330-332):
  - Admin: View balances for all apartments
  - User: View own balance and history

**Deliverables**:
1. Create `frontend/payments.html`:
   - Admin: Payment recording form + history table
   - User: Own payment history
   - Filter by apartment/date
2. Create `frontend/balance.html`:
   - Admin: All apartments with balances
   - User: Own balance prominently displayed
   - Balance history chart/table
3. Create `frontend/index.html` (Dashboard):
   - Admin: Quick stats, recent activity
   - User: Own balance, recent slips

**Acceptance Criteria**:
- Payment recording works (admin)
- Balance displays correctly (positive = credit, negative = owed)
- History displays chronologically
- Dashboard shows appropriate data per role
- Responsive design

---

### [ ] Task 15: Integration Testing & Polish

**Category**: Testing
**Dependencies**: All previous tasks

**Requirements** (from spec):
- Quality checklist (lines 499-513)
- All API endpoints working and tested
- Default admin account works
- IPS QR codes generating correctly
- Bank account auto-formatting works
- Balance calculations accurate
- Serbian text displays correctly (UTF-8)
- Mixed Latin/Cyrillic renders properly
- No security vulnerabilities

**Deliverables**:
1. End-to-end testing:
   - Complete user flows (login -> generate slips -> record payment -> view balance)
   - All API endpoints tested
   - Error handling tested
2. Cross-browser testing
3. Mobile responsiveness verification
4. Security review:
   - SQL injection prevention
   - XSS prevention
   - Auth bypass attempts
5. Documentation:
   - README.md with setup instructions
   - API documentation

**Acceptance Criteria**:
- Full workflow works without errors
- Default admin login works
- PDF with QR codes generates correctly
- Bank account formatting works in UI and API
- Balance calculations accurate
- No console errors
- Responsive on all devices

---

## Notes for Implementation

### Serbian Language Handling
- **Database**: UTF-8, stores text as entered
- **Web UI**: Serbian Latin (easier to type)
- **Payment slips (PDF)**: Cyrillic labels, data as-entered
- Mixing Latin and Cyrillic is normal and expected

### Bank Account Key Points
- Always store 18-digit formatted version
- Auto-format on UI blur AND API validation
- Display with dashes, QR uses digits only

### QR Code Integration
- NBS API may have rate limits
- Cache QR codes if possible
- Handle API failures gracefully

---

**Document Version**: 1.0
**Generated by**: WorkflowOrchestrator Pipeline
