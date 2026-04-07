# M.P. Warehousing & Logistics Corporation (MPW)

## Overview

Enterprise warehouse management system (WMS) with admin and operator roles.

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Application Architecture

- **Frontend**: React + Vite (artifact: `mpw-app`, route: `/`)
- **Backend API**: Express 5 (artifact: `api-server`, port: 8080, path: `/api`)
- **Database**: PostgreSQL + Drizzle ORM

## Key Features

- **Auth**: JWT-based (token in localStorage key `mpw_token`), roles: `admin` / `operator`
- **Bills**: Create, view, filter, approve/reject, export CSV
- **Versioning**: Operators request edits/deletes; admins approve/reject
- **Commodities**: Admin-managed crop+year catalog with per-bag-per-month rates
- **Depositors**: Used in bill approval (depositor, pass amount, payment method)
- **Users**: Admin can create/manage users
- **Notifications**: Real-time unread count, mark all read
- **Dashboard**: Stats, bills-by-status chart, recent bills (admin only)

## Frontend Pages

| Route | Page | Role |
|-------|------|------|
| `/login` | LoginPage | Public |
| `/dashboard` | DashboardPage | Admin |
| `/bills` | BillsPage | Both |
| `/bills/new` | AddBillPage | Operator |
| `/bills/:id` | BillDetailPage | Both |
| `/bills/:id/approve` | ApproveBillPage | Admin |
| `/bills/:id/request-edit` | RequestEditPage | Operator |
| `/commodities` | CommoditiesPage | Admin |
| `/depositors` | DepositorsPage | Admin |
| `/users` | UsersPage | Admin |
| `/versions` | VersionsPage | Admin |
| `/profile` | ProfilePage | Both |

## Demo Credentials

- **Admin**: admin@mpw.com / admin123
- **Operator 1**: operator1@mpw.com / admin123
- **Operator 2**: operator2@mpw.com / admin123

## Backend API Routes

All routes under `/api/v1/`:
- `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password`
- `GET/POST /users`, `GET/PATCH /users/:id`
- `GET/POST /commodities`, `PATCH /commodities/:id`
- `GET/POST /depositors`
- `GET/POST /bills`, `GET /bills/:id`, `GET /bills/export`
- `POST /bills/:id/request-edit`, `POST /bills/:id/request-delete`
- `POST /approvals/approve/:billId`, `POST /approvals/reject/:billId`
- `GET /approvals/versions/pending`, `POST /approvals/versions/:versionId/approve`, `POST /approvals/versions/:versionId/reject`
- `GET /notifications`, `POST /notifications/mark-all-read`
- `GET /dashboard/stats`
- `POST /upload/image`

## Database Schema

Tables: `users`, `commodities`, `depositors`, `bills`, `bill_versions`, `bill_approvals`, `notifications`

Bill total_charge formula: `received_bags * per_bag_per_month / 2`

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React, Vite, Tailwind CSS, shadcn/ui, wouter, TanStack Query

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Important Notes

- Auth token getter set via `setAuthTokenGetter` in `src/lib/auth.tsx` (auto-attaches Bearer token to all API requests)
- `@workspace/api-client-react/src/custom-fetch` is exported in package.json exports map
- Express 5: use `/*splat` for wildcards, annotate async handlers with `Promise<void>`
- Never use `console.log` in server code — use `req.log` or pino logger

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
