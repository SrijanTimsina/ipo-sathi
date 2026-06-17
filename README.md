# IPO Sathi

A comprehensive multi-user web application built in TypeScript that fully automates IPO applications in the Nepalese share market. This platform's core feature is its ability to **automatically apply to open IPOs at the required time** and send **instant WhatsApp notifications** upon successful applications or updates.

It allows users to manage multiple linked Mero Share accounts securely, auto-apply to open IPOs, and track application statuses and portfolio data all in one centralized dashboard.

## Key Features

- **Automated IPO Scheduling:** Never miss an IPO again. Set schedules to automatically apply for open IPOs at the exact required time.
- **WhatsApp Notifications:** Get real-time alerts delivered straight to your WhatsApp whenever an IPO application is processed, and receive instant notifications about IPO allotment results.
- **Centralized Account Management:** Securely link and manage multiple Mero Share/Demat accounts in one place.
- **Bulk IPO Application:** Apply to open IPOs across all or selected linked accounts with a single action.
- **Application Tracking:** Track the real-time status of your applications (pending, allotted, rejected) across all accounts.
- **Portfolio Overview:** View current share portfolio holdings for each linked Mero Share account.
- **Admin Dashboard:** Administrative controls to manage users and view system activity (no self-registration).

## Tech Stack

This project is built using a modern, scalable TypeScript stack:

- **Package Manager & Runtime:** [Bun](https://bun.sh/)
- **Frontend:** React, Shadcn UI, Tailwind CSS, TanStack React Query
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication & Security:** Custom JWT-based auth with AES-256 encryption for Mero Share account credentials.

## Project Structure

The repository is structured as a monorepo with distinct frontend and backend directories:

- `/frontend`: React application following a feature-based structure.
- `/backend`: Express application following a modular monolith architecture.
- `mero-share-api.md`: Documentation of the external MeroShare APIs used by the platform.

## Getting Started

### 1. Database

Ensure you have a PostgreSQL database running locally or remotely.

### 2. Backend Setup

```bash
cd backend
bun install
cp .env.example .env   # Update variables with your keys
bunx drizzle-kit push
bun run dev
```

### 3. Frontend Setup

```bash
cd frontend
bun install
cp .env.example .env   # Update VITE_API_URL if needed
bun run dev
```

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](https://www.gnu.org/licenses/agpl-3.0.html).
