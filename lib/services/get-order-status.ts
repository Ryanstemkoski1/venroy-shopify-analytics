/**
 * Order Status Analytics Service
 */

import { createClient } from "../supabase/server"

export interface OrderStatusData {
  status: string
  count: number
  totalAmount: number
  percentage: number
  currency: string
}

export interface OrderStatusAnalytics {
  dateRange: {
    from: string
    to: string
  }
  statusBreakdown: OrderStatusData[]
  totals: {
    totalOrders: number
    totalAmount: number
    currency: string
  }
}

/**
 * Get order status analytics from database
 */
export async function getOrderStatusBreakdown(
  fromDate: string,
  toDate: string
): Promise<OrderStatusAnalytics> {
  try {
    const supabase = await createClient()

    // Adjust toDate to include entire day
    const toDateEndOfDay = toDate.includes("T")
      ? toDate
      : `${toDate}T23:59:59.999Z`

    // Query orders by financial status with pagination
    const pageSize = 1000
    let page = 1
    let hasMore = true
    const allOrders: Array<{
      financial_status: string | null
      total_amount: number
      currency: string
    }> = []

    while (hasMore) {
      const { data: pageData, error: ordersError } = await supabase
        .from("orders")
        .select("financial_status, total_amount, currency")
        .gte("processed_at", fromDate)
        .lte("processed_at", toDateEndOfDay)
        .eq("test", false)
        .order("processed_at")
        .range((page - 1) * pageSize, page * pageSize - 1)

      if (ordersError) {
        console.error("Error fetching order status data:", ordersError)
        throw new Error(
          `Failed to fetch order status data: ${ordersError.message}`
        )
      }

      if (pageData && pageData.length > 0) {
        allOrders.push(...pageData)
        hasMore = pageData.length === pageSize
        page++
      } else {
        hasMore = false
      }
    }

    if (allOrders.length === 0) {
      return {
        dateRange: { from: fromDate, to: toDate },
        statusBreakdown: [],
        totals: {
          totalOrders: 0,
          totalAmount: 0,
          currency: "USD",
        },
      }
    }

    // Group by financial status
    const statusGroups = allOrders.reduce(
      (acc, order) => {
        const status = order.financial_status || "unknown"
        if (!acc[status]) {
          acc[status] = {
            count: 0,
            totalAmount: 0,
            currency: order.currency || "USD",
          }
        }
        acc[status].count += 1
        acc[status].totalAmount += Number(order.total_amount || 0)
        return acc
      },
      {} as Record<
        string,
        { count: number; totalAmount: number; currency: string }
      >
    )

    // Calculate totals
    const totalOrders = allOrders.length
    const totalAmount = allOrders.reduce(
      (sum, order) => sum + Number(order.total_amount || 0),
      0
    )
    const currency = allOrders[0]?.currency || "USD"

    // Create status breakdown with percentages
    const statusBreakdown: OrderStatusData[] = Object.entries(statusGroups).map(
      ([status, data]) => ({
        status:
          status.charAt(0).toUpperCase() + status.slice(1).replace("_", " "),
        count: data.count,
        totalAmount: data.totalAmount,
        percentage: (data.count / totalOrders) * 100,
        currency: data.currency,
      })
    )

    // Sort by count descending
    statusBreakdown.sort((a, b) => b.count - a.count)

    return {
      dateRange: { from: fromDate, to: toDate },
      statusBreakdown,
      totals: {
        totalOrders,
        totalAmount,
        currency,
      },
    }
  } catch (error) {
    console.error("Error in getOrderStatusBreakdown:", error)
    throw error
  }
}
