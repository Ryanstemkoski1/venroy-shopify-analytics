/**
 * Database types for Shopify Analytics
 */

export interface DatabaseOrder {
  id: number
  shopify_order_id: string
  name: string
  created_at: string
  processed_at: string | null
  updated_at: string
  financial_status: string | null
  source_name: string | null
  channel_id: string | null
  channel_display_name: string | null
  subtotal_amount: number
  total_amount: number
  total_tax_amount: number
  total_discounts_amount: number
  total_shipping_amount: number
  currency: string
  test: boolean
  last_synced_at: string
}

export interface DatabaseTransaction {
  id: number
  shopify_transaction_id: string
  order_id: number
  kind: string
  status: string
  amount: number
  currency: string
  processed_at: string
  created_at: string
  gateway: string | null
  source_name: string | null
  channel_id: string | null
  channel_display_name: string | null
  last_synced_at: string
}

export interface SyncState {
  id: number
  entity_type: "orders" | "transactions"
  last_cursor: string | null
  last_sync_at: string
  sync_status: "running" | "completed" | "failed"
  error_message: string | null
}

export interface AnalyticsQuery {
  fromDate: string
  toDate: string
  channel?: string
}

export interface ChannelAnalytics {
  channel: string
  net_sales: number
  net_returns: number
  total_orders: number
  currency: string
}
