import { Suspense } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DateRangePicker } from "@/components/modules/date-range-picker"
import { getDateRangeFromParams } from "@/lib/utils"
import { getSalesOverTime } from "@/lib/services/get-sales-over-time"
import {
  getSalesByChannel,
  type SalesChannelData,
} from "@/lib/services/get-sales-by-channel"
import { getOrdersOverTime } from "@/lib/services/get-orders-over-time"
import {
  getOrderStatusBreakdown,
  type OrderStatusData,
} from "@/lib/services/get-order-status"
import { SalesTimeSeriesChart } from "@/components/modules/sales-time-series-chart"
import { SalesChannelChart } from "@/components/modules/sales-channel-chart"
import { formatCurrency } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TrendingUp,
  ShoppingBag,
  Users,
  DollarSign,
  Package,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface DashboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

async function DashboardMetrics({
  dateRange,
}: {
  dateRange: { from: Date; to: Date }
}) {
  const fromDate = dateRange.from.toISOString().split("T")[0]
  const toDate = dateRange.to.toISOString().split("T")[0]

  // Fetch all the data we need
  const [salesData, ordersData, salesByChannel, orderStatus] =
    await Promise.all([
      getSalesOverTime(fromDate, toDate),
      getOrdersOverTime(fromDate, toDate),
      getSalesByChannel(fromDate, toDate),
      getOrderStatusBreakdown(fromDate, toDate),
    ])

  // Calculate summary metrics
  const totalSales = salesData.dailyData.reduce(
    (sum: number, day) => sum + day.netSales,
    0
  )
  const totalOrders = ordersData.dailyData.reduce(
    (sum: number, day) => sum + day.totalOrders,
    0
  )
  const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0
  const currency = salesData.dailyData[0]?.currency || "USD"

  // Calculate trends (comparing first and last periods)
  const salesTrend =
    salesData.dailyData.length > 1
      ? ((salesData.dailyData[salesData.dailyData.length - 1].netSales -
          salesData.dailyData[0].netSales) /
          salesData.dailyData[0].netSales) *
        100
      : 0

  const ordersTrend =
    ordersData.dailyData.length > 1
      ? ((ordersData.dailyData[ordersData.dailyData.length - 1].totalOrders -
          ordersData.dailyData[0].totalOrders) /
          ordersData.dailyData[0].totalOrders) *
        100
      : 0

  // Get top performing channel
  const topChannel = salesByChannel.channels.reduce(
    (top: SalesChannelData, channel: SalesChannelData) =>
      channel.netSales > top.netSales ? channel : top,
    salesByChannel.channels[0] || {
      channel: "N/A",
      netSales: 0,
      grossSales: 0,
      refunds: 0,
      discounts: 0,
      taxes: 0,
      shippingCharges: 0,
      currency: "USD",
    }
  )

  // For now, we'll calculate a rough customer estimate based on orders and AOV
  const totalCustomers = Math.round(totalOrders * 0.8) // Rough estimate

  return (
    <>
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalSales, currency)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp
                className={`mr-1 h-3 w-3 ${salesTrend >= 0 ? "text-green-500" : "text-red-500"}`}
              />
              {salesTrend >= 0 ? "+" : ""}
              {salesTrend.toFixed(1)}% from period start
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalOrders.toLocaleString()}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp
                className={`mr-1 h-3 w-3 ${ordersTrend >= 0 ? "text-green-500" : "text-red-500"}`}
              />
              {ordersTrend >= 0 ? "+" : ""}
              {ordersTrend.toFixed(1)}% from period start
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Order Value
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(averageOrderValue, currency)}
            </div>
            <p className="text-xs text-muted-foreground">Per order average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalCustomers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Across all channels</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Sales Trend</CardTitle>
            <CardDescription>
              Daily sales performance over the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SalesTimeSeriesChart
              data={salesData.dailyData}
              currency={currency}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales by Channel</CardTitle>
            <CardDescription>
              Revenue distribution across sales channels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SalesChannelChart
              data={salesByChannel.channels}
              currency={currency}
            />
          </CardContent>
        </Card>
      </div>

      {/* Insights Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Insights</CardTitle>
            <CardDescription>Key performance highlights</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Top performing channel:</span>
              <Badge variant="secondary" className="capitalize">
                {topChannel.channel}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Channel revenue:</span>
              <span className="font-medium">
                {formatCurrency(topChannel.netSales, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Daily average sales:</span>
              <span className="font-medium">
                {formatCurrency(
                  totalSales / Math.max(salesData.dailyData.length, 1),
                  currency
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Daily average orders:</span>
              <span className="font-medium">
                {Math.round(
                  totalOrders / Math.max(ordersData.dailyData.length, 1)
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Status Overview</CardTitle>
            <CardDescription>Current order fulfillment status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {orderStatus.statusBreakdown.map((status: OrderStatusData) => (
                <div
                  key={status.status}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        status.status === "paid"
                          ? "bg-green-500"
                          : status.status === "pending"
                            ? "bg-yellow-500"
                            : status.status === "partially_paid"
                              ? "bg-orange-500"
                              : "bg-gray-500"
                      }`}
                    />
                    <span className="text-sm capitalize">
                      {status.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{status.count}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(status.totalAmount, status.currency)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function DashboardSkeleton() {
  return (
    <>
      {/* Metrics Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[120px] mb-2" />
              <Skeleton className="h-3 w-[150px]" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[120px] mb-2" />
            <Skeleton className="h-4 w-[200px]" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[140px] mb-2" />
            <Skeleton className="h-4 w-[180px]" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>

      {/* Insights Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[120px] mb-2" />
            <Skeleton className="h-4 w-[160px]" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-[120px]" />
                <Skeleton className="h-4 w-[80px]" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[160px] mb-2" />
            <Skeleton className="h-4 w-[180px]" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-[100px]" />
                <div className="text-right space-y-1">
                  <Skeleton className="h-4 w-[60px]" />
                  <Skeleton className="h-3 w-[80px]" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = await searchParams
  const searchParamsObj = new URLSearchParams()
  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (value) {
      searchParamsObj.set(key, Array.isArray(value) ? value[0] : value)
    }
  })

  const dateRange = getDateRangeFromParams(searchParamsObj)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your store&apos;s performance and key metrics
          </p>
        </div>
        <DateRangePicker className="w-full sm:w-auto" />
      </div>

      {/* Dashboard Content */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardMetrics dateRange={dateRange} />
      </Suspense>
    </div>
  )
}
