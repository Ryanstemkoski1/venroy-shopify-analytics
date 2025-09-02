/**
 * Database operations for Shopify Analytics
 */

import { createClient } from "../supabase/server"
import type {
  DatabaseOrder,
  DatabaseTransaction,
  SyncState,
  ChannelAnalytics,
  AnalyticsQuery,
} from "./types"

/**
 * Sync State Operations
 */
export async function getSyncState(
  entityType: "orders" | "transactions"
): Promise<SyncState | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("sync_state")
    .select("*")
    .eq("entity_type", entityType)
    .single()

  if (error) {
    console.error("Error getting sync state:", error)
    return null
  }

  return data
}

export async function updateSyncState(
  entityType: "orders" | "transactions",
  updates: Partial<Omit<SyncState, "id" | "entity_type">>
): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("sync_state")
    .update({
      ...updates,
      last_sync_at: new Date().toISOString(),
    })
    .eq("entity_type", entityType)

  if (error) {
    console.error("Error updating sync state:", error)
    return false
  }

  return true
}

/**
 * Order Operations
 */
export async function upsertOrders(
  orders: Omit<DatabaseOrder, "id">[]
): Promise<boolean> {
  if (orders.length === 0) return true

  const supabase = await createClient()

  const { error } = await supabase.from("orders").upsert(orders, {
    onConflict: "shopify_order_id",
    ignoreDuplicates: false,
  })

  if (error) {
    console.error("Error upserting orders:", error)
    return false
  }

  return true
}

export async function getOrderByShopifyId(
  shopifyOrderId: string
): Promise<DatabaseOrder | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("shopify_order_id", shopifyOrderId)
    .single()

  if (error) {
    return null
  }

  return data
}

export async function getOrderIdMapByShopifyIds(
  shopifyOrderIds: string[]
): Promise<Record<string, number>> {
  if (shopifyOrderIds.length === 0) return {}

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("orders")
    .select("id, shopify_order_id")
    .in("shopify_order_id", shopifyOrderIds)

  if (error || !data) {
    console.error("Error fetching order IDs:", error)
    return {}
  }

  // Convert to a map for fast lookup
  const orderIdMap: Record<string, number> = {}
  for (const order of data) {
    orderIdMap[order.shopify_order_id] = order.id
  }

  return orderIdMap
}

/**
 * Transaction Operations
 */
export async function upsertTransactions(
  transactions: Omit<DatabaseTransaction, "id">[]
): Promise<boolean> {
  if (transactions.length === 0) return true

  const supabase = await createClient()

  const { error } = await supabase.from("transactions").upsert(transactions, {
    onConflict: "shopify_transaction_id",
    ignoreDuplicates: false,
  })

  if (error) {
    console.error("Error upserting transactions:", error)
    return false
  }

  return true
}

/**
 * Analytics Operations
 */
export async function getChannelAnalytics(
  query: AnalyticsQuery
): Promise<ChannelAnalytics[]> {
  const supabase = await createClient()

  // Build the query for transactions within date range
  let dbQuery = supabase
    .from("transactions")
    .select(
      `
      source_name,
      kind,
      status,
      amount,
      currency,
      processed_at
    `
    )
    .gte("processed_at", query.fromDate)
    .lte("processed_at", query.toDate)
    .eq("status", "success")

  // Add channel filter if specified
  if (query.channel) {
    dbQuery = dbQuery.eq("source_name", query.channel)
  }

  const { data: transactions, error } = await dbQuery

  if (error) {
    console.error("Error fetching analytics:", error)
    return []
  }

  // Process transactions into channel analytics
  const channelMap = new Map<
    string,
    {
      sales: number
      refunds: number
      orders: Set<string>
      currency: string
    }
  >()

  transactions?.forEach((transaction) => {
    const channel = transaction.source_name || "Unknown"

    if (!channelMap.has(channel)) {
      channelMap.set(channel, {
        sales: 0,
        refunds: 0,
        orders: new Set(),
        currency: transaction.currency,
      })
    }

    const channelData = channelMap.get(channel)!

    if (transaction.kind === "sale") {
      channelData.sales += transaction.amount
    } else if (transaction.kind === "refund") {
      channelData.refunds += transaction.amount
    }
  })

  // Convert to final format
  return Array.from(channelMap.entries()).map(([channel, data]) => ({
    channel,
    net_sales: data.sales - data.refunds,
    net_returns: data.refunds,
    total_orders: data.orders.size,
    currency: data.currency,
  }))
}

/**
 * Utility function to get the last updated_at timestamp for incremental sync
 */
export async function getLastUpdatedAt(): Promise<string | null> {
  const supabase = await createClient()

  // Get the last successful sync timestamp from sync_state table
  const { data, error } = await supabase
    .from("sync_state")
    .select("last_sync_at")
    .eq("entity_type", "orders")
    .eq("sync_status", "completed")
    .single()

  if (error || !data) {
    return null
  }

  return data.last_sync_at
}
