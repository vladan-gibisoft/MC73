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

- **Backend**: Cloudflare Workers with Hono framework
- **Database**: Cloudflare D1 (SQLite-compatible)
- **Frontend**: Static HTML/CSS/JavaScript (vanilla)
- **PDF Generation**: PDFKit with embedded fonts
- **QR Codes**: NBS IPS QR API integration
- **Authentication**: JWT (jose library)

## Project Structure

```
mc73-generator-uplatnica/
├── worker/                    # Cloudflare Worker API
│   ├── src/
│   │   ├── index.ts          # Entry point (Hono app)
│   │   ├── types.ts          # TypeScript types
│   │   ├── routes/           # API route handlers
│   │   ├── middleware/       # Auth, validation
│   │   ├── services/         # QR, PDF, bank account
│   │   ├── db/               # Schema, seed, queries
│   │   └── fonts/            # Embedded fonts (base64)
│   ├── wrangler.toml         # Cloudflare config
│   └── package.json
├── frontend/                  # Static web frontend
│   ├── css/styles.css
│   ├── js/                   # API client, auth, app
│   └── *.html                # Page templates
├── .vscode/                   # VS Code debug configs
│   ├── launch.json
│   └── tasks.json
└── docs/                      # Reference documentation
```

## Local Development

### Prerequisites

- Node.js 18+
- npm
- Wrangler CLI (installed via npm)

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd mc73-generator-uplatnica
```

2. Install worker dependencies:
```bash
cd worker
npm install
```

3. Initialize local database:
```bash
npm run d1:migrate:local
npm run d1:seed:local
```

4. Start development servers:
```bash
# Terminal 1: Start backend (API on http://localhost:8787)
npm run dev

# Terminal 2: Start frontend (on http://localhost:3000)
cd ../frontend
npx serve -l 3000
```

5. Open http://localhost:3000 in your browser

### VS Code Debugging

The project includes VS Code debug configurations:

1. Open the project in VS Code
2. Go to **Run and Debug** (Ctrl+Shift+D)
3. Select **"Full Stack (Frontend + Backend)"** from the dropdown
4. Press F5

This starts both the backend API and frontend server. Open http://localhost:3000 to use the app.

**Available configurations:**
| Configuration | Description |
|---------------|-------------|
| Full Stack (Frontend + Backend) | Run both servers in parallel |
| Debug Worker (wrangler dev) | Backend API only |
| Serve Frontend | Frontend server only |
| Migrate DB (local) | Run D1 migrations |
| Seed DB (local) | Seed local database |

## Deployment to Cloudflare

### Deploy Worker (Backend API)

```bash
cd worker
npm run deploy
```

This deploys to Cloudflare Workers using the remote D1 database.

### Deploy Frontend (Cloudflare Pages)

1. Create a Cloudflare Pages project
2. Connect to your Git repository
3. Set build settings:
   - Build command: (leave empty)
   - Build output directory: `frontend`
4. Deploy

The frontend auto-detects the environment and uses the correct API URL.

### Set Production Secrets

```bash
cd worker
wrangler secret put JWT_SECRET
# Enter a secure random string when prompted
```

## Default Admin Account

- **Email**: `admin@zgrada.local`
- **Password**: `Admin123!`

**Important**: Change this password after first login!

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
- `GET /api/billings/months` - List billing months
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

### Health
- `GET /api/health` - Health check (no auth required)

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

`XX-YY` where:
- XX = Apartment number (2 digits, zero-padded)
- YY = Billing month (2 digits, zero-padded)

Example: Apartment 3, February = `03-02`

## Security

- Passwords hashed with bcryptjs
- JWT tokens for API authentication
- Role-based access control
- Input validation and sanitization
- Parameterized SQL queries (SQL injection prevention)

## License

Private project for residential building management.
