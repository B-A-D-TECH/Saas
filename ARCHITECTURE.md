# Restaurant POS SaaS - Architecture

## 📊 Project Structure

```
Saas/
├── Configuration Files
│   ├── .env.example                 # Environment variables template
│   ├── .gitignore                   # Git ignore patterns
│   ├── package.json                 # Project dependencies & scripts
│   ├── tsconfig.json                # Frontend TypeScript config
│   ├── tsconfig.server.json         # Backend TypeScript config
│   ├── vite.config.ts              # Vite build configuration
│   └── vercel.json                  # Deployment configuration
│
├── Public Files
│   ├── index.html                   # HTML entry point
│   └── public/                      # Static assets
│
├── Frontend (React + TypeScript)
│   └── src/
│       ├── main.tsx                 # App entry point
│       ├── App.tsx                  # Main component with routing
│       ├── index.css                # Global styles
│       ├── vite-env.d.ts           # Vite environment types
│       ├── types.ts                 # Frontend shared types
│       ├── AuthContext.tsx          # Authentication context
│       ├── usePosState.ts           # Global POS state hook
│       ├── api/
│       │   ├── client.ts            # HTTP client with retry logic
│       │   └── types.ts             # API response types
│       ├── config/
│       │   └── (placeholder)        # Frontend configuration
│       ├── hooks/
│       │   └── useApi.ts            # React hook for API calls
│       ├── utils/
│       │   └── helpers.ts           # Common utilities
│       └── components/
│           ├── Navbar.tsx
│           ├── Login.tsx
│           ├── Caisse.tsx           # POS cashier interface
│           ├── Commandes.tsx        # Orders management
│           ├── Products.tsx
│           ├── ProductForm.tsx
│           ├── Categories.tsx
│           ├── Dashboard.tsx
│           ├── InventoryPage.tsx
│           ├── SuppliersPage.tsx
│           ├── PurchasesPage.tsx
│           ├── StockHistoryPage.tsx
│           ├── SettingsPage.tsx
│           ├── Client.tsx
│           ├── ConfirmDeleteModal.tsx
│           ├── productsApi.ts
│           └── productsTypes.ts
│
├── Backend (Node.js + Express + PostgreSQL)
│   └── server/
│       ├── index.ts                 # Application entry point
│       ├── auth.ts                  # JWT and password utilities
│       ├── pg.ts                    # Database connection (legacy)
│       ├── db.ts                    # SQLite connection (legacy)
│       ├── types.ts                 # Server types (legacy)
│       ├── store.ts                 # Data store (legacy)
│       ├── routes.ts                # API routes (main)
│       ├── schema.sql               # PostgreSQL schema
│       ├── migrations.sql           # Database migrations
│       ├── menuSeed.ts              # Menu data seeding
│       ├── pgSeed.ts                # PostgreSQL seeding
│       ├── restaurantSeed.ts        # Restaurant data seeding
│       ├── config/
│       │   ├── env.ts               # Environment variables validation
│       │   ├── constants.ts         # Global constants & feature flags
│       │   └── database.ts          # PostgreSQL configuration
│       ├── middleware/
│       │   ├── auth.ts              # Authentication & authorization
│       │   ├── errorHandler.ts      # Global error handling
│       │   └── (validation.ts)      # Input validation (TBD)
│       ├── utils/
│       │   ├── errors.ts            # Error class definitions
│       │   ├── validators.ts        # Zod validation schemas
│       │   └── helpers.ts           # Common utilities & logging
│       ├── types/
│       │   ├── index.ts             # Main type definitions
│       │   └── api.ts               # API response types
│       ├── controllers/             # (TBD) Business logic controllers
│       ├── services/                # (TBD) Service layer
│       ├── repositories/            # (TBD) Data access layer
│       ├── migrations/              # SQL migration files
│       ├── seeders/                 # Data seeding scripts
│       └── src/
│           ├── app.ts               # Express app setup (legacy)
│           ├── config/
│           │   └── env.ts           # Environment validation (legacy)
│           ├── controllers/
│           │   └── healthController.ts
│           ├── repositories/
│           │   └── healthRepository.ts
│           ├── routes/
│           │   └── health.ts
│           └── services/
│               └── healthService.ts
│
└── Documentation
    ├── README.md                    # This file
    ├── README-products-module.md   # Products module docs
    ├── TODO.md                      # Development tasks
    └── SPRINT0-AUDIT.md            # Audit trail
```

## 🏗️ Architecture Pattern

### Frontend
- **Framework**: React 19 with TypeScript
- **Routing**: React Router v6
- **State Management**: React Context + custom hooks
- **API**: Fetch-based HTTP client with retry logic
- **Build**: Vite

### Backend
- **Framework**: Express.js
- **Database**: PostgreSQL (primary), SQLite (legacy)
- **Authentication**: JWT + Argon2
- **Validation**: Zod
- **Architecture**: Layered (middleware → routes → logic)

### Multi-Tenancy
- Tenant isolation via `tenant_id` in database
- Header-based tenant routing (`x-tenant-id`)
- Role-based access control (RBAC)

## 🔐 Security Features

1. **Authentication**
   - JWT tokens with 2-hour expiry
   - Argon2 password hashing
   - Optional "remember me" functionality

2. **Authorization**
   - Role hierarchy: Super Admin → Admin → Manager → Serveur → Cuisine → Caissier
   - Per-endpoint role requirements

3. **Multi-Tenant Isolation**
   - Tenant context in all database queries
   - Tenant mismatch detection
   - Cross-tenant access prevention

4. **API Security**
   - CORS enabled with origin validation
   - Rate limiting (120 requests/minute)
   - Request body limit (512KB)

## 📦 Environment Variables

```env
# Node
NODE_ENV=development
PORT=4000

# PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost:5432/restaurant_saas
PG_USER=postgres
PG_PASSWORD=password
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=restaurant_saas

# Security
JWT_SECRET=your-secret-key
JWT_EXPIRY=2h

# Frontend
VITE_API_URL=http://localhost:4000/api
```

## 🚀 Getting Started

### Prerequisites
- Node.js 22.x
- npm 11.x
- PostgreSQL 12+

### Installation

```bash
# Clone repository
git clone <repo-url>
cd Saas

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local

# Update .env.local with your PostgreSQL credentials
```

### Development

```bash
# Start dev server (both API and frontend)
npm run dev

# Or run separately:
npm run dev:api    # Backend on port 4000
npm run dev:web    # Frontend on port 5173 (with proxy to API)
```

### Build & Deployment

```bash
# Type check
npm run type-check

# Build for production
npm run build

# Preview production build
npm run preview

# Start production server
npm start
```

## 📋 API Routes Structure

```
/api
├── /auth                    # Authentication endpoints
│   ├── POST /login         # User login
│   ├── POST /register      # User registration
│   ├── POST /logout        # User logout
│   └── GET /me             # Current user info
├── /products               # Product management
├── /categories             # Category management
├── /orders                 # Order management
├── /users                  # User management
├── /suppliers              # Supplier management (TBD)
├── /purchases              # Purchase management (TBD)
└── /health                 # Health check
```

## 🗄️ Database Schema

### Core Tables
- `tenants` - Multi-tenant isolation
- `users` - User accounts with roles
- `roles` - Role definitions
- `products` - Product inventory
- `categories` - Product categories
- `orders` - Customer orders
- `menu_items` - POS menu items
- `audit_logs` - Activity tracking
- `tenant_settings` - Configuration per tenant

## 🔧 Development Guidelines

### TypeScript
- Strict mode enabled
- Path aliases configured (`@/*`, `@server/*`, `@types/*`)
- Separate configs for frontend and backend

### Code Organization
- **Server**: Controller/Service/Repository pattern (in progress)
- **Frontend**: Component-based with hooks
- **Errors**: Centralized error classes
- **Validation**: Zod schemas with strong typing

### Logging
- Context-aware logging with tenant/user/request ID
- Log levels: info, warn, error, debug
- Slow query detection (>1s)

## 🧪 Testing (TBD)
- Unit tests for services
- Integration tests for API endpoints
- E2E tests for critical flows

## 📝 Notes

### Legacy Code
Some files remain from previous SQLite implementation:
- `server/db.ts` - SQLite (deprecated in favor of PostgreSQL)
- `server/types.ts` - Duplicated types (use `server/types/index.ts`)
- `server/src/` - Early service pattern (refactor in progress)

### Migration Path
1. ✅ PostgreSQL setup with multi-tenancy
2. ✅ TypeScript configuration fixed
3. ⏳ Refactor routes into controllers/services
4. ⏳ Comprehensive error handling
5. ⏳ API documentation (OpenAPI/Swagger)
6. ⏳ Unit and integration tests
7. ⏳ Performance optimization

## 🎯 Feature Flags

Currently available in `server/config/constants.ts`:
- `INVENTORY_MANAGEMENT` ✅
- `SUPPLIER_MANAGEMENT` ✅
- `AUDIT_LOGGING` ✅
- `MULTI_LOCATION` ⏳
- `ONLINE_ORDERING` ⏳
- `DELIVERY_INTEGRATION` ⏳

## 📞 Support

For issues or questions about the SaaS architecture, refer to:
1. Type definitions in `server/types/`
2. Error handling in `server/utils/errors.ts`
3. Database schema in `server/schema.sql`
