-- Database schema for Shopify Analytics
-- This file should be run in your Supabase SQL editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Orders table (master record)
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  shopify_order_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  financial_status TEXT,
  source_name TEXT, -- fallback channel identifier (web, pos, etc.)
  channel_id TEXT, -- unique channel ID from channelInformation
  channel_display_name TEXT, -- human-readable channel name from channelInformation
  subtotal_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  test BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes for fast querying
  CONSTRAINT orders_currency_check CHECK (currency ~ '^[A-Z]{3}$')
);

-- Transactions table (individual financial events)
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  shopify_transaction_id TEXT UNIQUE NOT NULL,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- 'sale', 'refund', 'capture', etc.
  status TEXT NOT NULL, -- 'success', 'pending', 'failure'
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  processed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  gateway TEXT,
  source_name TEXT, -- fallback channel identifier (inherit from order)
  channel_id TEXT, -- unique channel ID (inherit from order)
  channel_display_name TEXT, -- human-readable channel name (inherit from order)
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT transactions_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT transactions_kind_check CHECK (LOWER(kind) IN ('sale', 'refund', 'capture', 'authorization', 'void')),
  CONSTRAINT transactions_status_check CHECK (LOWER(status) IN ('success', 'pending', 'failure', 'error', 'awaiting_response'))
);

-- Sync state table (cursor management)
CREATE TABLE IF NOT EXISTS sync_state (
  id SERIAL PRIMARY KEY,
  entity_type TEXT UNIQUE NOT NULL, -- 'orders', 'transactions'
  last_cursor TEXT,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'completed',
  error_message TEXT,
  
  -- Constraints
  CONSTRAINT sync_state_entity_type_check CHECK (entity_type IN ('orders', 'transactions')),
  CONSTRAINT sync_state_status_check CHECK (sync_status IN ('running', 'completed', 'failed'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_processed_at ON orders(processed_at);
CREATE INDEX IF NOT EXISTS idx_orders_source_name ON orders(source_name);
CREATE INDEX IF NOT EXISTS idx_orders_channel_id ON orders(channel_id);
CREATE INDEX IF NOT EXISTS idx_orders_channel_display_name ON orders(channel_display_name);
CREATE INDEX IF NOT EXISTS idx_orders_processed_at_channel ON orders(processed_at, COALESCE(channel_display_name, source_name));
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at);
CREATE INDEX IF NOT EXISTS idx_orders_test ON orders(test);

CREATE INDEX IF NOT EXISTS idx_transactions_processed_at ON transactions(processed_at);
CREATE INDEX IF NOT EXISTS idx_transactions_kind_status ON transactions(kind, status);
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_channel_display_name ON transactions(channel_display_name);
CREATE INDEX IF NOT EXISTS idx_transactions_processed_at_channel ON transactions(processed_at, COALESCE(channel_display_name, source_name));

-- Insert initial sync state records
INSERT INTO sync_state (entity_type, sync_status) 
VALUES 
  ('orders', 'completed'),
  ('transactions', 'completed')
ON CONFLICT (entity_type) DO NOTHING;

-- RLS (Row Level Security) - Enable if needed for multi-tenant
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;

-- Optional: Create views for common analytics queries
CREATE OR REPLACE VIEW analytics_orders AS 
SELECT 
  o.*,
  COALESCE(o.channel_display_name, o.source_name) as channel_name,
  COUNT(t.id) as transaction_count,
  SUM(CASE WHEN t.kind = 'sale' AND t.status = 'success' THEN t.amount ELSE 0 END) as total_sales,
  SUM(CASE WHEN t.kind = 'refund' AND t.status = 'success' THEN t.amount ELSE 0 END) as total_refunds
FROM orders o
LEFT JOIN transactions t ON o.id = t.order_id
GROUP BY o.id;

COMMENT ON TABLE orders IS 'Shopify orders master table';
COMMENT ON TABLE transactions IS 'Shopify transactions for orders (sales, refunds, etc.)';
COMMENT ON TABLE sync_state IS 'Tracks synchronization state with Shopify API';

-- Comments for channel information fields
COMMENT ON COLUMN orders.source_name IS 'Fallback channel identifier (web, pos, etc.)';
COMMENT ON COLUMN orders.channel_id IS 'Unique channel identifier from Shopify channelInformation';
COMMENT ON COLUMN orders.channel_display_name IS 'Human-readable channel name from Shopify channelInformation';
COMMENT ON COLUMN transactions.source_name IS 'Fallback channel identifier inherited from order';
COMMENT ON COLUMN transactions.channel_id IS 'Channel identifier inherited from order';
COMMENT ON COLUMN transactions.channel_display_name IS 'Channel display name inherited from order';
