import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DateRangePicker } from "@/components/modules/date-range-picker"
import { OrderTimeSeriesChart } from "@/components/modules/order-time-series-chart"
import { getDateRangeFromParams, formatCurrency } from "@/lib/utils"
import { getOrdersOverTime } from "@/lib/services/get-orders-over-time"
import { format, parseISO } from "date-fns"

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function OrdersOverTimePage({ searchParams }: PageProps) {
  const params = await searchParams
  const urlSearchParams = new URLSearchParams()

  // Convert searchParams to URLSearchParams
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string") {
      urlSearchParams.set(key, value)
    }
  })

  const dateRange = getDateRangeFromParams(urlSearchParams)

  // Format dates for API (YYYY-MM-DD)
  const fromDate = format(dateRange.from, "yyyy-MM-dd")
  const toDate = format(dateRange.to, "yyyy-MM-dd")

  // Fetch orders data
  let orderData = null
  let error = null

  try {
    orderData = await getOrdersOverTime(fromDate, toDate)
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error"
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Orders Over Time
          </h1>
          <p className="text-muted-foreground">
            Track order volume trends and patterns over the selected time period
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            Showing data for:
          </span>
          <DateRangePicker />
        </div>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Error Loading Data</CardTitle>
            <CardDescription>Unable to fetch order data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600">
                <strong>Error:</strong> {error}
              </p>
              <p className="mt-2 text-xs text-red-500">
                Please check your data connection and try again.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : orderData ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">
                  {orderData.totals.totalOrders.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  Total Order Value
                </p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    orderData.totals.totalValue,
                    orderData.totals.currency
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  Average Order Value
                </p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    orderData.totals.averageOrderValue,
                    orderData.totals.currency
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Time Series Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Order Trends Over Time</CardTitle>
              <CardDescription>
                Daily order performance showing order count (solid), total value
                (dashed), and AOV (dotted)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrderTimeSeriesChart
                data={orderData.dailyData}
                currency={orderData.totals.currency}
              />
            </CardContent>
          </Card>

          {/* Daily Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Order Breakdown</CardTitle>
              <CardDescription>
                Detailed daily order metrics and performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Date</th>
                      <th className="text-right p-2">Orders</th>
                      <th className="text-right p-2">Total Value</th>
                      <th className="text-right p-2">AOV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderData.dailyData.map((day) => (
                      <tr key={day.date} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          {format(parseISO(day.date), "MMM dd, yyyy")}
                        </td>
                        <td className="text-right p-2">
                          {day.totalOrders.toLocaleString()}
                        </td>
                        <td className="text-right p-2">
                          {formatCurrency(day.totalValue, day.currency)}
                        </td>
                        <td className="text-right p-2">
                          {formatCurrency(day.averageOrderValue, day.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Data Available</CardTitle>
            <CardDescription>
              No order data found for the selected date range
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Try selecting a different date range or ensure that order data has
              been synced for this period.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
