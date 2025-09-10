/**
 * Individual Orders Service
 *
 * Provides detailed order and transaction data for troubleshooting purposes
 * Following the existing pattern from get-sales-by-channel.ts
 */

import { createClient } from "../supabase/server"
import type { DatabaseTransaction } from "../supabase/types"

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

    // Query transactions within date range with pagination to get ALL transactions
    const transactionPageSize = 1000
    let transactionPage = 1
    let hasMoreTransactions = true
    const allTransactions: Pick<
      DatabaseTransaction,
      | "order_id"
      | "kind"
      | "status"
      | "amount"
      | "currency"
      | "processed_at"
      | "created_at"
      | "gateway"
      | "id"
      | "shopify_transaction_id"
    >[] = []

    while (hasMoreTransactions) {
      const { data: pageData, error: transactionsError } = await supabase
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
        .range(
          (transactionPage - 1) * transactionPageSize,
          transactionPage * transactionPageSize - 1
        )

      if (transactionsError) {
        console.error("❌ Transactions query error:", transactionsError)
        throw new Error(
          `Transactions query failed: ${transactionsError.message}`
        )
      }

      if (pageData && pageData.length > 0) {
        allTransactions.push(...pageData)
        hasMoreTransactions = pageData.length === transactionPageSize
        transactionPage++
      } else {
        hasMoreTransactions = false
      }
    }

    if (allTransactions.length === 0) {
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
    const orderIds = [...new Set(allTransactions.map((t) => t.order_id))]

    console.log(`📊 Debug: Total transactions: ${allTransactions.length}`)
    console.log(`📊 Debug: Unique order IDs: ${orderIds.length}`)

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
    const transactionsByOrderId = new Map<number, typeof allTransactions>()
    allTransactions.forEach((transaction) => {
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
        (t) =>
          t.status?.toLowerCase() === "success" &&
          (t.kind?.toLowerCase() === "sale" ||
            t.kind?.toLowerCase() === "capture")
      )
      const refundTransactions = orderTransactions.filter(
        (t) =>
          t.status?.toLowerCase() === "success" &&
          (t.kind?.toLowerCase() === "refund" ||
            t.kind?.toLowerCase() === "change")
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

    // Calculate summary metrics from ALL orders in date range, not just current page
    // Query orders in chunks to avoid query size limits
    const chunkSize = 1000
    const allOrdersForSummary = []

    for (let i = 0; i < orderIds.length; i += chunkSize) {
      const chunk = orderIds.slice(i, i + chunkSize)

      const { data: chunkData, error: chunkError } = await supabase
        .from("orders")
        .select(
          `
          id,
          currency
        `
        )
        .in("id", chunk)
        .eq("test", false)

      if (chunkError) {
        console.error("❌ Orders chunk query error:", chunkError)
        throw new Error(`Orders chunk query failed: ${chunkError.message}`)
      }

      if (chunkData) {
        allOrdersForSummary.push(...chunkData)
      }
    }

    // Calculate summary from all transactions in date range
    const allSalesTransactions = allTransactions.filter(
      (t) =>
        t.status?.toLowerCase() === "success" &&
        (t.kind?.toLowerCase() === "sale" ||
          t.kind?.toLowerCase() === "capture")
    )
    const allRefundTransactions = allTransactions.filter(
      (t) =>
        t.status?.toLowerCase() === "success" &&
        (t.kind?.toLowerCase() === "refund" ||
          t.kind?.toLowerCase() === "change")
    )

    const totalSalesAmount = allSalesTransactions.reduce(
      (sum, t) => sum + t.amount,
      0
    )
    const totalRefundsAmount = allRefundTransactions.reduce(
      (sum, t) => sum + t.amount,
      0
    )

    const summary = {
      totalOrders: orderIds.length, // Total unique orders in date range
      totalSales: totalSalesAmount,
      totalRefunds: totalRefundsAmount,
      totalNet: totalSalesAmount - totalRefundsAmount,
      currency:
        allOrdersForSummary[0]?.currency || orders[0]?.currency || "USD",
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
 * Get ALL individual orders for export (no pagination)
 * Separate function to ensure we get all orders regardless of count
 */
export async function getAllIndividualOrdersForExport(
  fromDate: string,
  toDate: string
): Promise<IndividualOrderData[]> {
  try {
    const supabase = await createClient()

    // Adjust toDate to include entire day
    const toDateEndOfDay = toDate.includes("T")
      ? toDate
      : `${toDate}T23:59:59.999Z`

    // Query transactions within date range with pagination to get ALL transactions
    const transactionPageSize = 1000
    let transactionPage = 1
    let hasMoreTransactions = true
    const allTransactions: Pick<
      DatabaseTransaction,
      | "order_id"
      | "kind"
      | "status"
      | "amount"
      | "currency"
      | "processed_at"
      | "created_at"
      | "gateway"
      | "id"
      | "shopify_transaction_id"
    >[] = []

    while (hasMoreTransactions) {
      const { data: pageData, error: transactionsError } = await supabase
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
        .range(
          (transactionPage - 1) * transactionPageSize,
          transactionPage * transactionPageSize - 1
        )

      if (transactionsError) {
        console.error("❌ Transactions query error:", transactionsError)
        throw new Error(
          `Transactions query failed: ${transactionsError.message}`
        )
      }

      if (pageData && pageData.length > 0) {
        allTransactions.push(...pageData)
        hasMoreTransactions = pageData.length === transactionPageSize
        transactionPage++
      } else {
        hasMoreTransactions = false
      }
    }

    if (allTransactions.length === 0) {
      return []
    }

    // Get ALL unique order IDs from transactions
    const orderIds = [...new Set(allTransactions.map((t) => t.order_id))]

    // Get ALL orders with chunking to avoid query size limits
    const chunkSize = 1000
    const allOrders = []

    for (let i = 0; i < orderIds.length; i += chunkSize) {
      const chunk = orderIds.slice(i, i + chunkSize)

      const { data: chunkData, error: chunkError } = await supabase
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
        .in("id", chunk)
        .eq("test", false)
        .order("processed_at", { ascending: false })

      if (chunkError) {
        console.error("❌ Orders chunk query error:", chunkError)
        throw new Error(`Orders chunk query failed: ${chunkError.message}`)
      }

      if (chunkData) {
        allOrders.push(...chunkData)
      }
    }

    if (allOrders.length === 0) {
      return []
    }

    // Group transactions by order ID
    const transactionsByOrderId = new Map<number, typeof allTransactions>()
    allTransactions.forEach((transaction) => {
      if (!transactionsByOrderId.has(transaction.order_id)) {
        transactionsByOrderId.set(transaction.order_id, [])
      }
      transactionsByOrderId.get(transaction.order_id)!.push(transaction)
    })

    // Combine orders with their transactions and calculate metrics
    const individualOrders: IndividualOrderData[] = allOrders.map((order) => {
      const orderTransactions = transactionsByOrderId.get(order.id) || []

      // Calculate transaction metrics
      const salesTransactions = orderTransactions.filter(
        (t) =>
          t.status?.toLowerCase() === "success" &&
          (t.kind?.toLowerCase() === "sale" ||
            t.kind?.toLowerCase() === "capture")
      )
      const refundTransactions = orderTransactions.filter(
        (t) =>
          t.status?.toLowerCase() === "success" &&
          (t.kind?.toLowerCase() === "refund" ||
            t.kind?.toLowerCase() === "change")
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

    return individualOrders
  } catch (error) {
    console.error("❌ Failed to get all individual orders for export:", error)
    throw error
  }
}

/**
 * Generate CSV export data for individual orders
 * @param orders - Array of individual order data
 * @returns CSV string content
 */
export function generateOrdersCSV(orders: IndividualOrderData[]): string {
  const headers = [
    "Order Name",
    "Shopify Order ID",
    "Created Date",
    "Processed Date",
    "Channel",
    "Financial Status",
    "Subtotal",
    "Tax",
    "Shipping",
    "Discounts",
    "Total Amount",
    "Total Sales",
    "Total Refunds",
    "Net Amount",
    "Currency",
    "Transaction Count",
    "Test Order",
  ]

  const csvRows = [
    headers.join(","),
    ...orders.map((order) =>
      [
        `"${order.name}"`,
        `"${order.shopify_order_id}"`,
        `"${new Date(order.created_at).toLocaleString()}"`,
        `"${order.processed_at ? new Date(order.processed_at).toLocaleString() : "Not processed"}"`,
        `"${order.channel_display_name || order.source_name || "Unknown"}"`,
        `"${order.financial_status || "Unknown"}"`,
        order.subtotal_amount,
        order.total_tax_amount,
        order.total_shipping_amount,
        order.total_discounts_amount,
        order.total_amount,
        order.total_sales,
        order.total_refunds,
        order.net_amount,
        `"${order.currency}"`,
        order.transaction_count,
        order.test ? "Yes" : "No",
      ].join(",")
    ),
  ]

  return csvRows.join("\n")
}
