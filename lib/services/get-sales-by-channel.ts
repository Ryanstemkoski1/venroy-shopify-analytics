/**
 * Sales Analytics Service
 *
 * Database-driven analytics for sales channel performance
 */

import { createClient } from "../supabase/server"
import type { DatabaseTransaction } from "../supabase/types"

export interface SalesChannelData {
  channel: string
  grossSales: number
  refunds: number
  netSales: number
  discounts: number
  taxes: number
  shippingCharges: number
  currency: string
}

export interface SalesChannelAnalytics {
  dateRange: {
    from: string
    to: string
  }
  channels: SalesChannelData[]
  totals: {
    grossSales: number
    refunds: number
    netSales: number
    currency: string
  }
}

/**
 * Get sales analytics by channel from database
 */
export async function getSalesByChannel(
  fromDate: string,
  toDate: string
): Promise<SalesChannelAnalytics> {
  try {
    const supabase = await createClient()

    // Adjust toDate to include entire day (23:59:59.999)
    const toDateEndOfDay = toDate.includes("T")
      ? toDate
      : `${toDate}T23:59:59.999Z`

    // Query transactions within date range first (transaction-centric approach)
    const pageSize = 1000
    let page = 1
    let hasMore = true
    const allTransactions: Pick<
      DatabaseTransaction,
      "order_id" | "kind" | "status" | "amount"
    >[] = []

    while (hasMore) {
      const { data: pageData, error: transactionsError } = await supabase
        .from("transactions")
        .select("order_id, kind, status, amount")
        .gte("processed_at", fromDate)
        .lte("processed_at", toDateEndOfDay)
        .order("processed_at")
        .range((page - 1) * pageSize, page * pageSize - 1)

      if (transactionsError) {
        console.error("❌ Transactions query error:", transactionsError)
        throw new Error(
          `Transactions query failed: ${transactionsError.message}`
        )
      }

      if (pageData && pageData.length > 0) {
        allTransactions.push(...pageData)
        hasMore = pageData.length === pageSize
        page++
      } else {
        hasMore = false
      }
    }

    if (allTransactions.length === 0) {
      return {
        dateRange: { from: fromDate, to: toDate },
        channels: [],
        totals: {
          grossSales: 0,
          refunds: 0,
          netSales: 0,
          currency: "USD",
        },
      }
    }

    // Get unique order IDs from transactions
    const orderIds = [...new Set(allTransactions.map((t) => t.order_id))]

    // Query orders for these transactions with pagination
    const allOrders: Array<{
      id: number
      source_name: string | null
      channel_id: string | null
      channel_display_name: string | null
      currency: string
      total_tax_amount: number
      total_discounts_amount: number
      total_shipping_amount: number
    }> = []
    page = 1
    hasMore = true

    while (hasMore) {
      const { data: pageData, error } = await supabase
        .from("orders")
        .select(
          `
          id,
          source_name, 
          channel_id, 
          channel_display_name, 
          currency,
          total_tax_amount,
          total_discounts_amount,
          total_shipping_amount
        `
        )
        .in("id", orderIds.slice((page - 1) * pageSize, page * pageSize))
        .eq("test", false)

      if (error) {
        console.error("❌ Database query error:", error)
        throw new Error(`Database query failed: ${error.message}`)
      }

      if (pageData && pageData.length > 0) {
        allOrders.push(...pageData)
        hasMore = orderIds.length > page * pageSize
        page++
      } else {
        hasMore = false
      }
    }

    if (allOrders.length === 0) {
      return {
        dateRange: { from: fromDate, to: toDate },
        channels: [],
        totals: {
          grossSales: 0,
          refunds: 0,
          netSales: 0,
          currency: "USD",
        },
      }
    }

    // Create a map of order ID to transactions for fast lookup
    const transactionsByOrderId = new Map<number, typeof allTransactions>()
    allTransactions.forEach((transaction) => {
      if (!transactionsByOrderId.has(transaction.order_id)) {
        transactionsByOrderId.set(transaction.order_id, [])
      }
      transactionsByOrderId.get(transaction.order_id)!.push(transaction)
    })

    // Process orders and their transactions into channel analytics
    const channelMap = new Map<
      string,
      {
        sales: number
        refunds: number
        orders: Set<number>
        taxes: number
        discounts: number
        shipping: number
        currency: string
      }
    >()

    allOrders.forEach((order) => {
      // Use channel display name with fallback to source name
      const channel =
        order.channel_display_name || order.source_name || "Unknown"

      if (!channelMap.has(channel)) {
        channelMap.set(channel, {
          sales: 0,
          refunds: 0,
          orders: new Set(),
          taxes: 0,
          discounts: 0,
          shipping: 0,
          currency: order.currency,
        })
      }

      const channelData = channelMap.get(channel)!

      // Track unique orders for this channel
      channelData.orders.add(order.id)

      // Add order-level financial data (accumulated once per order)
      channelData.taxes += order.total_tax_amount || 0
      channelData.discounts += order.total_discounts_amount || 0
      channelData.shipping += order.total_shipping_amount || 0

      // Process transactions for this order
      const orderTransactions = transactionsByOrderId.get(order.id) || []
      orderTransactions.forEach((transaction) => {
        if (transaction.status?.toLowerCase() === "success") {
          const kind = transaction.kind?.toLowerCase()

          // Net Sales = sum(SALE + CAPTURE)
          if (kind === "sale" || kind === "capture") {
            channelData.sales += transaction.amount
          }
          // Net Refunds = sum(REFUND + CHANGE) - use Math.abs for negative refund amounts
          else if (kind === "refund" || kind === "change") {
            channelData.refunds += Math.abs(transaction.amount)
          }
        }
      })
    })

    // Convert to expected interface format and sort by netSales descending
    const channels: SalesChannelData[] = Array.from(channelMap.entries())
      .map(([channel, data]) => ({
        channel,
        grossSales: data.sales,
        refunds: data.refunds,
        netSales: data.sales - data.refunds,
        discounts: data.discounts,
        taxes: data.taxes,
        shippingCharges: data.shipping,
        currency: data.currency,
      }))
      .sort((a, b) => b.netSales - a.netSales) // Sort by net sales descending

    // Calculate totals
    const totals = channels.reduce(
      (acc, channel) => ({
        grossSales: acc.grossSales + channel.grossSales,
        refunds: acc.refunds + channel.refunds,
        netSales: acc.netSales + channel.netSales,
        currency: channel.currency, // Use first currency found
      }),
      {
        grossSales: 0,
        refunds: 0,
        netSales: 0,
        currency: "USD",
      }
    )

    return {
      dateRange: { from: fromDate, to: toDate },
      channels,
      totals,
    }
  } catch (error) {
    console.error("❌ Failed to get database analytics:", error)

    // Fallback to empty result
    return {
      dateRange: { from: fromDate, to: toDate },
      channels: [],
      totals: {
        grossSales: 0,
        refunds: 0,
        netSales: 0,
        currency: "USD",
      },
    }
  }
}
