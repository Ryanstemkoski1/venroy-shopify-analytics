# Venroy Analytics Dashboard

A private analytics dashboard for Venroy's Shopify store built with Next.js, TypeScript, and Supabase authentication. Features accurate transaction-level analytics through a comprehensive database synchronization system.

## Features

- 🔐 **Secure Authentication** - Supabase-powered login system
- 📊 **Accurate Analytics** - Transaction-level data filtering for precise insights
- 🗄️ **Database-Driven** - Local PostgreSQL storage for faster queries and data accuracy
- 🔄 **Automated Sync** - Full and incremental synchronization with Shopify
- 🎨 **Modern UI** - Built with Tailwind CSS and shadcn/ui
- 📱 **Responsive Design** - Works on desktop and mobile

## Quick Start

1. **Clone and Install**

   ```bash
   git clone <repository-url>
   cd venroy-shopify-analytics
   npm install
   ```

2. **Environment Configuration**

   ```bash
   cp .env.example .env.local
   ```

   Fill in your environment variables:
   - `SHOPIFY_STORE_DOMAIN` - Your Shopify store domain
   - `SHOPIFY_API_ACCESS_TOKEN` - Shopify Admin API access token
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for sync operations)
   - `CRON_SECRET_TOKEN` - Secret token for cron job authentication

3. **Database Setup**

   **Important**: You must set up the database before running the app.

   a) Open your Supabase project dashboard
   b) Go to SQL Editor
   c) Execute the migration script from `supabase/migrations/001_create_analytics_tables.sql`

   ```sql
   -- Copy and paste the entire contents of supabase/migrations/001_create_analytics_tables.sql
   -- This creates the orders, transactions, and sync_state tables with proper indexes
   ```

4. **Initial Data Sync**

   After database setup, perform initial sync:

   ```bash
   npm run dev
   ```

   Then make a POST request to trigger full sync:

   ```bash
   curl -X POST http://localhost:3000/api/sync/full \
     -H "Content-Type: application/json"
   ```

   Monitor the sync progress in your browser console or check the database.

5. **Set Up Automated Sync (Optional)**

   For production, set up a cron job to call:

   ```
   GET /api/cron/sync
   Authorization: Bearer YOUR_CRON_SECRET_TOKEN
   ```

## Authentication Flow

- **Homepage** (`/`) - Landing page with login button
- **Login** (`/login`) - Email/password authentication
- **Dashboard** (`/dashboard`) - Protected analytics dashboard
- **Auto-redirect** - Logged-in users redirected to dashboard

## Database Architecture

The system uses PostgreSQL (via Supabase) for accurate analytics:

### Tables

- **`orders`** - Order metadata with processed_at timestamps
- **`transactions`** - Individual transaction records for precise date filtering
- **`sync_state`** - Tracks synchronization progress and cursors

### Key Features

- **Transaction-level filtering** - Analytics based on actual transaction processed dates
- **Incremental sync** - Efficient updates using GraphQL cursors
- **Data integrity** - Proper relationships and constraints

## API Routes

### Sync Endpoints

- `POST /api/sync/full` - Complete data synchronization (use once)
- `POST /api/sync/incremental` - Update with recent changes
- `GET /api/cron/sync` - Automated incremental sync (for cron jobs)

### Analytics Endpoints

- `GET /api/analytics/sales-by-channel` - Channel-based sales analytics
  - Query params: `startDate`, `endDate`
  - Returns transaction-level aggregated data

## Data Synchronization

### Full Sync

Imports all historical orders and transactions:

```bash
curl -X POST http://localhost:3000/api/sync/full
```

### Incremental Sync

Updates with recent changes (recommended for regular use):

```bash
curl -X POST http://localhost:3000/api/sync/incremental
```

### Automation

Set up a cron job to call the incremental sync endpoint regularly:

- **Frequency**: Every 15-30 minutes
- **Endpoint**: `GET /api/cron/sync`
- **Auth**: Bearer token using `CRON_SECRET_TOKEN`

## GraphQL Code Generation

Generate TypeScript types from Shopify Admin API:

```bash
npm run codegen        # Generate types once
npm run codegen:watch  # Watch for changes
```

## Project Structure

```
app/
├── api/
│   ├── sync/           # Data synchronization endpoints
│   ├── cron/           # Automated sync endpoint
│   └── analytics/      # Analytics API routes
├── dashboard/          # Protected analytics dashboard
└── login/              # Authentication pages

lib/
├── supabase/           # Authentication & database utilities
├── shopify/            # GraphQL operations & types
├── sync/               # Data synchronization service
├── database/           # Database operations layer
└── analytics/          # Analytics calculation functions

components/
├── ui/                 # Reusable UI components
├── modules/            # Feature-specific components
└── layouts/            # Layout components

supabase/
└── migrations/         # Database schema migrations
```

## Troubleshooting

### Data Accuracy Issues

If analytics don't match Shopify's dashboard:

1. Check that database tables were created correctly
2. Verify initial sync completed successfully
3. Ensure transactions table has data with proper processed_at dates

### Sync Issues

- Check Shopify API access token permissions
- Verify database connection and schema
- Monitor API rate limits (Shopify: 40 calls per second)

### Performance

- Database queries are optimized with indexes
- Use date range filtering to limit query scope
- Consider adding more specific indexes for custom analytics

This is a private member portal - no public registration is available.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
