import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DateRangePicker } from "@/components/modules/date-range-picker"
import { SalesTimeSeriesChart } from "@/components/modules/sales-time-series-chart"
import { getDateRangeFromParams, formatCurrency } from "@/lib/utils"
import { getSalesOverTime } from "@/lib/services/get-sales-over-time"
import { format, parseISO } from "date-fns"

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SalesOverTimePage({ searchParams }: PageProps) {
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

  // Fetch sales data
  let salesData = null
  let error = null

  try {
    salesData = await getSalesOverTime(fromDate, toDate)
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error"
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Over Time</h1>
          <p className="text-muted-foreground">
            Track sales performance trends over the selected time period
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            Showing data for:
          </span>
          <DateRangePicker />
          {salesData && (
            <span className="text-sm text-muted-foreground">
              ({format(parseISO(salesData.dateRange.from), "MMM dd")} -{" "}
              {format(parseISO(salesData.dateRange.to), "MMM dd, yyyy")})
            </span>
          )}
        </div>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Error Loading Data</CardTitle>
            <CardDescription>Unable to fetch sales data</CardDescription>
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
      ) : salesData ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Gross Sales</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    salesData.totals.grossSales,
                    salesData.totals.currency
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Refunds</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    salesData.totals.refunds,
                    salesData.totals.currency
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Net Sales</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    salesData.totals.netSales,
                    salesData.totals.currency
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Time Series Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Trends Over Time</CardTitle>
              <CardDescription>
                Daily sales performance showing net sales (solid), gross sales
                (dashed), and refunds (dotted)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SalesTimeSeriesChart
                data={salesData.dailyData}
                currency={salesData.totals.currency}
              />
            </CardContent>
          </Card>

          {/* Daily Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Sales Breakdown</CardTitle>
              <CardDescription>
                Detailed daily sales metrics for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Date</th>
                      <th className="text-right p-2">Gross Sales</th>
                      <th className="text-right p-2">Refunds</th>
                      <th className="text-right p-2">Net Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.dailyData.map((day) => (
                      <tr key={day.date} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          {format(parseISO(day.date), "MMM dd, yyyy")}
                        </td>
                        <td className="text-right p-2">
                          {formatCurrency(day.grossSales, day.currency)}
                        </td>
                        <td className="text-right p-2">
                          {formatCurrency(day.refunds, day.currency)}
                        </td>
                        <td className="text-right p-2">
                          {formatCurrency(day.netSales, day.currency)}
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
              No sales data found for the selected date range
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
