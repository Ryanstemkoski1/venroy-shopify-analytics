/**
 * Individual Orders Service
 *
 * Provides detailed order and transaction data for troubleshooting purposes
 * Following the existing pattern from get-sales-by-channel.ts
 */

import { createClient } from "../supabase/server"

export interface IndividualOrderData {
  // Order information
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

  // Transaction summary
  transactions: {
    id: number
    shopify_transaction_id: string
    kind: string
    status: string
    amount: number
    currency: string
    processed_at: string
    created_at: string
    gateway: string | null
  }[]

  // Calculated metrics
  total_sales: number
  total_refunds: number
  net_amount: number
  transaction_count: number
}

export interface IndividualOrdersResponse {
  orders: IndividualOrderData[]
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
  summary: {
    totalOrders: number
    totalSales: number
    totalRefunds: number
    totalNet: number
    currency: string
  }
}

/**
 * Get individual orders with detailed transaction data
 * Server-side function following existing service patterns
 */
export async function getIndividualOrders(
  fromDate: string,
  toDate: string,
  page: number = 1,
  pageSize: number = 50
): Promise<IndividualOrdersResponse> {
  try {
    const supabase = await createClient()

    // Adjust toDate to include entire day (following get-sales-by-channel pattern)
    const toDateEndOfDay = toDate.includes("T")
      ? toDate
      : `${toDate}T23:59:59.999Z`

    // Get transactions within date range first (following existing pattern)
    const { data: transactions, error: transactionsError } = await supabase
      .from("transactions")
      .select(
        `
        order_id,
        kind,
        status,
        amount,
        currency,
        processed_at,
        created_at,
        gateway,
        id,
        shopify_transaction_id
      `
      )
      .gte("processed_at", fromDate)
      .lte("processed_at", toDateEndOfDay)
      .order("processed_at", { ascending: false })

    if (transactionsError) {
      console.error("❌ Transactions query error:", transactionsError)
      throw new Error(`Transactions query failed: ${transactionsError.message}`)
    }

    if (!transactions || transactions.length === 0) {
      return {
        orders: [],
        pagination: {
          page,
          pageSize,
          totalCount: 0,
          totalPages: 0,
        },
        summary: {
          totalOrders: 0,
          totalSales: 0,
          totalRefunds: 0,
          totalNet: 0,
          currency: "USD",
        },
      }
    }

    // Get unique order IDs from transactions
    const orderIds = [...new Set(transactions.map((t) => t.order_id))]

    // Get total count for pagination
    const totalCount = orderIds.length
    const totalPages = Math.ceil(totalCount / pageSize)

    // Get orders for current page
    const paginatedOrderIds = orderIds.slice(
      (page - 1) * pageSize,
      page * pageSize
    )

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(
        `
        id,
        shopify_order_id,
        name,
        created_at,
        processed_at,
        updated_at,
        financial_status,
        source_name,
        channel_id,
        channel_display_name,
        subtotal_amount,
        total_amount,
        total_tax_amount,
        total_discounts_amount,
        total_shipping_amount,
        currency,
        test
      `
      )
      .in("id", paginatedOrderIds)
      .eq("test", false)
      .order("processed_at", { ascending: false })

    if (ordersError) {
      console.error("❌ Orders query error:", ordersError)
      throw new Error(`Orders query failed: ${ordersError.message}`)
    }

    if (!orders || orders.length === 0) {
      return {
        orders: [],
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
        },
        summary: {
          totalOrders: 0,
          totalSales: 0,
          totalRefunds: 0,
          totalNet: 0,
          currency: "USD",
        },
      }
    }

    // Group transactions by order ID
    const transactionsByOrderId = new Map<number, typeof transactions>()
    transactions.forEach((transaction) => {
      if (!transactionsByOrderId.has(transaction.order_id)) {
        transactionsByOrderId.set(transaction.order_id, [])
      }
      transactionsByOrderId.get(transaction.order_id)!.push(transaction)
    })

    // Combine orders with their transactions and calculate metrics
    const individualOrders: IndividualOrderData[] = orders.map((order) => {
      const orderTransactions = transactionsByOrderId.get(order.id) || []

      // Calculate transaction metrics
      const salesTransactions = orderTransactions.filter(
        (t) => t.kind === "sale" && t.status === "success"
      )
      const refundTransactions = orderTransactions.filter(
        (t) => t.kind === "refund" && t.status === "success"
      )

      const total_sales = salesTransactions.reduce(
        (sum, t) => sum + t.amount,
        0
      )
      const total_refunds = refundTransactions.reduce(
        (sum, t) => sum + t.amount,
        0
      )
      const net_amount = total_sales - total_refunds

      return {
        ...order,
        transactions: orderTransactions,
        total_sales,
        total_refunds,
        net_amount,
        transaction_count: orderTransactions.length,
      }
    })

    // Calculate summary metrics
    const summary = {
      totalOrders: individualOrders.length,
      totalSales: individualOrders.reduce(
        (sum, order) => sum + order.total_sales,
        0
      ),
      totalRefunds: individualOrders.reduce(
        (sum, order) => sum + order.total_refunds,
        0
      ),
      totalNet: individualOrders.reduce(
        (sum, order) => sum + order.net_amount,
        0
      ),
      currency: orders[0]?.currency || "USD",
    }

    return {
      orders: individualOrders,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
      summary,
    }
  } catch (error) {
    console.error("❌ Failed to get individual orders:", error)
    throw error
  }
}

/**
 * Generate CSV export data for individual orders
 */
export function generateOrdersCSV(orders: IndividualOrderData[]): string {
  const csvHeaders = [
    "Order Name",
    "Shopify Order ID",
    "Created At",
    "Processed At",
    "Updated At",
    "Financial Status",
    "Channel",
    "Channel ID",
    "Source Name",
    "Subtotal Amount",
    "Total Tax",
    "Total Shipping",
    "Total Discounts",
    "Total Amount",
    "Total Sales (Transactions)",
    "Total Refunds (Transactions)",
    "Net Amount",
    "Transaction Count",
    "Currency",
    "Test Order",
  ]

  const csvRows = orders.map((order) => [
    `"${order.name}"`,
    `"${order.shopify_order_id}"`,
    `"${new Date(order.created_at).toISOString()}"`,
    `"${order.processed_at ? new Date(order.processed_at).toISOString() : ""}"`,
    `"${new Date(order.updated_at).toISOString()}"`,
    `"${order.financial_status || ""}"`,
    `"${order.channel_display_name || order.source_name || ""}"`,
    `"${order.channel_id || ""}"`,
    `"${order.source_name || ""}"`,
    order.subtotal_amount,
    order.total_tax_amount,
    order.total_shipping_amount,
    order.total_discounts_amount,
    order.total_amount,
    order.total_sales,
    order.total_refunds,
    order.net_amount,
    order.transaction_count,
    `"${order.currency}"`,
    order.test ? "TRUE" : "FALSE",
  ])

  return [csvHeaders.join(","), ...csvRows.map((row) => row.join(","))].join(
    "\n"
  )
}
