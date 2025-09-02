/**
 * Channel Performance Service
 * Analyzes    // Query all orders with paginationmer acquisition channels and their performance metrics
 */

import { createClient } from "../supabase/server"

export interface ChannelPerformance {
  channel: string
  orders: number
  revenue: number
  averageOrderValue: number
  orderShare: number
  revenueShare: number
  currency: string
}

export interface CustomerAcquisition {
  dateRange: {
    from: string
    to: string
  }
  channels: ChannelPerformance[]
  totals: {
    totalOrders: number
    totalRevenue: number
    averageOrderValue: number
    currency: string
  }
}

/**
 * Get channel performance analysis from database
 * Analyzes customer acquisition channels and their effectiveness
 */
export async function getChannelPerformance(
  fromDate: string,
  toDate: string
): Promise<CustomerAcquisition> {
  try {
    const supabase = await createClient()

    // Ensure we're querying with proper UTC timestamps
    const fromDateUTC = fromDate.includes("T")
      ? fromDate
      : `${fromDate}T00:00:00.000Z`
    const toDateUTC = toDate.includes("T") ? toDate : `${toDate}T23:59:59.999Z`

    console.log("📊 Fetching channel performance for date range:", {
      from: fromDateUTC,
      to: toDateUTC,
    })

    // Query orders with pagination
    const pageSize = 1000
    let page = 1
    let hasMore = true
    const allOrders: Array<{
      total_amount: number
      source_name: string | null
      currency: string
      created_at: string
    }> = []

    while (hasMore) {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const { data: orders, error } = await supabase
        .from("orders")
        .select("total_amount, source_name, currency, created_at")
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
    }

    if (allOrders.length === 0) {
      return {
        dateRange: { from: fromDate, to: toDate },
        channels: [],
        totals: {
          totalOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0,
          currency: "USD",
        },
      }
    }

    // Group orders by channel
    const channelGroups = new Map<
      string,
      {
        orders: typeof allOrders
        revenue: number
      }
    >()

    allOrders.forEach((order) => {
      const channel = order.source_name || "Direct"

      if (!channelGroups.has(channel)) {
        channelGroups.set(channel, {
          orders: [],
          revenue: 0,
        })
      }

      const group = channelGroups.get(channel)!
      group.orders.push(order)
      group.revenue += order.total_amount
    })

    // Calculate totals
    const totalOrders = allOrders.length
    const totalRevenue = allOrders.reduce(
      (sum, order) => sum + order.total_amount,
      0
    )
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
    const currency = allOrders[0]?.currency || "USD"

    // Calculate channel performance
    const channels: ChannelPerformance[] = Array.from(channelGroups.entries())
      .map(([channel, group]) => ({
        channel,
        orders: group.orders.length,
        revenue: group.revenue,
        averageOrderValue:
          group.orders.length > 0 ? group.revenue / group.orders.length : 0,
        orderShare:
          totalOrders > 0 ? (group.orders.length / totalOrders) * 100 : 0,
        revenueShare:
          totalRevenue > 0 ? (group.revenue / totalRevenue) * 100 : 0,
        currency,
      }))
      .sort((a, b) => b.revenue - a.revenue) // Sort by revenue descending

    return {
      dateRange: { from: fromDate, to: toDate },
      channels,
      totals: {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        currency,
      },
    }
  } catch (error) {
    console.error("Error in getChannelPerformance:", error)
    throw error
  }
}
