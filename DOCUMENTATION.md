# Authentic Flavors — Project Documentation

A full-stack web application for a private catering business. Customers can browse food packages, create event bookings, upload GCash payment receipts, and track their booking status. Admins can manage all bookings, preview payment receipts, and verify or reject payments.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Technology Stack](#technology-stack)
3. [Frontend](#frontend)
4. [Backend](#backend)
5. [Database](#database)
6. [Authentication & Security](#authentication--security)
7. [Email Service](#email-service)
8. [File Uploads](#file-uploads)
9. [API Overview](#api-overview)
10. [Environment Variables](#environment-variables)
11. [Running the Project Locally](#running-the-project-locally)
12. [Deployment](#deployment)
13. [Current Progress](#current-progress)

---

## Project Structure

```
authenticFlavors/
├── backend/                  # Node.js/Express API server
│   └── src/
│       ├── config/           # Environment variable loading
│       ├── controllers/      # Route handler logic
│       ├── db/               # MySQL connection pool & migrations
│       ├── middleware/        # Auth & role guard middleware
│       ├── routes/           # Express router definitions
│       ├── services/         # External service integrations (email)
│       └── utils/            # JWT helpers, input validators
├── src/                      # React frontend (Vite)
│   └── app/
│       ├── api/              # API client functions (fetch wrappers)
│       ├── auth/             # Auth context and session management
│       ├── components/       # Shared UI components
│       ├── data/             # Static mock/demo data
│       └── pages/            # Page-level React components
├── guidelines/               # Project coding and schema guidelines
├── DOCUMENTATION.md          # This file
└── .gitignore
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.3.1 | UI framework |
| **TypeScript** | (via Vite) | Type-safe JavaScript |
| **Vite** | 6.3.5 | Build tool and dev server |
| **React Router** | 7.13.0 | Client-side routing and navigation |
| **Tailwind CSS** | 4.1.12 | Utility-first CSS styling |
| **Lucide React** | 0.487.0 | Icon library |
| **Sonner** | 2.0.3 | Toast notification system |
| **Recharts** | 2.15.2 | Data visualization charts (Admin Dashboard) |
| **Motion** | 12.23.24 | Animation library |
| **React Hook Form** | 7.55.0 | Form state management and validation |
| **Radix UI** | Various | Headless accessible UI primitives |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| **Node.js** | LTS | JavaScript runtime |
| **Express** | 4.19.2 | HTTP server framework |
| **mysql2** | 3.11.0 | MySQL database driver with Promise support |
| **bcryptjs** | 2.4.3 | Password hashing |
| **jsonwebtoken** | 9.0.2 | JWT token creation and verification |
| **multer** | 2.2.0 | Multipart form-data file upload handling |
| **cookie-parser** | 1.4.6 | HTTP cookie parsing middleware |
| **cors** | 2.8.5 | Cross-Origin Resource Sharing headers |
| **dotenv** | 16.4.5 | Environment variable loading |
| **Brevo HTTP API** | — | Transactional email delivery (replaces SMTP) |

---

## Frontend

### Routing

Routing is handled by **React Router v7** with the following pages:

| Route | Component | Access |
|---|---|---|
| `/` | `LandingPage` | Public |
| `/auth` | `AuthPage` | Public (Login & Register) |
| `/verify-email` | `VerifyEmailPage` | Public |
| `/forgot-password` | `ForgotPasswordPage` | Public |
| `/reset-password` | `ResetPasswordPage` | Public |
| `/packages` | `PackagesPage` | Public |
| `/package-selection` | `PackageSelectionPage` | Public |
| `/package/:id` | `PackageDetailPage` | Public |
| `/about` | `AboutPage` | Public |
| `/booking` | `BookingPage` | Authenticated |
| `/payment-upload` | `PaymentUploadPage` | Authenticated |
| `/dashboard` | `CustomerDashboard` | Authenticated (Customer) |
| `/admin` | `AdminDashboard` | Authenticated (Admin) |
| `/feedback` | `FeedbackPage` | Authenticated |
| `/payment/success` | `SuccessPage` | Authenticated |
| `/payment/cancel` | `CancelPage` | Authenticated |

### State Management

Authentication state is managed globally using React's **Context API** (`AuthContext`). The context stores:
- The authenticated `user` object
- The `accessToken` (short-lived JWT)
- Functions: `login`, `register`, `logout`, `updateProfile`, `setAuth`, `refreshUser`

The access token is stored **in memory** (React state), not in `localStorage`, to prevent XSS token theft. The refresh token is stored in an **HttpOnly cookie**.

---

## Backend

### Architecture

The backend follows an **MVC-like structure**:

- **Routes** (`/routes/`) — define URL patterns and map them to controller functions
- **Controllers** (`/controllers/`) — contain business logic, query the database, return responses
- **Middleware** (`/middleware/`) — guard routes (auth check, role check)
- **Services** (`/services/`) — external service integrations (email delivery)
- **Utils** (`/utils/`) — reusable helpers (JWT signing/verifying, input validation)

### API Prefix

All API endpoints are prefixed with `/api`. Example: `POST /api/auth/register`.

### Controllers

| Controller | File | Description |
|---|---|---|
| `authController.js` | Authentication, registration, email verification, password reset, profile management |
| `bookingController.js` | Booking creation, retrieval, and management |
| `packageController.js` | Package and pricing CRUD |
| `paymentController.js` | Payment receipt upload and verification |
| `feedbackController.js` | Feedback submission and retrieval |
| `chatbotController.js` | AI-powered chatbot integration |

### Routes

| Route File | Prefix | Description |
|---|---|---|
| `authRoutes.js` | `/api/auth` | Authentication, verification, password reset |
| `bookingRoutes.js` | `/api` | Booking CRUD |
| `packageRoutes.js` | `/api` | Package and pricing |
| `paymentRoutes.js` | `/api` | Payment receipt upload |
| `feedbackRoutes.js` | `/api` | Feedback submission |
| `chatbotRoutes.js` | `/api` | Chatbot interactions |

---

## Database

- **Database System:** MySQL
- **Driver:** `mysql2/promise` (supports async/await natively)
- **Connection:** Connection pool with a limit of **10 concurrent connections**

### Schema Summary

| Table | Description |
|---|---|
| `users` | Registered customers and admins |
| `packages` | Catering food packages |
| `package_pricing` | Per-pax price tiers for each package |
| `menu_categories` | Food categories (e.g., Soup, Main Course) |
| `menu_items` | Individual food items linked to categories |
| `event_types` | Event types (e.g., Birthday, Wedding, Corporate) |
| `venue_setups` | Venue add-on options (e.g., Floral Arrangements) |
| `bookings` | Customer booking records |
| `booking_menu_selections` | Junction table linking bookings to chosen menu items |
| `email_verifications` | One-time verification codes for email activation |
| `password_reset_tokens` | One-time tokens for password reset flow |
| `feedback` | Customer feedback linked to bookings |
| `payments` | Payment records with receipt tracking |

### Key Design Decisions

- `booking_summary` is a `TEXT` column storing a **JSON string** containing dynamic metadata such as the `receipt_path` (uploaded payment proof) and `rejection_reason` (admin feedback). This avoids extra migration when adding optional booking metadata fields.
- `total_price` is stored on the `bookings` record at submission time to preserve the price that was active when the booking was made.
- `account_status` on `users` is an ENUM: `'Active'`, `'Inactive'`, `'Suspended'`, `'Pending'` (Pending = email not yet verified).

---

## Authentication & Security

### Password Hashing

Passwords are hashed using **bcrypt** via the `bcryptjs` library.

- **Algorithm:** bcrypt (Blowfish-based adaptive hashing)
- **Cost Factor / Salt Rounds:** `12`
- Passwords are **never stored in plain text**. Only the `password_hash` is saved in the `users` table.
- Password comparison on login uses `bcrypt.compare()`, which is timing-safe.

### JWT Authentication (Dual-Token Strategy)

The application uses a **two-token authentication flow**:

| Token | Type | Storage | TTL (Default) | Purpose |
|---|---|---|---|---|
| **Access Token** | JWT (HS256) | In-memory (React state) | `15 minutes` | Authorizes API requests via `Authorization: Bearer <token>` header |
| **Refresh Token** | JWT (HS256) | HttpOnly Cookie | `7 days` | Used to silently obtain a new access token without re-login |

- **Algorithm:** HMAC-SHA256 (`HS256`) — symmetric signing using a secret key
- **Secrets:** Separate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` environment variables
- The refresh cookie is flagged as `HttpOnly` (inaccessible to JavaScript), `Secure` (HTTPS only in production), and `SameSite=lax` (development) / `SameSite=none` (production with cross-origin)
- Cookie path is `/api/auth` so it is sent only with auth-related requests

### Role-Based Access Control (RBAC)

User roles are stored in the `users.role` column as a MySQL `ENUM`:
- `Customer` — can create bookings, upload receipts, view their own bookings
- `Admin` — can view all bookings, preview receipts, verify or reject payments

Protected routes use two middleware layers:
1. `requireAuth` — validates the Bearer access token
2. `requireRole("Admin")` — checks that the authenticated user has the required role

---

## Email Service

The application uses **Brevo's HTTP API** (not SMTP) for transactional email delivery. This avoids SMTP connection timeout issues that can occur in cloud deployments (e.g., Render).

### How It Works

- Emails are sent via `POST https://api.brevo.com/v3/smtp/email` using the native `fetch` API (no external HTTP client needed)
- The API key is sent in the `api-key` header
- The sender email and name are configured via environment variables

### Email Features

| Feature | Endpoint | Description |
|---|---|---|
| Email Verification | `sendVerificationCode()` | Sends a 6-digit verification code to new users |
| Password Reset | `sendPasswordResetEmail()` | Sends a password reset link with a secure token |

### Environment Variables

| Variable | Description |
|---|---|
| `BREVO_API_KEY` | Brevo SMTP API key (starts with `xsmtpsib-`) |
| `BREVO_SENDER_EMAIL` | Verified sender email address |
| `BREVO_SENDER_NAME` | Display name for the sender |

---

## File Uploads

- **Library:** `multer` v2.2.0
- **Storage:** Local disk — files are saved to `backend/uploads/` relative to where the server process runs
- **Allowed Formats:** JPEG, PNG, WebP (`image/jpeg`, `image/png`, `image/webp`)
- **Size Limit:** 5 MB per file
- **Filename Pattern:** `receipt-{timestamp}-{random}.{ext}` (e.g., `receipt-1783842490076-232546697.png`)
- **Served via:** `express.static` at the `/uploads` URL path — admins can open the file directly in their browser

> **Note:** Local disk storage is suitable for development. For production deployment, receipts should be migrated to a cloud storage provider (e.g., AWS S3, Cloudinary, or Google Cloud Storage) to ensure persistence across server restarts and deployments.

---

## API Overview

### Auth Endpoints (`/api/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/register` | Public | Create a new customer account (status: Pending) |
| `POST` | `/login` | Public | Login and receive tokens |
| `POST` | `/refresh` | Cookie | Issue a new access token using a refresh cookie |
| `POST` | `/logout` | Public | Clear the refresh cookie |
| `GET` | `/me` | Bearer | Get the current authenticated user |
| `PUT` | `/profile` | Bearer | Update name, email, and phone number |
| `POST` | `/send-verification` | Public | Send a verification code to the user's email |
| `POST` | `/verify-email` | Public | Verify the code and activate the account |
| `POST` | `/forgot-password` | Public | Send a password reset link |
| `POST` | `/reset-password` | Public | Reset password using a token |

### Package Endpoints (`/api`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/packages` | Public | List all active packages |
| `GET` | `/packages/:id` | Public | Get a single package |
| `GET` | `/packages/:id/pricing` | Public | Get per-pax pricing tiers |
| `GET` | `/menu-categories` | Public | List menu categories |
| `GET` | `/menu-items` | Public | List all menu items |
| `GET` | `/event-types` | Public | List event types |
| `GET` | `/venue-setups` | Public | List venue setup options |

### Booking Endpoints (`/api`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/bookings` | Bearer | Submit a new booking |
| `GET` | `/bookings` | Bearer | Get own bookings (Customer) |
| `POST` | `/bookings/:id/receipt` | Bearer | Upload GCash payment receipt |

### Admin Booking Endpoints (`/api/admin`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/bookings` | Bearer + Admin | List all bookings |
| `POST` | `/bookings/:id/verify` | Bearer + Admin | Mark booking as Confirmed |
| `POST` | `/bookings/:id/reject` | Bearer + Admin | Reject booking with a reason |

---

## Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

```env
# Server
PORT=4000
NODE_ENV=development

# CORS — comma-separated list of allowed frontend origins
CORS_ORIGIN=http://localhost:5173

# Database (MySQL)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=authenticFlavors

# JWT Secrets — use long, random strings in production
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# Token TTLs (optional — uses defaults if omitted)
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d

# Cookie name for the refresh token
REFRESH_COOKIE_NAME=af_refresh

# Brevo Email API
BREVO_API_KEY=your_brevo_smtp_api_key
BREVO_SENDER_EMAIL=your_verified_sender@example.com
BREVO_SENDER_NAME=Your Brand Name

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

---

## Running the Project Locally

### Prerequisites

- Node.js (LTS recommended)
- MySQL server running locally
- A database named `authenticFlavors` with the schema applied

### 1. Install Dependencies

```bash
# Frontend
npm install

# Backend
cd backend && npm install
```

### 2. Configure Environment

Copy the environment variable template above into `backend/.env` and fill in your database credentials, JWT secrets, and Brevo API key.

### 3. Start Development Servers

```bash
# Start the frontend (http://localhost:5173)
npm run dev

# Start the backend (http://localhost:4000)
cd backend && npm start
```

Both servers must be running simultaneously for the application to work correctly.

### 4. Build for Production

```bash
npm run build
```

The compiled frontend assets will be output to the `dist/` folder.

---

## Deployment

The application is deployed on **Render**:
- **Backend:** Node.js server running on Render
- **Frontend:** Static assets served from the `dist/` folder or via a separate frontend hosting service
- **Database:** MySQL hosted externally (e.g., Aiven Cloud)

### Render Environment Variables

Set the following on the Render dashboard under the backend service's Environment tab:

| Variable | Description |
|---|---|
| `DB_HOST` | MySQL host URL |
| `DB_PORT` | MySQL port |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name |
| `JWT_ACCESS_SECRET` | JWT access token signing secret |
| `JWT_REFRESH_SECRET` | JWT refresh token signing secret |
| `BREVO_API_KEY` | Brevo SMTP API key |
| `BREVO_SENDER_EMAIL` | Verified sender email |
| `BREVO_SENDER_NAME` | Sender display name |
| `FRONTEND_URL` | Frontend URL (e.g., `https://authenticflavors.onrender.com`) |
| `CORS_ORIGIN` | Comma-separated list of allowed origins |
| `NODE_ENV` | `production` |
| `PORT` | Server port (Render sets this automatically) |

---

## Current Progress

### Implemented Features

- [x] User registration with email verification
- [x] User login with dual-token JWT authentication
- [x] Email verification flow (send code → verify → activate account)
- [x] Password reset flow (forgot password → reset link → reset)
- [x] Customer dashboard with booking management
- [x] Admin dashboard with booking management and payment verification
- [x] GCash payment receipt upload
- [x] Payment verification/rejection by admin
- [x] Customer feedback submission
- [x] Public feedback page
- [x] Package browsing and selection
- [x] Booking creation with menu selection
- [x] AI-powered chatbot integration
- [x] Transactional email (Brevo HTTP API)
- [x] Role-based access control (Customer / Admin)
- [x] Responsive design with Tailwind CSS

### Recent Fixes

- Switched from SMTP (nodemailer) to Brevo HTTP API for email delivery to resolve connection timeout issues on Render
- Fixed `logout` function `ReferenceError` (parameter named `_req` but referenced as `req`)
- Fixed `account_status` ENUM to include `'Pending'` for new user registration
- Fixed email verification redirect to go to dashboard instead of login page
- Added `setAuth` to AuthContext for setting auth state directly from verification response