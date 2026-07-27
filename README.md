# Mobile-Based Milk Collection and Management System

This repository contains the initial scaffold for a mobile-first milk collection system with a React Native (Expo) app and a Node.js + Express backend using PostgreSQL.

## Architecture

- `mobile/`: Expo React Native app with role-based navigation for Collector, Farmer, and Admin.
- `server/`: Express API server with PostgreSQL integration for authentication, farmer management, milk collections, MPESA payments, and reporting.

## Key Design Decisions

- Collectors create farmer accounts.
- Farmers do not self-register and only log in once registered by a collector.
- Collector phone-registered farmer information is used for MPESA payment disbursements.
- Offline support applies only to milk collection entry and cached farmer data.
- Payments and reports require online connectivity.

## MVP Features

- Role-based login and dashboards
- Collector-driven farmer registration and management
- Milk collection recording
- Payment processing using farmer phone number for MPESA
- Online-only reports
- Offline support for collection entry and cached history

## Data Model Summary

- `users`
  - `id`, `name`, `phone`, `password_hash`, `role`, `created_at`
- `farmers`
  - `id`, `user_id`, `farmer_code`, `village`, `status`, `created_at`
- `milk_collections`
  - `id`, `farmer_id`, `collector_id`, `collected_at`, `liters`, `total_amount`, `created_at`
- `payments`
  - `id`, `farmer_id`, `collector_id`, `amount`, `payment_date`, `status`, `method`, `phone_number`, `mpesa_transaction_id`, `notes`, `created_at`

## Getting Started

### Backend

1. Navigate to `server/`
2. Create a `.env` file with:
   ```env
   PORT=4000
   DATABASE_URL=postgres://user:password@localhost:5432/milkapp
   JWT_SECRET=your_jwt_secret
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Initialize the database with `server/schema.sql`
5. Start the server:
   ```bash
   npm run dev
   ```
6. (Optional) Seed a test collector user:
   ```bash
   npm run seed
   # credentials: Phone: 0733333333 / Password: adminpass
   ```

### Mobile App

1. Navigate to `mobile/`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start Expo:
   ```bash
   npm start
   ```

Notes:
- The mobile app `src/api.js` uses `http://10.0.2.2:4000` by default for Android emulator. If running Expo on the same machine (LAN), change `BASE_URL` to `http://localhost:4000` in `mobile/src/api.js`.
- Use the seeded admin account to login: Phone: `0733333333` / Password: `adminpass`.
- Collector accounts can be created through the mobile app signup flow or by an admin user.

## Notes

- This project uses PostgreSQL.
- Only collectors can create farmers and payments.
- MPESA payments use the farmer's registered phone number.
- Reports are available online only.
- Offline storage is used only for collector milk collection entry and cached read-only data.
