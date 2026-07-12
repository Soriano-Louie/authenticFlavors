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
7. [File Uploads](#file-uploads)
8. [API Overview](#api-overview)
9. [Environment Variables](#environment-variables)
10. [Running the Project Locally](#running-the-project-locally)

---

## Project Structure

```
authenticFlavors/
├── backend/                  # Node.js/Express API server
│   └── src/
│       ├── config/           # Environment variable loading
│       ├── controllers/      # Route handler logic
│       ├── db/               # MySQL connection pool
│       ├── middleware/        # Auth & role guard middleware
│       ├── routes/           # Express router definitions
│       └── utils/            # JWT helpers, input validators
├── src/                      # React frontend (Vite)
│   └── app/
│       ├── api/              # API client functions (fetch wrappers)
│       ├── auth/             # Auth context and session management
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
| **Node.js** | (LTS) | JavaScript runtime |
| **Express** | 4.19.2 | HTTP server framework |
| **mysql2** | 3.11.0 | MySQL database driver with Promise support |
| **bcryptjs** | 2.4.3 | Password hashing |
| **jsonwebtoken** | 9.0.2 | JWT token creation and verification |
| **multer** | 2.2.0 | Multipart form-data file upload handling |
| **cookie-parser** | 1.4.6 | HTTP cookie parsing middleware |
| **cors** | 2.8.5 | Cross-Origin Resource Sharing headers |
| **dotenv** | 16.4.5 | Environment variable loading |

---

## Frontend

### Routing

Routing is handled by **React Router v7** with the following pages:

| Route | Component | Access |
|---|---|---|
| `/` | `LandingPage` | Public |
| `/auth` | `AuthPage` | Public (Login & Register) |
| `/packages` | `PackagesPage` | Public |
| `/package-selection` | `PackageSelectionPage` | Public |
| `/package/:id` | `PackageDetailPage` | Public |
| `/about` | `AboutPage` | Public |
| `/booking` | `BookingPage` | Authenticated |
| `/payment-upload` | `PaymentUploadPage` | Authenticated |
| `/dashboard` | `CustomerDashboard` | Authenticated (Customer) |
| `/admin` | `AdminDashboard` | Authenticated (Admin) |
| `/feedback` | `FeedbackPage` | Authenticated |

### State Management

Authentication state is managed globally using React's **Context API** (`AuthContext`). The context stores:
- The authenticated `user` object
- The `accessToken` (short-lived JWT)
- Functions: `login`, `register`, `logout`, `updateProfile`

The access token is stored **in memory** (React state), not in `localStorage`, to prevent XSS token theft. The refresh token is stored in an **HttpOnly cookie**.

---

## Backend

### Architecture

The backend follows an **MVC-like structure**:

- **Routes** (`/routes/`) — define URL patterns and map them to controller functions
- **Controllers** (`/controllers/`) — contain business logic, query the database, return responses
- **Middleware** (`/middleware/`) — guard routes (auth check, role check)
- **Utils** (`/utils/`) — reusable helpers (JWT signing/verifying, input validation)

### API Prefix

All API endpoints are prefixed with `/api`. Example: `POST /api/auth/register`.

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

### Key Design Decisions

- `booking_summary` is a `TEXT` column storing a **JSON string** containing dynamic metadata such as the `receipt_path` (uploaded payment proof) and `rejection_reason` (admin feedback). This avoids extra migration when adding optional booking metadata fields.
- `total_price` is stored on the `bookings` record at submission time to preserve the price that was active when the booking was made.

---

## Authentication & Security

### Password Hashing

Passwords are hashed using **bcrypt** via the `bcryptjs` library.

- **Algorithm:** bcrypt (Blowfish-based adaptive hashing)
- **Cost Factor / Salt Rounds:** `12`
  - A cost factor of 12 means the hashing function performs `2^12 = 4,096` iterations, making brute-force attacks computationally expensive.
  - The salt is randomly generated and embedded into the resulting hash string automatically.
- Passwords are **never stored in plain text**. Only the `password_hash` is saved in the `users` table.
- Password comparison on login uses `bcrypt.compare()`, which is timing-safe.

```js
// Registration — hashing
const password_hash = await bcrypt.hash(password, 12);

// Login — verification
const passwordMatches = await bcrypt.compare(password, userRow.password_hash);
```

### JWT Authentication (Dual-Token Strategy)

The application uses a **two-token authentication flow**:

| Token | Type | Storage | TTL (Default) | Purpose |
|---|---|---|---|---|
| **Access Token** | JWT (HS256) | In-memory (React state) | `15 minutes` | Authorizes API requests via `Authorization: Bearer <token>` header |
| **Refresh Token** | JWT (HS256) | HttpOnly Cookie | `7 days` | Used to silently obtain a new access token without re-login |

- **Algorithm:** HMAC-SHA256 (`HS256`) — symmetric signing using a secret key
- **Secrets:** Separate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` environment variables
- The refresh cookie is flagged as `HttpOnly` (inaccessible to JavaScript), `Secure` (HTTPS only in production), and `SameSite=lax` (development) / `SameSite=none` (production with cross-origin)

### Role-Based Access Control (RBAC)

User roles are stored in the `users.role` column as a MySQL `ENUM`:
- `Customer` — can create bookings, upload receipts, view their own bookings
- `Admin` — can view all bookings, preview receipts, verify or reject payments

Protected routes use two middleware layers:
1. `requireAuth` — validates the Bearer access token
2. `requireRole("Admin")` — checks that the authenticated user has the required role

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
| `POST` | `/register` | Public | Create a new customer account |
| `POST` | `/login` | Public | Login and receive tokens |
| `POST` | `/refresh` | Cookie | Issue a new access token using a refresh cookie |
| `POST` | `/logout` | Public | Clear the refresh cookie |
| `GET` | `/me` | Bearer | Get the current authenticated user |
| `PUT` | `/profile` | Bearer | Update name, email, and phone number |

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

Copy the environment variable template above into `backend/.env` and fill in your database credentials and JWT secrets.

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
