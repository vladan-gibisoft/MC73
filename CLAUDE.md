# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MC73 Generator Uplatnica** - A web application for managing apartment building maintenance payments in Serbia. It handles payment slip (uplatnica) generation with NBS IPS QR codes, apartment/building management, and payment tracking.

### Key Features
- Building and apartment data management (~30 apartments)
- User management with admin/user roles
- Payment slip (uplatnica) PDF generation with IPS QR codes
- Payment tracking and balance management
- Serbian language interface (Latin script)

## Project Structure

```
mc73-generator-uplatnica/
├── backend/                 # Node.js Express API
│   ├── src/
│   │   ├── config/         # Database configuration
│   │   ├── middleware/     # Auth, validation middleware
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # QR code, PDF generation
│   │   └── app.js          # Express app entry point
│   ├── data/               # SQLite database file
│   └── package.json
├── frontend/               # Static HTML/CSS/JS
│   ├── css/               # Stylesheets
│   ├── js/                # JavaScript modules
│   └── *.html             # Page templates
├── docs/                   # Reference documentation
├── project-specs/          # Project specifications
└── project-tasks/          # Generated task lists
```

## Technology Stack

- **Frontend**: Static HTML, vanilla JavaScript, CSS
- **Backend**: Node.js with Express.js
- **Database**: SQLite (via better-sqlite3)
- **PDF Generation**: PDFKit
- **Authentication**: JWT tokens with bcrypt password hashing

## Common Commands

```bash
# Backend development
cd backend
npm install           # Install dependencies
npm run init-db       # Initialize database with schema
npm run dev           # Start with nodemon
npm start             # Production start

# Frontend - serve static files or open HTML directly
```

## Key Technical Details

### IPS QR Code Generation
Uses the NBS (National Bank of Serbia) IPS QR API:
- **Endpoint**: `https://nbs.rs/QRcode/api/qr/v1/gen/{size}`
- **Method**: POST with JSON body
- **Documentation**: `docs/Guidelines for using the NBS IPS QR Generator-Validator.pdf`

### Payment Slip Format
Serbian standard payment slip with Cyrillic labels:
- **уплатилац**: Payer info (name, address, city) - from database
- **сврха уплате**: "Месечно одржавање зграде" (fixed Cyrillic)
- **прималац**: "Стамбена заједница [Address], [City]"
- Reference number format: "XX/YY" (apartment/month, zero-padded)

### Bank Account Format
- Format: `XXX-XXXXXXXXXXXXX-XX` (18 digits total)
- Auto-format shorter inputs: `16054891267` → `160-0000000548912-67`

### Serbian Language
- **Database**: UTF-8, stores Latin or Cyrillic as entered
- **Web UI**: Serbian Latin (easier typing)
- **PDF labels**: Serbian Cyrillic (official)
- **Data in PDF**: As stored (can be mixed)

### Database Schema
Key tables: `building`, `apartments`, `users`, `billings`, `payments`
- See `project-specs/uplatnica-setup.md` for full schema

## Development Guidelines

### API Conventions
- RESTful endpoints under `/api/`
- JWT authentication via Authorization header
- JSON request/response bodies
- Express-validator for input validation

### Security
- Parameterized SQL queries (no string concatenation)
- bcrypt for password hashing
- JWT for stateless authentication
- Input validation on all endpoints

### Coding Standards
- Use async/await for asynchronous operations
- Handle errors with try/catch and proper HTTP status codes
- Serbian text must be UTF-8 encoded
- Amount values stored as DECIMAL(10,2)

## Multi-Agent Workflow

This project uses the agents-orchestrator for automated development:

```bash
# Run the full pipeline
Please spawn an agents-orchestrator to execute complete development pipeline for project-specs/uplatnica-setup.md
```

### Agent Flow
1. **project-manager-senior**: Creates task list from specification
2. **ArchitectUX**: Creates technical architecture
3. **Developer agents** (Frontend/Backend): Implement features
4. **EvidenceQA**: Tests each task with screenshots
5. **testing-reality-checker**: Final integration validation

## Reference Documentation

- **Project Specification**: `project-specs/uplatnica-setup.md`
- **IPS QR API Guide**: `docs/Guidelines for using the NBS IPS QR Generator-Validator.pdf`
- **Payment Slip Format**: `docs/Empty Payment Slip Example.png`

## Important Notes

- All amounts are in RSD (Serbian Dinar)
- Payment slip format follows Serbian banking standards
- QR codes must include "NBS IPS QR" label per NBS requirements
- Reference number: apartment number / billing month (both 2 digits)
- **Default admin**: `admin@zgrada.local` / `Admin123!` (created on first run)
