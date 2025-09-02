# Deployment Guide

## Production Deployment Checklist

### 1. Supabase Database Setup

1. **Create Database Schema**
   - Open Supabase SQL Editor
   - Copy and execute `supabase/migrations/001_create_analytics_tables.sql`
   - Verify tables created: `orders`, `transactions`, `sync_state`

2. **Verify Database Permissions**
   - Ensure service role key has read/write access
   - Test connection with your environment variables

### 2. Environment Variables

Required for production:

```bash
# Shopify
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_API_ACCESS_TOKEN=your_admin_api_access_token

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Security
CRON_SECRET_TOKEN=generate_secure_random_string
```

### 3. Initial Data Sync

After deployment:

```bash
# Trigger initial full sync
curl -X POST https://your-domain.com/api/sync/full \
  -H "Content-Type: application/json"
```

This will populate your database with historical Shopify data.

### 4. Automated Sync Setup

Choose one of these methods for regular data updates:

#### Option A: Vercel Cron (Recommended for Vercel)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

#### Option B: GitHub Actions

Create `.github/workflows/sync.yml`:

```yaml
name: Shopify Data Sync
on:
  schedule:
    - cron: "*/15 * * * *" # Every 15 minutes

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sync
        run: |
          curl -X GET ${{ secrets.APP_URL }}/api/cron/sync \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET_TOKEN }}"
```

#### Option C: External Cron Service

Use services like cron-job.org or EasyCron:

- URL: `https://your-domain.com/api/cron/sync`
- Method: GET
- Headers: `Authorization: Bearer YOUR_CRON_SECRET_TOKEN`
- Frequency: Every 15-30 minutes

### 5. Monitoring

Monitor sync operations:

1. **Database Logs**
   - Check `sync_state` table for last sync timestamps
   - Monitor `orders` and `transactions` table growth

2. **Application Logs**
   - Watch for sync success/failure messages
   - Monitor API rate limiting

3. **Data Accuracy**
   - Compare analytics with Shopify Admin dashboard
   - Verify transaction dates are properly filtered

### 6. Performance Optimization

For high-volume stores:

1. **Increase Sync Frequency**
   - Reduce to every 5-10 minutes for active stores
   - Monitor API rate limits (40 calls/second for Shopify)

2. **Database Indexing**
   - Indexes are pre-configured for common queries
   - Add custom indexes for specific analytics needs

3. **Query Optimization**
   - Use date range filtering in analytics
   - Consider data archiving for very old transactions

### 7. Backup Strategy

1. **Database Backups**
   - Supabase provides automatic backups
   - Consider manual exports for critical data

2. **Sync State Recovery**
   - Document your last sync cursor values
   - Keep track of initial sync completion date

## Troubleshooting

### Common Issues

1. **Sync Failures**
   - Check Shopify API permissions
   - Verify network connectivity
   - Monitor rate limit errors

2. **Data Discrepancies**
   - Ensure full sync completed successfully
   - Check transaction processed_at dates
   - Verify database schema matches migration

3. **Performance Issues**
   - Check database query performance
   - Monitor memory usage during sync
   - Consider pagination adjustments

### Support

For deployment issues:

1. Check application logs
2. Verify all environment variables
3. Test database connectivity
4. Validate Shopify API access
