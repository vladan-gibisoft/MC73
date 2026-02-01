# MC73 API Worker

Cloudflare Worker API for the MC73 Generator Uplatnica application.

## Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI

## Setup

### 1. Install Dependencies

```bash
cd worker
npm install
```

### 2. Create D1 Database

```bash
# Create the database (note the database_id returned)
npm run d1:create

# Update wrangler.toml with the returned database_id
```

### 3. Run Migrations

```bash
# For local development
npm run d1:migrate:local
npm run d1:seed:local

# For production
npm run d1:migrate
npm run d1:seed
```

### 4. Generate Embedded Fonts (if needed)

The fonts are already embedded in `src/fonts/notoSans.ts`. If you need to regenerate them:

```bash
npm run generate-fonts
```

### 5. Configure Secrets

**For local development**, secrets are stored in `.dev.vars` (already created, gitignored):
```
JWT_SECRET=dev-secret-change-in-production
```

**For production**, set secrets via Wrangler:
```bash
wrangler secret put JWT_SECRET
# Enter a secure random string when prompted
```

## Development

```bash
# Start local development server
npm run dev

# The API will be available at http://localhost:8787
```

## Deployment

```bash
# Deploy to Cloudflare
npm run deploy
```

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/auth/login | User login | - |
| POST | /api/auth/logout | User logout | - |
| GET | /api/auth/me | Get current user | Required |
| GET | /api/building | Get building config | Required |
| PUT | /api/building | Update building config | Admin |
| GET | /api/apartments | List apartments | Required |
| GET | /api/apartments/:id | Get apartment | Required |
| POST | /api/apartments | Create apartment | Admin |
| PUT | /api/apartments/:id | Update apartment | Admin |
| DELETE | /api/apartments/:id | Delete apartment | Admin |
| GET | /api/users | List users | Admin |
| GET | /api/users/:id | Get user | Admin/Self |
| POST | /api/users | Create user | Admin |
| PUT | /api/users/:id | Update user | Admin/Self |
| DELETE | /api/users/:id | Delete user | Admin |
| GET | /api/billings | List billings | Required |
| POST | /api/billings/generate | Generate billings | Admin |
| DELETE | /api/billings/:year/:month | Delete billings | Admin |
| GET | /api/billings/pdf/:year/:month | Download PDF | Admin |
| GET | /api/billings/months | List billing months | Required |
| GET | /api/payments | List payments | Required |
| POST | /api/payments | Record payment | Admin |
| DELETE | /api/payments/:id | Delete payment | Admin |
| GET | /api/payments/balance/:apartmentId | Get balance | Required |
| GET | /api/payments/balances | Get all balances | Admin |
| GET | /api/payments/history/:apartmentId | Get history | Required |
| GET | /api/health | Health check | - |

## Project Structure

```
worker/
├── src/
│   ├── index.ts            # Entry point (Hono app)
│   ├── types.ts            # TypeScript types
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── building.ts
│   │   ├── apartments.ts
│   │   ├── users.ts
│   │   ├── billings.ts
│   │   └── payments.ts
│   ├── middleware/
│   │   ├── auth.ts         # JWT authentication
│   │   └── validation.ts   # Input validation
│   ├── services/
│   │   ├── bankAccount.ts  # Bank account formatting
│   │   ├── qrCode.ts       # NBS IPS QR generation
│   │   └── pdfGenerator.ts # PDF payment slips
│   ├── db/
│   │   ├── schema.sql      # Database schema
│   │   ├── seed.sql        # Initial data
│   │   └── queries.ts      # D1 query functions
│   └── fonts/
│       └── notoSans.ts     # Embedded fonts (base64)
├── scripts/
│   └── generate-fonts.cjs  # Font embedding script
├── package.json
├── tsconfig.json
└── wrangler.toml
```

## Key Dependencies

- **hono**: Lightweight web framework for Workers
- **jose**: JWT handling (Workers-compatible)
- **bcryptjs**: Password hashing (pure JS)
- **pdfkit**: PDF generation

## Frontend Deployment

The frontend is deployed separately to Cloudflare Pages:

1. Create a Pages project pointing to the `frontend/` directory
2. Configure the API URL environment variable to point to the Worker
3. Update the frontend's `js/api.js` to use the correct API URL

## Notes

- Default admin credentials: `admin@zgrada.local` / `Admin123!`
- All amounts are in RSD (Serbian Dinar)
- PDF generation includes NBS IPS QR codes for each payment slip
- Fonts are embedded as base64 to work without filesystem access
