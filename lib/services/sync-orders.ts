/**
 * Shopify Orders Synchronization Service
 *
 * Unified incremental sync that handles both initial and ongoing synchronization
 * Uses cursor-based pagination and last_updated_at tracking for efficiency
 */

import { shopifyFetch } from "../shopify/client"
import {
  SyncOrdersDocument,
  type ShopifySyncOrdersQuery,
  type ShopifySyncOrdersQueryVariables,
} from "../shopify/types"
import {
  updateSyncState,
  upsertOrders,
  upsertTransactions,
  getLastUpdatedAt,
  getOrderIdMapByShopifyIds,
} from "../supabase/operations"
import type { DatabaseOrder, DatabaseTransaction } from "../supabase/types"

interface SyncResult {
  success: boolean
  ordersProcessed: number
  transactionsProcessed: number
  error?: string
}

/**
 * Unified sync function - always incremental, handles both initial and ongoing syncs
 */
export async function syncOrders(): Promise<SyncResult> {
  try {
    // Get the last updated timestamp from our database
    const lastUpdatedAt = await getLastUpdatedAt()

    let totalOrders = 0
    let totalTransactions = 0
    let hasNextPage = true
    let cursor: string | undefined = undefined

    if (!lastUpdatedAt) {
      // No data in database, perform initial sync (1 year back)
      return await performInitialSync()
    }

    // Mark sync as running
    await updateSyncState("orders", {
      sync_status: "running",
      error_message: null,
    })

    // Query for orders updated since last sync
    const query = `updated_at:>=${lastUpdatedAt}`

    while (hasNextPage) {
      const variables: ShopifySyncOrdersQueryVariables = {
        first: 250,
        after: cursor,
        query: query,
      }

      const response = await shopifyFetch<
        ShopifySyncOrdersQuery,
        ShopifySyncOrdersQueryVariables
      >({
        query: SyncOrdersDocument,
        variables,
        cache: "no-store",
      })

      if (!response.orders) {
        throw new Error("Failed to fetch orders from Shopify")
      }

      const orders = response.orders.edges

      if (orders.length === 0) {
        break
      }

      // Process this batch
      const { ordersCount, transactionsCount } = await processBatch(orders)
      totalOrders += ordersCount
      totalTransactions += transactionsCount

      // Update pagination
      hasNextPage = response.orders.pageInfo.hasNextPage
      cursor = response.orders.pageInfo.endCursor || undefined

      // Save cursor progress
      await updateSyncState("orders", {
        last_cursor: cursor,
        sync_status: "running",
      })

      // Small delay to be respectful to Shopify API
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Mark sync as completed
    await updateSyncState("orders", {
      sync_status: "completed",
      last_cursor: null,
      error_message: null,
    })

    return {
      success: true,
      ordersProcessed: totalOrders,
      transactionsProcessed: totalTransactions,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    console.error("❌ Incremental sync failed:", errorMessage)

    await updateSyncState("orders", {
      sync_status: "failed",
      error_message: errorMessage,
    })

    return {
      success: false,
      ordersProcessed: 0,
      transactionsProcessed: 0,
      error: errorMessage,
    }
  }
}

/**
 * Perform initial historical sync (first time only)
 */
async function performInitialSync(): Promise<SyncResult> {
  // Mark sync as running
  await updateSyncState("orders", {
    sync_status: "running",
    error_message: null,
  })

  try {
    let totalOrders = 0
    let totalTransactions = 0
    let hasNextPage = true
    let cursor: string | undefined = undefined

    // Calculate start date (1 month ago for testing)
    // TODO: Restore to 1 year for production
    // const oneYearAgo = new Date()
    // oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    // const fromDate = oneYearAgo.toISOString()
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const fromDate = oneMonthAgo.toISOString()

    while (hasNextPage) {
      const variables: ShopifySyncOrdersQueryVariables = {
        first: 250, // Max allowed by Shopify
        after: cursor,
        query: `created_at:>=${fromDate}`,
      }

      const response = await shopifyFetch<
        ShopifySyncOrdersQuery,
        ShopifySyncOrdersQueryVariables
      >({
        query: SyncOrdersDocument,
        variables,
        cache: "no-store",
      })

      if (!response.orders) {
        throw new Error("Failed to fetch orders from Shopify")
      }

      const orders = response.orders.edges

      // Process this batch
      const { ordersCount, transactionsCount } = await processBatch(orders)
      totalOrders += ordersCount
      totalTransactions += transactionsCount

      // Update pagination
      hasNextPage = response.orders.pageInfo.hasNextPage
      cursor = response.orders.pageInfo.endCursor || undefined

      // Save cursor progress
      await updateSyncState("orders", {
        last_cursor: cursor,
        sync_status: "running",
      })

      // Small delay to be respectful to Shopify API
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Mark sync as completed
    await updateSyncState("orders", {
      sync_status: "completed",
      last_cursor: null,
      error_message: null,
    })

    return {
      success: true,
      ordersProcessed: totalOrders,
      transactionsProcessed: totalTransactions,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    console.error("❌ Initial sync failed:", errorMessage)

    await updateSyncState("orders", {
      sync_status: "failed",
      error_message: errorMessage,
    })

    return {
      success: false,
      ordersProcessed: 0,
      transactionsProcessed: 0,
      error: errorMessage,
    }
  }
}

/**
 * Process a batch of orders and their transactions
 */
async function processBatch(
  orders: ShopifySyncOrdersQuery["orders"]["edges"]
): Promise<{ ordersCount: number; transactionsCount: number }> {
  const ordersToInsert: Omit<DatabaseOrder, "id">[] = []
  const transactionsToInsert: Omit<DatabaseTransaction, "id">[] = []

  // First pass: collect all orders
  for (const { node: order } of orders) {
    // Skip test orders
    if (order.test) continue

    // Prepare order data
    const orderData: Omit<DatabaseOrder, "id"> = {
      shopify_order_id: order.id,
      name: order.name,
      created_at: order.createdAt,
      processed_at: order.processedAt || null,
      updated_at: order.updatedAt,
      financial_status: order.displayFinancialStatus || null,
      source_name: order.sourceName || null,
      channel_id: order.channelInformation?.channelId || null,
      channel_display_name:
        order.channelInformation?.displayName || order.sourceName || null,
      subtotal_amount: parseFloat(
        String(order.subtotalPriceSet?.presentmentMoney?.amount || "0")
      ),
      total_amount: parseFloat(
        String(order.totalPriceSet?.presentmentMoney?.amount || "0")
      ),
      total_tax_amount: parseFloat(
        String(order.totalTaxSet?.presentmentMoney?.amount || "0")
      ),
      total_discounts_amount: parseFloat(
        String(order.totalDiscountsSet?.presentmentMoney?.amount || "0")
      ),
      total_shipping_amount: parseFloat(
        String(order.totalShippingPriceSet?.presentmentMoney?.amount || "0")
      ),
      currency: order.subtotalPriceSet?.presentmentMoney?.currencyCode || "USD",
      test: order.test,
      last_synced_at: new Date().toISOString(),
    }

    ordersToInsert.push(orderData)
  }

  // Insert orders first
  if (ordersToInsert.length > 0) {
    await upsertOrders(ordersToInsert)
  }

  // Get all order IDs in one batch query
  const shopifyOrderIds = ordersToInsert.map((o) => o.shopify_order_id)
  const orderIdMap = await getOrderIdMapByShopifyIds(shopifyOrderIds)

  // Second pass: collect all transactions with resolved order IDs
  for (const { node: order } of orders) {
    // Skip test orders
    if (order.test) continue

    const dbOrderId = orderIdMap[order.id]
    if (!dbOrderId) {
      // Skip if order not found
      continue
    }

    // Process transactions for this order
    if (order.transactions && order.transactions.length > 0) {
      for (const transaction of order.transactions) {
        const orderRecord = ordersToInsert.find(
          (o) => o.shopify_order_id === order.id
        )
        const transactionData: Omit<DatabaseTransaction, "id"> = {
          shopify_transaction_id: transaction.id,
          order_id: dbOrderId, // Use the resolved database order ID
          kind: transaction.kind,
          status: transaction.status,
          amount: parseFloat(
            String(transaction.amountSet?.presentmentMoney?.amount || "0")
          ),
          currency:
            transaction.amountSet?.presentmentMoney?.currencyCode ||
            orderRecord?.currency ||
            "USD",
          processed_at: transaction.processedAt || transaction.createdAt,
          created_at: transaction.createdAt,
          gateway: transaction.gateway || null,
          source_name: orderRecord?.source_name || null,
          channel_id: orderRecord?.channel_id || null,
          channel_display_name: orderRecord?.channel_display_name || null,
          last_synced_at: new Date().toISOString(),
        }

        transactionsToInsert.push(transactionData)
      }
    }
  }

  // Insert all transactions in one batch
  if (transactionsToInsert.length > 0) {
    await upsertTransactions(transactionsToInsert)
  }

  return {
    ordersCount: ordersToInsert.length,
    transactionsCount: transactionsToInsert.length,
  }
}
