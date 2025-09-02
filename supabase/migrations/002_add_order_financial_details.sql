-- Add tax, discount, and shipping columns to orders table
-- Migration: 002_add_order_financial_details.sql

-- Add financial detail columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS total_tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_discounts_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_shipping_amount DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Add comments for the new columns
COMMENT ON COLUMN orders.total_tax_amount IS 'Total tax amount for the order';
COMMENT ON COLUMN orders.total_discounts_amount IS 'Total discount amount applied to the order';
COMMENT ON COLUMN orders.total_shipping_amount IS 'Total shipping charges for the order';

-- Add indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_orders_financial_amounts ON orders(total_tax_amount, total_discounts_amount, total_shipping_amount);
