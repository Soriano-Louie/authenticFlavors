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

| Technology          | Version    | Purpose                                     |
| ------------------- | ---------- | ------------------------------------------- |
| **React**           | 18.3.1     | UI framework                                |
| **TypeScript**      | (via Vite) | Type-safe JavaScript                        |
| **Vite**            | 6.3.5      | Build tool and dev server                   |
| **React Router**    | 7.13.0     | Client-side routing and navigation          |
| **Tailwind CSS**    | 4.1.12     | Utility-first CSS styling                   |
| **Lucide React**    | 0.487.0    | Icon library                                |
| **Sonner**          | 2.0.3      | Toast notification system                   |
| **Recharts**        | 2.15.2     | Data visualization charts (Admin Dashboard) |
| **Motion**          | 12.23.24   | Animation library                           |
| **React Hook Form** | 7.55.0     | Form state management and validation        |
| **Radix UI**        | Various    | Headless accessible UI primitives           |

### Backend

| Technology            | Version | Purpose                                                              |
| --------------------- | ------- | -------------------------------------------------------------------- |
| **Node.js**           | LTS     | JavaScript runtime                                                   |
| **Express**           | 4.19.2  | HTTP server framework                                                |
| **mysql2**            | 3.11.0  | MySQL database driver with Promise support                           |
| **bcryptjs**          | 2.4.3   | Password hashing                                                     |
| **jsonwebtoken**      | 9.0.2   | JWT token creation and verification                                  |
| **multer**            | 2.2.0   | Multipart form-data file upload handling                             |
| **cookie-parser**     | 1.4.6   | HTTP cookie parsing middleware                                       |
| **cors**              | 2.8.5   | Cross-Origin Resource Sharing headers                                |
| **dotenv**            | 16.4.5  | Environment variable loading                                         |
| **Brevo HTTP API**    | —       | Transactional email delivery (replaces SMTP)                         |
| **Google Gemini API** | —       | AI-powered chatbot, feedback sentiment analysis, and recommendations |

---

## Frontend

### Routing

Routing is handled by **React Router v7** with the following pages:

| Route                | Component              | Access                                         |
| -------------------- | ---------------------- | ---------------------------------------------- |
| `/`                  | `LandingPage`          | Public                                         |
| `/auth`              | `AuthPage`             | Public (Login & Register)                      |
| `/verify-email`      | `VerifyEmailPage`      | Public                                         |
| `/forgot-password`   | `ForgotPasswordPage`   | Public                                         |
| `/reset-password`    | `ResetPasswordPage`    | Public                                         |
| `/packages`          | `PackagesPage`         | Public                                         |
| `/package-selection` | `PackageSelectionPage` | Public                                         |
| `/package/:id`       | `PackageDetailPage`    | Public                                         |
| `/about`             | `AboutPage`            | Public                                         |
| `/booking`           | `BookingPage`          | Authenticated                                  |
| `/payment-upload`    | `PaymentUploadPage`    | Authenticated                                  |
| `/dashboard`         | `CustomerDashboard`    | Authenticated (Admin → redirected to `/admin`) |
| `/admin`             | `AdminDashboard`       | Authenticated (Admin)                          |
| `/feedback`          | `FeedbackPage`         | Authenticated                                  |
| `/payment/success`   | `SuccessPage`          | Authenticated                                  |
| `/payment/cancel`    | `CancelPage`           | Authenticated                                  |

### State Management

Authentication state is managed globally using React's **Context API** (`AuthContext`). The context stores:

- The authenticated `user` object
- The `accessToken` (short-lived JWT)
- Functions: `login`, `register`, `logout`, `updateProfile`, `changeProfilePhoto`, `setAuth`, `refreshUser`

The access token is stored **in memory** (React state), not in `localStorage`, to prevent XSS token theft. The refresh token is stored in an **HttpOnly cookie**.

---

## Backend

### Architecture

The backend follows an **MVC-like structure**:

- **Routes** (`/routes/`) — define URL patterns and map them to controller functions
- **Controllers** (`/controllers/`) — contain business logic, query the database, return responses
- **Middleware** (`/middleware/`) — guard routes (auth check, role check)
- **Services** (`/services/`) — external service integrations (email delivery, Gemini AI)
- **Utils** (`/utils/`) — reusable helpers (JWT signing/verifying, input validation)

### API Prefix

All API endpoints are prefixed with `/api`. Example: `POST /api/auth/register`.

### Controllers

| Controller              | File                                                                                    | Description |
| ----------------------- | --------------------------------------------------------------------------------------- | ----------- |
| `authController.js`     | Authentication, registration, email verification, password reset, profile management    |
| `bookingController.js`  | Booking creation, retrieval, cancellation, and management                               |
| `packageController.js`  | Package and pricing CRUD                                                                |
| `paymentController.js`  | Payment receipt upload, verification, overdue management, and scheduled email reminders |
| `feedbackController.js` | Feedback submission, retrieval, and admin AI analysis                                   |
| `chatbotController.js`  | AI-powered chatbot integration                                                          |

### Routes

| Route File          | Prefix      | Description                                  |
| ------------------- | ----------- | -------------------------------------------- |
| `authRoutes.js`     | `/api/auth` | Authentication, verification, password reset |
| `bookingRoutes.js`  | `/api`      | Booking CRUD and customer cancellation       |
| `packageRoutes.js`  | `/api`      | Package and pricing                          |
| `paymentRoutes.js`  | `/api`      | Payment receipt upload                       |
| `feedbackRoutes.js` | `/api`      | Feedback submission and admin AI analysis    |
| `chatbotRoutes.js`  | `/api`      | Chatbot interactions                         |

---

## Database

- **Database System:** MySQL
- **Driver:** `mysql2/promise` (supports async/await natively)
- **Connection:** Connection pool with a limit of **10 concurrent connections**

### Schema Summary

| Table                     | Description                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `users`                   | Registered customers and admins (includes `profile_photo_url` and `profile_photo_public_id`) |
| `packages`                | Catering food packages                                                                       |
| `package_pricing`         | Per-pax price tiers for each package                                                         |
| `menu_categories`         | Food categories (e.g., Soup, Main Course)                                                    |
| `menu_items`              | Individual food items linked to categories                                                   |
| `event_types`             | Event types (e.g., Birthday, Wedding, Corporate)                                             |
| `venue_setups`            | Venue add-on options (e.g., Floral Arrangements)                                             |
| `bookings`                | Customer booking records                                                                     |
| `booking_menu_selections` | Junction table linking bookings to chosen menu items                                         |
| `email_verifications`     | One-time verification codes for email activation                                             |
| `password_reset_tokens`   | One-time tokens for password reset flow                                                      |
| `feedback`                | Customer feedback linked to bookings (with AI analysis fields)                               |
| `payments`                | Payment records with receipt tracking                                                        |

### Key Design Decisions

- `booking_summary` is a `TEXT` column storing a **JSON string** containing dynamic metadata such as the `receipt_path` (uploaded payment proof) and `rejection_reason` (admin feedback). This avoids extra migration when adding optional booking metadata fields.
- `total_price` is stored on the `bookings` record at submission time to preserve the price that was active when the booking was made.
- `account_status` on `users` is an ENUM: `'Active'`, `'Inactive'`, `'Suspended'`, `'Pending'` (Pending = email not yet verified).
- The `feedback` table stores AI analysis results inline: `sentiment_status` (Positive/Neutral/Negative/Pending), `sentiment_score` (0.00–1.00), `sentiment_summary` (concise AI summary), `key_topics` (JSON array of themes), `actionable_insights` (JSON array of recommendations), `is_analyzed` (boolean), and `analyzed_at` (timestamp). This avoids reprocessing the same feedback on every page load.
- `payment_status` on `payments` is an ENUM: `'Pending'`, `'For_Verification'`, `'Paid'`, `'Failed'`, `'Rejected'`, `'Overdue'`. The `'Overdue'` status is set automatically when a payment's `due_date` passes and the status is still `'Pending'`.
- `payment_type` on `payments` is an ENUM: `'Reservation'`, `'DownPayment'`, `'FinalPayment'`, `'CancellationCharge'`. The `'CancellationCharge'` type is used when generating cancellation penalty invoices.
- `is_cancellation_charge` on `payments` is a BOOLEAN flag (`FALSE` by default) that marks a payment record as a cancellation charge rather than a regular payment.
- `cancellation_reference` on `payments` is a `VARCHAR(255)` that links a cancellation charge payment back to the original booking.
- The `bookings` table tracks cancellations via: `cancellation_requested_at` (timestamp), `cancellation_processed_at` (timestamp), `cancellation_policy_applied` (VARCHAR: `standard`, `5_days_penalty`, `1_day_penalty`), `amount_due_on_cancellation` (DECIMAL), and `cancellation_notes` (TEXT).

---

## Cancellation Policy

The system supports three automated cancellation policies based on how many days remain before the event:

| Policy | Days Before Event | Amount Charged |
| |---|---|
| `standard` | ≥ 5 days | Reservation fee (₱5,000) forfeited; no additional charge |
| `5_days_penalty` | < 5 days but ≥ 1 day | 50% of total package price |
| `1_day_penalty` | 1 day or less (including event day) | 100% of total package price |

When a customer requests cancellation, the backend calculates the applicable policy, creates a `CancellationCharge` payment record, and updates the booking status to `Cancelled`.

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

| Token             | Type        | Storage                 | TTL (Default) | Purpose                                                            |
| ----------------- | ----------- | ----------------------- | ------------- | ------------------------------------------------------------------ |
| **Access Token**  | JWT (HS256) | In-memory (React state) | `15 minutes`  | Authorizes API requests via `Authorization: Bearer <token>` header |
| **Refresh Token** | JWT (HS256) | HttpOnly Cookie         | `7 days`      | Used to silently obtain a new access token without re-login        |

- **Algorithm:** HMAC-SHA256 (`HS256`) — symmetric signing using a secret key
- **Secrets:** Separate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` environment variables
- The refresh cookie is flagged as `HttpOnly` (inaccessible to JavaScript), `Secure` (HTTPS only in production), and `SameSite=lax` (development) / `SameSite=none` (production with cross-origin)
- Cookie path is `/api/auth` so it is sent only with auth-related requests

### Role-Based Access Control (RBAC)

User roles are stored in the `users.role` column as a MySQL `ENUM`:

- `Customer` — can create bookings, upload receipts, view their own bookings
- `Admin` — can view all bookings, preview receipts, verify or reject payments

**Backend:** Protected API routes use two middleware layers:

1. `requireAuth` — validates the Bearer access token
2. `requireRole("Admin")` — checks that the authenticated user has the required role

**Frontend:** Route protection is handled by guard components in `src/app/components/AuthGuards.tsx`:

| Guard                     | Behavior                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `RequireAuth`             | Renders children if authenticated; redirects unauthenticated users to `/auth`                                      |
| `RequireAdmin`            | Renders children if admin; redirects customers to `/dashboard`; redirects unauthenticated to `/auth`               |
| `RequireCustomer`         | Renders children if customer; redirects admins to `/admin`; redirects unauthenticated to `/auth` with `from` state |
| `RedirectIfAuthenticated` | Redirects authenticated users to `/admin` (Admin) or `/dashboard` (Customer) — used on the `/auth` page            |

All payment reminder email links (`sendUpcomingPaymentReminder`, `sendPaymentDueToday`, `sendPaymentOverdueNotice`) point to `/dashboard`. The `RequireCustomer` guard ensures admins who click these links are automatically redirected to `/admin` instead of seeing the customer dashboard.

---

## Email Service

The application uses **Brevo's HTTP API** (not SMTP) for transactional email delivery. This avoids SMTP connection timeout issues that can occur in cloud deployments (e.g., Render).

### How It Works

- Emails are sent via `POST https://api.brevo.com/v3/smtp/email` using the native `fetch` API (no external HTTP client needed)
- The API key is sent in the `api-key` header
- The sender email and name are configured via environment variables

### Email Features

| Feature                   | Endpoint                          | Description                                                   |
| ------------------------- | --------------------------------- | ------------------------------------------------------------- |
| Email Verification        | `sendVerificationCode()`          | Sends a 6-digit verification code to new users                |
| Password Reset            | `sendPasswordResetEmail()`        | Sends a password reset link with a secure token               |
| Upcoming Payment Reminder | `sendUpcomingPaymentReminder()`   | Sent 3 days before a payment is due                           |
| Payment Due Today         | `sendPaymentDueToday()`           | Sent on the day a payment is due                              |
| Overdue Payment Notice    | `sendPaymentOverdueNotice()`      | Sent when a payment is past due, with red urgency styling     |
| Scheduled Reminders       | `sendScheduledPaymentReminders()` | Cron-job function that sends all three reminder types at once |

### Environment Variables

| Variable             | Description                                  |
| -------------------- | -------------------------------------------- |
| `BREVO_API_KEY`      | Brevo SMTP API key (starts with `xsmtpsib-`) |
| `BREVO_SENDER_EMAIL` | Verified sender email address                |
| `BREVO_SENDER_NAME`  | Display name for the sender                  |

---

## File Uploads

### Payment Receipts (Local Disk — Legacy)

- **Library:** `multer` v2.2.0
- **Storage:** Local disk — files are saved to `backend/uploads/` relative to where the server process runs
- **Allowed Formats:** JPEG, PNG, WebP (`image/jpeg`, `image/png`, `image/webp`)
- **Size Limit:** 5 MB per file
- **Filename Pattern:** `receipt-{timestamp}-{random}.{ext}` (e.g., `receipt-1783842490076-232546697.png`)
- **Served via:** `express.static` at the `/uploads` URL path — admins can open the file directly in their browser

> **Note:** Local disk storage is suitable for development. For production deployment, receipts should be migrated to a cloud storage provider (e.g., AWS S3, Cloudinary, or Google Cloud Storage) to ensure persistence across server restarts and deployments.

### Cloudinary Integration

The application uses **Cloudinary** as the primary cloud image storage for payment receipts and profile photos.

**Cloudinary Service (`backend/src/services/cloudinaryService.js`):**

| Function                                 | Description                                                                                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uploadToCloudinary(fileBuffer, folder)` | Uploads a file buffer to Cloudinary under `authentic_flavors/{folder}`. Accepts JPG, JPEG, PNG, GIF, WebP (max 5MB). Returns `{ secure_url, public_id }`. |
| `deleteFromCloudinary(publicId)`         | Deletes an image from Cloudinary by its public ID. Used when replacing an existing image.                                                                 |

**Storage Folders:**

| Folder                             | Used For                     |
| ---------------------------------- | ---------------------------- |
| `authentic_flavors/receipts`       | Payment receipt proof images |
| `authentic_flavors/profile_photos` | User profile photos          |

### Profile Photo Upload (Change Photo Feature)

Users can upload a new profile photo from the **Account Settings** page in the Customer Dashboard.

**Backend (`backend/src/middleware/upload.js`):**

- Added a dedicated `uploadProfilePhoto` multer instance with **stricter validation**:
  - **Allowed Formats:** JPG, JPEG, PNG only (`image/jpeg`, `image/jpg`, `image/png`)
  - **Size Limit:** 5 MB
- The existing `upload` multer instance continues to handle payment receipts (which still allow GIF/WebP).

**Backend (`backend/src/controllers/authController.js`):**

The `uploadProfilePhoto` controller function:

1. Uses `req.auth.sub` to identify the authenticated user — only the user can change their own photo
2. Validates `req.file` exists (multer enforces backend file type/size validation)
3. Uploads the file to Cloudinary in the `profile_photos` folder via `uploadToCloudinary()`
4. Deletes the **previous** profile photo from Cloudinary if one exists (via `deleteFromCloudinary()` using the stored `profile_photo_public_id`)
5. Updates the `users` table with the new `profile_photo_url` and `profile_photo_public_id`
6. Returns the updated user object
7. On failure, the existing photo remains unchanged (the DB is only updated after a successful Cloudinary upload)

**Backend Route:**

- `POST /api/auth/profile/photo` — protected by `requireAuth` + `uploadProfilePhoto.single("photo")` middleware

**Frontend (`src/app/api/authApi.ts` + `src/app/auth/AuthContext.tsx`):**

- Added `profile_photo_url` and `profile_photo_public_id` fields to the `AuthUser` interface
- Added `uploadProfilePhoto(accessToken, file)` API function that sends a `multipart/form-data` request
- Added `changeProfilePhoto(file)` to `AuthContext` — updates the global `user` state immediately so the new photo appears everywhere (Navbar, Dashboard top bar, Settings) without a page refresh

**Frontend UI — Customer Dashboard Settings Tab:**

- **Hidden file input** with `accept="image/jpeg,image/jpg,image/png"`, triggered by the "Change Photo" button
- **Frontend validation:** Rejects non-JPG/JPEG/PNG files and files larger than 5MB with clear toast error messages
- **Loading state:** Spinner overlay on the avatar while uploading
- **Success state:** Success toast + immediate avatar update across the app
- **Error state:** Error toast — existing photo remains unchanged
- **Responsive layout:** Uses `flex-col sm:flex-row` for proper mobile/desktop display
- Shows the profile photo `<img>` when available; falls back to the initials circle otherwise

**Note:** This feature requires a database migration to add two columns to the `users` table — see `.kilo/migration_add_profile_photo.sql`.

---

## API Overview

### Auth Endpoints (`/api/auth`)

| Method | Path                 | Auth   | Description                                        |
| ------ | -------------------- | ------ | -------------------------------------------------- |
| `POST` | `/register`          | Public | Create a new customer account (status: Pending)    |
| `POST` | `/login`             | Public | Login and receive tokens                           |
| `POST` | `/refresh`           | Cookie | Issue a new access token using a refresh cookie    |
| `POST` | `/logout`            | Public | Clear the refresh cookie                           |
| `GET`  | `/me`                | Bearer | Get the current authenticated user                 |
| `PUT`  | `/profile`           | Bearer | Update name, email, and phone number               |
| `POST` | `/profile/photo`     | Bearer | Upload a new profile photo (JPG/JPEG/PNG, max 5MB) |
| `POST` | `/send-verification` | Public | Send a verification code to the user's email       |
| `POST` | `/verify-email`      | Public | Verify the code and activate the account           |
| `POST` | `/forgot-password`   | Public | Send a password reset link                         |
| `POST` | `/reset-password`    | Public | Reset password using a token                       |

### Package Endpoints (`/api`)

| Method | Path                        | Auth   | Description                                |
| ------ | --------------------------- | ------ | ------------------------------------------ |
| `GET`  | `/packages`                 | Public | List all active packages                   |
| `GET`  | `/packages/:id`             | Public | Get a single package                       |
| `GET`  | `/packages/:id/pricing`     | Public | Get per-pax pricing tiers                  |
| `GET`  | `/menu-categories`          | Public | List menu categories                       |
| `GET`  | `/menu-items`               | Public | List all menu items                        |
| `GET`  | `/event-types`              | Public | List event types                           |
| `GET`  | `/venue-setups`             | Public | List venue setup options                   |
| `GET`  | `/homepage/statistics`      | Public | Get homepage statistics                    |
| `GET`  | `/homepage/upcoming-events` | Public | Get upcoming reserved and confirmed events |

### Admin Package Endpoints (`/api/admin`)

| Method | Path | Auth | Description |
| |---|---|---|
| `GET` | `/packages` | Bearer + Admin | List all packages (including inactive) |
| `POST` | `/packages` | Bearer + Admin | Create a new package with image upload |
| `PUT` | `/packages/:id` | Bearer + Admin | Update a package with optional image upload |
| `DELETE` | `/packages/:id` | Bearer + Admin | Delete a package |

### Menu Endpoints (`/api`)

| Method | Path | Auth | Description |
| |---|---|---|
| `GET` | `/menu/categories` | Public | List all menu categories |
| `GET` | `/menu/items` | Public | List all menu items |
| `GET` | `/menu/categories/:categoryId/items` | Public | List menu items by category |

### Booking Endpoints (`/api`)

| Method | Path | Auth | Description |
| |---|---|---|
| `POST` | `/bookings` | Bearer | Submit a new booking |
| `GET` | `/bookings` | Bearer | Get own bookings (Customer) |
| `POST` | `/bookings/:id/receipt` | Bearer | Upload GCash payment receipt |
| `POST` | `/bookings/:id/cancel` | Bearer | Request cancellation of a booking |
| `GET` | `/bookings/:id/cancellation-details` | Bearer | Get estimated cancellation fees and policy |

### Admin Booking Endpoints (`/api/admin`)

| Method | Path                   | Auth           | Description                  |
| ------ | ---------------------- | -------------- | ---------------------------- |
| `GET`  | `/bookings`            | Bearer + Admin | List all bookings            |
| `POST` | `/bookings/:id/verify` | Bearer + Admin | Mark booking as Confirmed    |
| `POST` | `/bookings/:id/reject` | Bearer + Admin | Reject booking with a reason |

### Payment Endpoints (`/api/payments`)

| Method | Path                               | Auth           | Description                                                   |
| ------ | ---------------------------------- | -------------- | ------------------------------------------------------------- |
| `GET`  | `/instructions/:bookingId`         | Bearer         | Get payment instructions for a booking                        |
| `POST` | `/upload-receipt`                  | Bearer         | Upload payment receipt URL (direct Cloudinary upload)         |
| `POST` | `/upload-receipt-file`             | Bearer         | Upload payment receipt file (multer + server-side Cloudinary) |
| `GET`  | `/status/:paymentId`               | Bearer         | Get payment status for a specific payment                     |
| `GET`  | `/booking/:bookingId`              | Bearer         | Get all payments for a booking (auto-updates overdue status)  |
| `GET`  | `/admin/all`                       | Bearer + Admin | Get all payments (pending verification first)                 |
| `POST` | `/admin/verify/:paymentId`         | Bearer + Admin | Approve or reject a payment receipt                           |
| `PUT`  | `/admin/instructions`              | Bearer + Admin | Update payment instructions                                   |
| `GET`  | `/admin/overdue`                   | Bearer + Admin | Get all overdue payments with `overdue_days`                  |
| `POST` | `/admin/overdue/remind/:paymentId` | Bearer + Admin | Send email reminder for a payment                             |
| `POST` | `/admin/overdue/cancel/:paymentId` | Bearer + Admin | Cancel a booking due to overdue payment                       |

### Admin Overdue Management (`/api/payments/admin`)

| Method | Path                         | Auth           | Description                                                    |
| ------ | ---------------------------- | -------------- | -------------------------------------------------------------- |
| `GET`  | `/overdue`                   | Bearer + Admin | List overdue payments with customer details and `overdue_days` |
| `POST` | `/overdue/remind/:paymentId` | Bearer + Admin | Send email reminder (upcoming or overdue notice)               |
| `POST` | `/overdue/cancel/:paymentId` | Bearer + Admin | Cancel booking and all unpaid payments                         |

### Feedback Endpoints (`/api`)

| Method | Path                         | Auth   | Description                                                                                            |
| ------ | ---------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `POST` | `/feedback`                  | Bearer | Submit feedback for a completed, past-dated confirmed, or user-cancelled booking (auto-analyzed by AI) |
| `GET`  | `/feedback/:bookingId`       | Bearer | Get own feedback for a booking                                                                         |
| `GET`  | `/feedback/check/:bookingId` | Bearer | Check if feedback exists for a booking                                                                 |
| `GET`  | `/feedbacks/public`          | Public | List all public feedback entries                                                                       |

### Admin Feedback Analysis Endpoints (`/api/admin`)

| Method   | Path                      | Auth           | Description                                                                                                        |
| -------- | ------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/feedback-analysis`      | Bearer + Admin | Get full AI feedback analysis (sentiment breakdown, executive summary, key topics, recommendations, feedback list) |
| `POST`   | `/feedback/:id/reanalyze` | Bearer + Admin | Re-run AI analysis on a single feedback entry                                                                      |
| `POST`   | `/feedback/reanalyze-all` | Bearer + Admin | Re-analyze all feedback entries in batch                                                                           |
| `DELETE` | `/feedback/:id`           | Bearer + Admin | Delete a feedback entry                                                                                            |

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

# Gemini AI
GEMINI_API_KEY=your_google_gemini_api_key
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_MODEL=gemini-2.0-flash

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

| Variable             | Description                                                  |
| -------------------- | ------------------------------------------------------------ |
| `DB_HOST`            | MySQL host URL                                               |
| `DB_PORT`            | MySQL port                                                   |
| `DB_USER`            | MySQL username                                               |
| `DB_PASSWORD`        | MySQL password                                               |
| `DB_NAME`            | Database name                                                |
| `JWT_ACCESS_SECRET`  | JWT access token signing secret                              |
| `JWT_REFRESH_SECRET` | JWT refresh token signing secret                             |
| `BREVO_API_KEY`      | Brevo SMTP API key                                           |
| `BREVO_SENDER_EMAIL` | Verified sender email                                        |
| `BREVO_SENDER_NAME`  | Sender display name                                          |
| `FRONTEND_URL`       | Frontend URL (e.g., `https://authenticflavors.onrender.com`) |
| `CORS_ORIGIN`        | Comma-separated list of allowed origins                      |
| `NODE_ENV`           | `production`                                                 |
| `PORT`               | Server port (Render sets this automatically)                 |
| `GEMINI_API_KEY`     | Google Gemini API key                                        |
| `GEMINI_BASE_URL`    | Gemini REST API base URL                                     |
| `GEMINI_MODEL`       | Gemini model identifier (e.g., `gemini-2.0-flash`)           |

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
- [x] AI Feedback Analysis for admins (Gemini-powered sentiment classification, key topics, summaries, and actionable recommendations)
- [x] Automatic AI analysis of newly submitted feedback (stored in DB to avoid reprocessing)
- [x] Admin re-analyze single / all feedback entries on demand
- [x] Admin feedback deletion
- [x] Overdue payment system with automatic status updates and grace period
- [x] Admin overdue alerts section with send reminder and cancel booking actions
- [x] Automated email reminders (upcoming, due today, overdue notice)
- [x] Database migration to add `'Overdue'` to `payments.payment_status` ENUM
- [x] Package browsing and selection
- [x] Booking creation with menu selection
- [x] Landing page upcoming events calendar with month navigation and visibility for future Reserved / Confirmed bookings
- [x] Customer booking cancellation with automated penalty calculation
- [x] AI-powered chatbot integration
- [x] Transactional email (Brevo HTTP API)
- [x] Role-based access control (Customer / Admin)
- [x] Responsive design with Tailwind CSS
- [x] User profile photo upload (Change Photo) with Cloudinary storage
- [x] Reviews for user-cancelled bookings

### Recent Fixes

- Implemented the **Change Photo** feature: Users can now upload a new profile photo from the Account Settings tab in the Customer Dashboard. The photo is uploaded to Cloudinary (in the `profile_photos` folder), saved in the `users` table via the new `profile_photo_url` and `profile_photo_public_id` columns, and immediately reflected across the Navbar, Dashboard top bar, and Settings — without a page refresh. File validation is enforced on both the frontend (client-side check in `CustomerDashboard.tsx`) and backend (dedicated `uploadProfilePhoto` multer instance allowing only JPG/JPEG/PNG, max 5MB). Old photos are deleted from Cloudinary when replaced. Requires the `.kilo/migration_add_profile_photo.sql` migration.
- Enabled **reviews for user-cancelled bookings**: Previously, only `Completed` (or past-dated `Confirmed`) bookings could receive feedback. Now, bookings cancelled by the user (identified by `cancellation_requested_at` being set on the `bookings` row) are also eligible for review. Admin-rejected bookings remain non-reviewable. The frontend Feedback tab eligibility filter and feedback existence check in `CustomerDashboard.tsx` include user-cancelled bookings, and the backend `createFeedback` validation in `feedbackController.js` allows them. The `Booking` interface in `bookingApi.ts` now includes `cancellation_requested_at` / `cancellation_processed_at`. Duplicate reviews are still prevented by the existing `uq_feedback_booking` unique key on the `feedback` table.
- Fixed admin routing when clicking payment reminder email links: Admins clicking "Settle Payment Now", "Pay Now", or "Go to Dashboard" in any of the three payment notification emails (upcoming payment, due today, overdue) were shown the customer dashboard. Added a `RequireCustomer` frontend guard (`src/app/components/AuthGuards.tsx`) that redirects admins to `/admin` when they navigate to `/dashboard`, and updated the `/dashboard` route in `src/app/routes.tsx` to use it instead of `RequireAuth`.
- Implemented knowledge base lookup for chatbot to reduce Gemini API usage: Added `findKnowledgeBaseAnswer()` function in `chatbotController.js` that checks the `knowledge_base` table before calling Gemini API. Uses keyword-based matching algorithm with 60% threshold. Common FAQ questions are now served from the database, significantly reducing API costs and improving response time. Knowledge base hits are logged with request_type `'FAQ_KB'` in the `ai_requests` table.
- Implemented customer booking cancellation workflow with automated penalty calculations based on event date
- Added cancellation policy tracking (`standard`, `5_days_penalty`, `1_day_penalty`) with database migration
- Updated `payments` schema to support `CancellationCharge` payment type
- Switched from SMTP (nodemailer) to Brevo HTTP API for email delivery to resolve connection timeout issues on Render
- Fixed `logout` function `ReferenceError` (parameter named `_req` but referenced as `req`)
- Fixed `account_status` ENUM to include `'Pending'` for new user registration
- Fixed email verification redirect to go to dashboard instead of login page
- Added `setAuth` to AuthContext for setting auth state directly from verification response
- Replaced placeholder AI Feedback Analysis section in the Admin Dashboard with a fully functional implementation backed by the Gemini AI service and live database feedback
- Added `key_topics`, `actionable_insights`, and `analyzed_at` columns to the `feedback` table (with auto-migration for existing databases)
- Added `analyzeFeedback()` and `generateOverallFeedbackAnalysis()` helpers to `geminiService.js`
- Added admin API endpoints for feedback analysis, re-analysis, and deletion
- Added `'Overdue'` to `payments.payment_status` ENUM with auto-migration in `seed.js`
- Implemented overdue payment system: auto status flip, admin alerts, email reminders, and booking cancellation
- Implemented full package management CRUD for admins (create, update, delete packages with image upload)
- Improved time formatting in CustomerDashboard to display 12-hour AM/PM format
