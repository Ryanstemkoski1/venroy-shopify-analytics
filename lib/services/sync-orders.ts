/**
 * Shopify Orders Synchronization Service
 *
 * Unified incremental sync that handles both initial and ongoing synchronization
 * Uses cursor-based pagination and last_updated_at tracking for efficiency
 *
 * Features:
 * - Automatic resumption of interrupted syncs using saved cursor position
 * - Cursor preservation after successful completion for future resumption
 * - Efficient incremental sync based on last_updated_at timestamps
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
  getSyncState,
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
  console.log("🚀 Starting incremental sync...")

  try {
    // Debug: Show current sync state
    const debugSyncState = await getSyncState("orders")
    console.log("🔍 Current sync state:", {
      status: debugSyncState?.sync_status,
      last_sync_at: debugSyncState?.last_sync_at,
      last_cursor: debugSyncState?.last_cursor,
    })

    // Get the last updated timestamp from our database
    const lastUpdatedAt = await getLastUpdatedAt()
    console.log(
      "📅 Last sync completed at:",
      lastUpdatedAt || "No previous sync found"
    )

    let totalOrders = 0
    let totalTransactions = 0
    let hasNextPage = true
    let cursor: string | undefined = undefined

    if (!lastUpdatedAt) {
      // No data in database, perform initial sync (1 year back)
      console.log("🎯 No previous sync found, starting initial sync...")
      return await performInitialSync()
    }

    // Check if there's an interrupted sync we can resume from
    const currentSyncState = await getSyncState("orders")
    if (
      currentSyncState?.sync_status === "running" &&
      currentSyncState.last_cursor
    ) {
      console.log(
        "🔄 Resuming interrupted sync from cursor:",
        currentSyncState.last_cursor
      )
      cursor = currentSyncState.last_cursor
    } else {
      // Mark sync as running (new sync)
      console.log("🆕 Starting new incremental sync...")
      console.log("🔍 Looking for orders updated since:", lastUpdatedAt)
      await updateSyncState("orders", {
        sync_status: "running",
        error_message: null,
      })
    }

    // Query for orders updated since last sync
    // Convert timestamp to Shopify's required format: ISO 8601 with Z timezone, no milliseconds, quoted
    const shopifyTimestamp =
      new Date(lastUpdatedAt).toISOString().split(".")[0] + "Z"
    console.log(
      "🔧 Converting timestamp:",
      lastUpdatedAt,
      "→",
      shopifyTimestamp
    )
    const query = `updated_at:>='${shopifyTimestamp}'`
    console.log("🔍 Shopify query:", query)

    let batchCount = 0
    while (hasNextPage) {
      batchCount++
      console.log(
        `📦 Processing batch ${batchCount}${cursor ? ` (cursor: ${cursor.slice(-8)})` : ""}...`
      )

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
      console.log(`📋 Fetched ${orders.length} orders in batch ${batchCount}`)

      if (orders.length === 0) {
        console.log("✅ No more orders to process - all caught up!")
        break
      }

      // Process this batch
      const { ordersCount, transactionsCount } = await processBatch(orders)
      totalOrders += ordersCount
      totalTransactions += transactionsCount
      console.log(
        `✨ Processed: ${ordersCount} orders, ${transactionsCount} transactions (Total: ${totalOrders}/${totalTransactions})`
      )

      // Update pagination
      hasNextPage = response.orders.pageInfo.hasNextPage
      cursor = response.orders.pageInfo.endCursor || undefined

      // Save cursor progress and update last_sync_at to current time for resumption
      await updateSyncState("orders", {
        last_cursor: cursor,
        sync_status: "running",
        last_sync_at: new Date().toISOString(),
      })

      console.log(
        `💾 Saved progress: cursor ${cursor ? cursor.slice(-8) : "null"}, ${totalOrders} orders processed`
      )

      // Small delay to be respectful to Shopify API
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Mark sync as completed - keep the final cursor for potential future resume
    console.log("🎉 Sync completed successfully!")
    console.log(
      `📊 Final totals: ${totalOrders} orders, ${totalTransactions} transactions processed`
    )

    const completionTime = new Date().toISOString()
    console.log(`⏰ Setting last_sync_at to: ${completionTime}`)

    const updateResult = await updateSyncState("orders", {
      sync_status: "completed",
      error_message: null,
    })

    console.log(`✅ Sync state update result: ${updateResult}`)

    // Verify the update worked by reading it back
    const verifyState = await getSyncState("orders")
    console.log(`🔍 Verified last_sync_at in DB: ${verifyState?.last_sync_at}`)
    console.log(`🔍 Verified sync_status in DB: ${verifyState?.sync_status}`)

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
  console.log("🏁 Starting initial historical sync...")

  try {
    let totalOrders = 0
    let totalTransactions = 0
    let hasNextPage = true
    let cursor: string | undefined = undefined

    // Check if there's an interrupted initial sync we can resume from
    const currentSyncState = await getSyncState("orders")
    if (
      currentSyncState?.sync_status === "running" &&
      currentSyncState.last_cursor
    ) {
      console.log(
        "🔄 Resuming interrupted initial sync from cursor:",
        currentSyncState.last_cursor
      )
      cursor = currentSyncState.last_cursor
    } else {
      // Mark sync as running (new initial sync)
      console.log("🆕 Starting fresh initial sync...")
      await updateSyncState("orders", {
        sync_status: "running",
        error_message: null,
      })
    }

    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const fromDate = oneYearAgo.toISOString()

    console.log("📅 Syncing orders created since:", fromDate)

    let batchCount = 0
    while (hasNextPage) {
      batchCount++
      console.log(
        `📦 Processing initial batch ${batchCount}${cursor ? ` (cursor: ${cursor.slice(-8)})` : ""}...`
      )

      const variables: ShopifySyncOrdersQueryVariables = {
        first: 250, // Max allowed by Shopify
        after: cursor,
        query: `created_at:>='${fromDate}'`,
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
      console.log(
        `📋 Fetched ${orders.length} orders in initial batch ${batchCount}`
      )

      // Process this batch
      const { ordersCount, transactionsCount } = await processBatch(orders)
      totalOrders += ordersCount
      totalTransactions += transactionsCount
      console.log(
        `✨ Processed: ${ordersCount} orders, ${transactionsCount} transactions (Total: ${totalOrders}/${totalTransactions})`
      )

      // Update pagination
      hasNextPage = response.orders.pageInfo.hasNextPage
      cursor = response.orders.pageInfo.endCursor || undefined

      // Save cursor progress and update last_sync_at to current time for resumption
      await updateSyncState("orders", {
        last_cursor: cursor,
        sync_status: "running",
        last_sync_at: new Date().toISOString(),
      })

      console.log(
        `💾 Saved progress: cursor ${cursor ? cursor.slice(-8) : "null"}, ${totalOrders} orders processed`
      )

      // Small delay to be respectful to Shopify API
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Mark sync as completed - keep the final cursor for potential future resume
    console.log("🎉 Initial sync completed successfully!")
    console.log(
      `📊 Final totals: ${totalOrders} orders, ${totalTransactions} transactions processed`
    )

    const completionTime = new Date().toISOString()
    console.log(`⏰ Setting last_sync_at to: ${completionTime}`)

    await updateSyncState("orders", {
      sync_status: "completed",
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
  let testOrdersSkipped = 0
  for (const { node: order } of orders) {
    // Skip test orders
    if (order.test) {
      testOrdersSkipped++
      continue
    }

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
    console.log(
      `💾 Inserting ${ordersToInsert.length} orders${testOrdersSkipped > 0 ? ` (${testOrdersSkipped} test orders skipped)` : ""}...`
    )
    await upsertOrders(ordersToInsert)
  } else if (testOrdersSkipped > 0) {
    console.log(`⚠️ All ${testOrdersSkipped} orders were test orders - skipped`)
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
    console.log(`💳 Inserting ${transactionsToInsert.length} transactions...`)
    await upsertTransactions(transactionsToInsert)
  }

  return {
    ordersCount: ordersToInsert.length,
    transactionsCount: transactionsToInsert.length,
  }
}

/**
 * Reset the sync cursor - useful for starting a completely fresh sync
 * This will clear the saved cursor position, forcing the next sync to start from the beginning
 */
export async function resetSyncCursor(): Promise<boolean> {
  try {
    await updateSyncState("orders", {
      last_cursor: null,
      sync_status: "completed",
      error_message: null,
    })
    console.log("✅ Sync cursor has been reset")
    return true
  } catch (error) {
    console.error("❌ Failed to reset sync cursor:", error)
    return false
  }
}

/**
 * Get current sync state for debugging
 */
export async function debugSyncState(): Promise<void> {
  try {
    const syncState = await getSyncState("orders")
    const lastUpdatedAt = await getLastUpdatedAt()

    console.log("🔍 Current Sync State Debug Info:")
    console.log(
      "  Sync Status:",
      syncState?.sync_status || "No sync state found"
    )
    console.log("  Last Sync At:", syncState?.last_sync_at || "Never")
    console.log("  Last Cursor:", syncState?.last_cursor || "None")
    console.log("  Error Message:", syncState?.error_message || "None")
    console.log("  getLastUpdatedAt():", lastUpdatedAt || "No timestamp")

    if (lastUpdatedAt) {
      const timeSinceLastSync = Date.now() - new Date(lastUpdatedAt).getTime()
      const minutesAgo = Math.floor(timeSinceLastSync / (1000 * 60))
      console.log(`  Time since last sync: ${minutesAgo} minutes ago`)
    }
  } catch (error) {
    console.error("❌ Failed to get sync state:", error)
  }
}
