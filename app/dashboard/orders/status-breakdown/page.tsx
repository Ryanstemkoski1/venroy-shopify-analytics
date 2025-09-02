import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DateRangePicker } from "@/components/modules/date-range-picker"
import { getDateRangeFromParams, formatCurrency } from "@/lib/utils"
import { getOrderStatusBreakdown } from "@/lib/services/get-order-status"
import { format } from "date-fns"

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function OrderStatusBreakdownPage({
  searchParams,
}: PageProps) {
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

  // Fetch order status data
  let orderData = null
  let error = null

  try {
    orderData = await getOrderStatusBreakdown(fromDate, toDate)
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error"
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Order Status Breakdown
          </h1>
          <p className="text-muted-foreground">
            Analyze order distribution by financial status and processing state
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
            <CardDescription>Unable to fetch order status data</CardDescription>
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
                <p className="text-xs text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    orderData.totals.totalAmount,
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
                    orderData.totals.totalAmount / orderData.totals.totalOrders,
                    orderData.totals.currency
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Status Breakdown Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Order Status Distribution</CardTitle>
              <CardDescription>
                Visual breakdown of orders by financial status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orderData.statusBreakdown.map((status, index) => (
                  <div
                    key={status.status}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: `var(--chart-${index + 1})` }}
                      />
                      <span className="font-medium">{status.status}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {status.count} orders ({status.percentage.toFixed(1)}%)
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(status.totalAmount, status.currency)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Status Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Status Breakdown</CardTitle>
              <CardDescription>
                Complete breakdown of order statuses with metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Status</th>
                      <th className="text-right p-3">Order Count</th>
                      <th className="text-right p-3">Percentage</th>
                      <th className="text-right p-3">Total Value</th>
                      <th className="text-right p-3">Avg Order Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderData.statusBreakdown.map((status) => (
                      <tr
                        key={status.status}
                        className="border-b hover:bg-gray-50"
                      >
                        <td className="p-3 font-medium">{status.status}</td>
                        <td className="text-right p-3">
                          {status.count.toLocaleString()}
                        </td>
                        <td className="text-right p-3">
                          {status.percentage.toFixed(1)}%
                        </td>
                        <td className="text-right p-3">
                          {formatCurrency(status.totalAmount, status.currency)}
                        </td>
                        <td className="text-right p-3">
                          {formatCurrency(
                            status.totalAmount / status.count,
                            status.currency
                          )}
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
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">
                Try selecting a different date range
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
