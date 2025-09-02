/**
 * Sales Over Time Analytics Service
 */

import { createClient } from "../supabase/server"
import { eachDayOfInterval, parseISO, format } from "date-fns"
import type { DatabaseTransaction } from "../supabase/types"

export interface DailySalesData {
  date: string
  grossSales: number
  refunds: number
  netSales: number
  currency: string
}

export interface SalesOverTimeAnalytics {
  dateRange: {
    from: string
    to: string
  }
  dailyData: DailySalesData[]
  totals: {
    grossSales: number
    refunds: number
    netSales: number
    currency: string
  }
}

/**
 * Get sales analytics over time from database
 * Uses pagination to handle large datasets efficiently
 */
export async function getSalesOverTime(
  fromDate: string,
  toDate: string
): Promise<SalesOverTimeAnalytics> {
  try {
    const supabase = await createClient()

    // Ensure we're querying with proper UTC timestamps
    const fromDateUTC = fromDate.includes("T")
      ? fromDate
      : `${fromDate}T00:00:00.000Z`
    const toDateUTC = toDate.includes("T") ? toDate : `${toDate}T23:59:59.999Z`

    // Start with transactions within date range (transaction-centric approach)
    const pageSize = 1000
    let page = 1
    let hasMore = true
    const allTransactions: Pick<
      DatabaseTransaction,
      "processed_at" | "amount" | "currency" | "kind" | "status" | "order_id"
    >[] = []

    while (hasMore) {
      const { data: pageData, error: transactionsError } = await supabase
        .from("transactions")
        .select(
          `
          processed_at,
          amount,
          currency,
          kind,
          status,
          order_id
        `
        )
        .gte("processed_at", fromDateUTC)
        .lte("processed_at", toDateUTC)
        .order("processed_at")
        .range((page - 1) * pageSize, page * pageSize - 1)

      if (transactionsError) {
        console.error("Error fetching transactions data:", transactionsError)
        throw new Error(
          `Failed to fetch transactions data: ${transactionsError.message}`
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
        dailyData: [],
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

    // Query orders for these transactions
    const allOrders: Array<{
      id: number
      processed_at: string
      total_amount: number
      currency: string
    }> = []
    page = 1
    hasMore = true

    while (hasMore) {
      const { data: pageData, error: pageError } = await supabase
        .from("orders")
        .select(
          `
          id,
          processed_at,
          total_amount,
          currency
        `
        )
        .in("id", orderIds.slice((page - 1) * pageSize, page * pageSize))
        .eq("test", false)

      if (pageError) {
        console.error("Error fetching orders data:", pageError)
        throw new Error(`Failed to fetch orders data: ${pageError.message}`)
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
        dailyData: [],
        totals: {
          grossSales: 0,
          refunds: 0,
          netSales: 0,
          currency: "USD",
        },
      }
    }

    // Process the data into daily aggregates based on transaction dates
    const dailyMap = new Map<
      string,
      {
        date: string
        grossSales: number
        refunds: number
        currency: string
      }
    >()

    // Process transactions first (since we're doing transaction-centric analysis)
    allTransactions.forEach((transaction) => {
      if (!transaction.processed_at) return

      // Extract date part using UTC to avoid timezone issues
      const processedDate = new Date(transaction.processed_at)
      const utcDateStr =
        processedDate.getUTCFullYear() +
        "-" +
        String(processedDate.getUTCMonth() + 1).padStart(2, "0") +
        "-" +
        String(processedDate.getUTCDate()).padStart(2, "0")

      const current = dailyMap.get(utcDateStr) || {
        date: utcDateStr,
        grossSales: 0,
        refunds: 0,
        currency: transaction.currency || "USD",
      }

      if (transaction.status?.toLowerCase() === "success") {
        const kind = transaction.kind?.toLowerCase()

        if (kind === "sale" || kind === "capture") {
          current.grossSales += transaction.amount
        } else if (kind === "refund") {
          current.refunds += Math.abs(transaction.amount)
        }
      }

      dailyMap.set(utcDateStr, current)
    })

    // Convert to array and calculate net sales
    const dailyData: DailySalesData[] = Array.from(dailyMap.values())
      .map((day) => ({
        date: day.date,
        grossSales: day.grossSales,
        refunds: day.refunds,
        netSales: day.grossSales - day.refunds,
        currency: day.currency,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Fill in missing days with zero data to show complete date range
    const startDate = parseISO(fromDate)
    const endDate = parseISO(toDate.split("T")[0]) // Remove time part if present
    const allDays = eachDayOfInterval({ start: startDate, end: endDate })

    const completeDailyData = allDays.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd")
      const existingData = dailyData.find((d) => d.date === dateStr)

      return (
        existingData || {
          date: dateStr,
          grossSales: 0,
          refunds: 0,
          netSales: 0,
          currency: "USD",
        }
      )
    })

    // Calculate totals from actual data (not including zero-filled days)
    const totals = dailyData.reduce(
      (acc, day) => ({
        grossSales: acc.grossSales + day.grossSales,
        refunds: acc.refunds + day.refunds,
        netSales: acc.netSales + day.netSales,
        currency: day.currency,
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
      dailyData: completeDailyData,
      totals,
    }
  } catch (error) {
    console.error("Error in getSalesOverTime:", error)
    throw error
  }
}
