# UrbanAdmin — Frontend

Angular 22 (standalone components, SSR-capable) web app for **MyNeighborhood/UrbanAdmin**: apartment owners and admins track utility meter readings, invoices, payment deadlines, and paid/unpaid status per apartment, per service (Agua, Luz, Gas, Arriendo), per month.

Talks to the [Backend](https://github.com/UrbanAdmin/Backend) API over HTTP/JWT — this repo has no server-side logic of its own beyond Angular's optional SSR render.

## Tech stack

- Angular 22 — standalone components, signals, the `@if`/`@for` control-flow syntax
- Angular Material + CDK for UI components
- RxJS for async data flow (`shareReplay`-based per-service caches, invalidated on writes and on login/logout)
- Vitest + Angular `TestBed` for unit tests
- Deployed as a static site (GitHub Pages) via `output-mode static`; Angular SSR/Express (`@angular/ssr`) is present but not what's actually deployed today

## Getting started

Prerequisites: Node.js 22.

```bash
git clone https://github.com/UrbanAdmin/UI.git
cd UI/Angular
npm ci
npm start   # ng serve, http://localhost:4200
```

The dev server expects the [Backend](https://github.com/UrbanAdmin/Backend) API running locally at the URL in `src/environments/environment.ts` (`http://localhost:5193` by default).

## Configuration

`src/environments/environment.ts` (dev) / `environment.prod.ts` (production build) — each exports the API base URL (`apiUrl`). No secrets live in this repo; auth is a JWT obtained from the backend's `/auth/login` and kept in memory only (`AuthService`) — never in `localStorage`/`sessionStorage`, so a page refresh logs the user out by design, trading convenience for reduced exposure to token theft via XSS.

## Auth & roles

Two roles, mirrored from the backend JWT's role/`ApartmentId` claims (`AuthService`):

- **Admin** — full access to every screen, including Manage Apartments and Manage Users, and every write action (mark paid, edit deadlines, edit amounts, submit readings).
- **ApartmentOwner** ("Arrendatario") — scoped to one apartment. Sees the same screens (minus Manage Apartments/Manage Users, guarded by `admin.guard.ts`) in read-only form: Pagos groups every servicio (Agua/Luz/Gas/Arriendo) onto one page instead of a Servicio filter, since they only ever see their own apartment.

`auth.guard.ts` blocks all routes when logged out; `admin.guard.ts` additionally blocks Admin-only routes. This is UX only — the backend independently enforces the same rules server-side, which is the actual security boundary.

## App structure

```
src/app/
  shell/               Top-level layout + navigation
  home/                Landing page / quick-access cards
  login/                
  payments/            Pagos — paid status, amount, deadlines
  counter-utilities/    Lecturas — meter readings
  notifications/        Vencimientos/notifications + shared domain models (ServiceName, PaymentStatus, Deadline...)
  readings/            Readings + invoice-placeholder services
  manage-apartments/   Admin: CRUD apartments (+ contract upload)
  manage-users/        Admin: CRUD user accounts + role/apartment assignment
  shared/              Cross-feature services (Apartments, Users, Dates, Utilities) and models
  *-dialog/            Material dialogs (apartment, user, manual reading, reading)
  auth.service.ts      JWT/session state, exposes isAdmin()/isApartmentOwner()/getOwnApartmentId()
  auth.guard.ts, admin.guard.ts
```

Each feature service caches its GET responses (`shareReplay`) and exposes a `clearCache()`, invalidated after writes and by `AuthService` on every login/logout — this prevents a second identity in the same tab from seeing a previous identity's cached, role-scoped data.

## Testing

```bash
npm test
```

Vitest + `TestBed`, mocking HTTP via `HttpTestingController` — no real backend needed. Specs sit next to the code they test (`*.spec.ts`).

## Building

```bash
npm run build                                            # standard Angular build (dev config)
npx ng build --configuration production --base-href /UI/ --output-mode static   # what CI actually deploys
```

## CI/CD

Two GitHub Actions workflows at the repo root (`../.github/workflows/`, since this Angular app is a subfolder of the `UI` repo):

- `ci.yml` — `npm run build` + `npm test` on every push/PR to `main`.
- `deploy-pages.yml` — on push to `main`, builds a static production bundle (`--base-href /UI/ --output-mode static`) and deploys it to GitHub Pages.
