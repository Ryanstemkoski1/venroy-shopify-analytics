/**
 * Orders Over Time Analytics Service
 */

import { createClient } from "../supabase/server"
import { eachDayOfInterval, parseISO, format } from "date-fns"

export interface DailyOrderData {
  date: string
  totalOrders: number
  totalValue: number
  averageOrderValue: number
  currency: string
}

export interface OrdersOverTimeAnalytics {
  dateRange: {
    from: string
    to: string
  }
  dailyData: DailyOrderData[]
  totals: {
    totalOrders: number
    totalValue: number
    averageOrderValue: number
    currency: string
  }
}

/**
 * Get orders analytics over time from database
 * Uses order created_at dates for filtering
 */
export async function getOrdersOverTime(
  fromDate: string,
  toDate: string
): Promise<OrdersOverTimeAnalytics> {
  try {
    const supabase = await createClient()

    // Ensure we're querying with proper UTC timestamps
    const fromDateUTC = fromDate.includes("T")
      ? fromDate
      : `${fromDate}T00:00:00.000Z`
    const toDateUTC = toDate.includes("T") ? toDate : `${toDate}T23:59:59.999Z`

    console.log("📅 Fetching orders data for date range:", {
      from: fromDateUTC,
      to: toDateUTC,
    })

    // Query orders by creation date with pagination
    const pageSize = 1000
    let page = 1
    let hasMore = true
    const allOrders: Array<{
      id: number
      total_amount: number
      currency: string
      created_at: string
    }> = []

    while (hasMore) {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, total_amount, currency, created_at")
        .gte("created_at", fromDateUTC)
        .lte("created_at", toDateUTC)
        .range(from, to)
        .order("created_at", { ascending: true })

      if (error) {
        console.error("❌ Database error fetching orders:", error)
        throw new Error(`Database error: ${error.message}`)
      }

      if (!orders || orders.length === 0) {
        hasMore = false
        break
      }

      allOrders.push(...orders)
      hasMore = orders.length === pageSize
      page++

      console.log(`📦 Fetched page ${page - 1}: ${orders.length} orders`)
    }

    console.log(`✅ Total orders fetched: ${allOrders.length}`)

    if (allOrders.length === 0) {
      return {
        dateRange: { from: fromDate, to: toDate },
        dailyData: [],
        totals: {
          totalOrders: 0,
          totalValue: 0,
          averageOrderValue: 0,
          currency: "USD",
        },
      }
    }

    // Process the data into daily aggregates based on order creation dates
    const dailyMap = new Map<
      string,
      {
        date: string
        orderCount: number
        totalValue: number
        currency: string
      }
    >()

    allOrders.forEach((order) => {
      if (!order.created_at) return

      // Extract date part using UTC to avoid timezone issues
      const createdDate = new Date(order.created_at)
      const utcDateStr =
        createdDate.getUTCFullYear() +
        "-" +
        String(createdDate.getUTCMonth() + 1).padStart(2, "0") +
        "-" +
        String(createdDate.getUTCDate()).padStart(2, "0")

      const current = dailyMap.get(utcDateStr) || {
        date: utcDateStr,
        orderCount: 0,
        totalValue: 0,
        currency: order.currency || "USD",
      }

      current.orderCount += 1
      current.totalValue += order.total_amount || 0

      dailyMap.set(utcDateStr, current)
    })

    // Convert to array and calculate averages
    const dailyData: DailyOrderData[] = Array.from(dailyMap.values())
      .map((day) => ({
        date: day.date,
        totalOrders: day.orderCount,
        totalValue: day.totalValue,
        averageOrderValue:
          day.orderCount > 0 ? day.totalValue / day.orderCount : 0,
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
          totalOrders: 0,
          totalValue: 0,
          averageOrderValue: 0,
          currency: "USD",
        }
      )
    })

    // Calculate totals from actual data (not including zero-filled days)
    const totals = dailyData.reduce(
      (acc, day) => ({
        totalOrders: acc.totalOrders + day.totalOrders,
        totalValue: acc.totalValue + day.totalValue,
        averageOrderValue: 0, // Will calculate after
        currency: day.currency,
      }),
      {
        totalOrders: 0,
        totalValue: 0,
        averageOrderValue: 0,
        currency: "USD",
      }
    )

    // Calculate overall average order value
    totals.averageOrderValue =
      totals.totalOrders > 0 ? totals.totalValue / totals.totalOrders : 0

    return {
      dateRange: { from: fromDate, to: toDate },
      dailyData: completeDailyData,
      totals,
    }
  } catch (error) {
    console.error("Error in getOrdersOverTime:", error)
    throw error
  }
}
