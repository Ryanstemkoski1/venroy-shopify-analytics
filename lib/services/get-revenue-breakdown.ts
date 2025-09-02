/**
 * Revenue Breakdown Analytics Service
 * Analyzes revenue by different categories and time periods
 */

import { createClient } from "../supabase/server"

export interface RevenueBreakdownData {
  category: string
  amount: number
  percentage: number
  currency: string
}

export interface RevenueBreakdownAnalytics {
  dateRange: {
    from: string
    to: string
  }
  breakdown: RevenueBreakdownData[]
  totals: {
    grossRevenue: number
    refunds: number
    netRevenue: number
    taxes: number
    discounts: number
    shipping: number
    currency: string
  }
}

/**
 * Get revenue breakdown analytics from database
 * Analyzes transaction data to break down revenue by components
 */
export async function getRevenueBreakdown(
  fromDate: string,
  toDate: string
): Promise<RevenueBreakdownAnalytics> {
  try {
    const supabase = await createClient()

    // Ensure we're querying with proper UTC timestamps
    const fromDateUTC = fromDate.includes("T")
      ? fromDate
      : `${fromDate}T00:00:00.000Z`
    const toDateUTC = toDate.includes("T") ? toDate : `${toDate}T23:59:59.999Z`

    console.log("💰 Fetching revenue data for date range:", {
      from: fromDateUTC,
      to: toDateUTC,
    })

    // Query successful transactions with pagination
    const pageSize = 1000
    let page = 1
    let hasMore = true
    const allTransactions: Array<{
      amount: number
      kind: string | null
      status: string | null
      currency: string
      order_id: number
    }> = []

    while (hasMore) {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("amount, kind, status, currency, order_id")
        .gte("processed_at", fromDateUTC)
        .lte("processed_at", toDateUTC)
        .eq("status", "success")
        .range(from, to)
        .order("processed_at", { ascending: true })

      if (error) {
        console.error("❌ Database error fetching transactions:", error)
        throw new Error(`Database error: ${error.message}`)
      }

      if (!transactions || transactions.length === 0) {
        hasMore = false
        break
      }

      allTransactions.push(...transactions)
      hasMore = transactions.length === pageSize
      page++

      console.log(
        `💳 Fetched page ${page - 1}: ${transactions.length} transactions`
      )
    }

    console.log(`✅ Total transactions fetched: ${allTransactions.length}`)

    if (allTransactions.length === 0) {
      return {
        dateRange: { from: fromDate, to: toDate },
        breakdown: [],
        totals: {
          grossRevenue: 0,
          refunds: 0,
          netRevenue: 0,
          taxes: 0,
          discounts: 0,
          shipping: 0,
          currency: "USD",
        },
      }
    }

    // Get unique order IDs and fetch order details for additional revenue components
    const orderIds = [...new Set(allTransactions.map((t) => t.order_id))]

    const allOrders: Array<{
      id: number
      total_tax_amount: number | null
      total_discounts_amount: number | null
      total_shipping_amount: number | null
      currency: string
    }> = []

    // Fetch orders in chunks
    for (let i = 0; i < orderIds.length; i += pageSize) {
      const chunk = orderIds.slice(i, i + pageSize)

      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(
          "id, total_tax_amount, total_discounts_amount, total_shipping_amount, currency"
        )
        .in("id", chunk)

      if (ordersError) {
        console.error("❌ Database error fetching orders:", ordersError)
        throw new Error(`Database error: ${ordersError.message}`)
      }

      if (orders) {
        allOrders.push(...orders)
      }
    }

    // Process transactions to calculate revenue components
    let grossRevenue = 0
    let refunds = 0
    const processedOrders = new Set<number>()
    let taxes = 0
    let discounts = 0
    let shipping = 0
    const currency = allTransactions[0]?.currency || "USD"

    allTransactions.forEach((transaction) => {
      const kind = transaction.kind?.toLowerCase()

      if (kind === "sale" || kind === "capture") {
        grossRevenue += transaction.amount
      } else if (kind === "refund" || kind === "change") {
        refunds += Math.abs(transaction.amount)
      }

      // Add order-level amounts only once per order
      if (!processedOrders.has(transaction.order_id)) {
        const order = allOrders.find((o) => o.id === transaction.order_id)
        if (order) {
          taxes += order.total_tax_amount || 0
          discounts += order.total_discounts_amount || 0
          shipping += order.total_shipping_amount || 0
          processedOrders.add(transaction.order_id)
        }
      }
    })

    const netRevenue = grossRevenue - refunds

    // Create breakdown data
    const breakdown: RevenueBreakdownData[] = [
      {
        category: "Gross Revenue",
        amount: grossRevenue,
        percentage: netRevenue > 0 ? (grossRevenue / grossRevenue) * 100 : 0,
        currency,
      },
      {
        category: "Refunds",
        amount: -refunds, // Negative for display
        percentage: grossRevenue > 0 ? (-refunds / grossRevenue) * 100 : 0,
        currency,
      },
      {
        category: "Taxes Collected",
        amount: taxes,
        percentage: grossRevenue > 0 ? (taxes / grossRevenue) * 100 : 0,
        currency,
      },
      {
        category: "Discounts Given",
        amount: -discounts, // Negative for display
        percentage: grossRevenue > 0 ? (-discounts / grossRevenue) * 100 : 0,
        currency,
      },
      {
        category: "Shipping Revenue",
        amount: shipping,
        percentage: grossRevenue > 0 ? (shipping / grossRevenue) * 100 : 0,
        currency,
      },
    ].filter((item) => item.amount !== 0) // Only show non-zero items

    return {
      dateRange: { from: fromDate, to: toDate },
      breakdown,
      totals: {
        grossRevenue,
        refunds,
        netRevenue,
        taxes,
        discounts,
        shipping,
        currency,
      },
    }
  } catch (error) {
    console.error("Error in getRevenueBreakdown:", error)
    throw error
  }
}
