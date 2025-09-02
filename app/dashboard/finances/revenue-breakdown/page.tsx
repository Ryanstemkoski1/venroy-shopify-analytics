import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DateRangePicker } from "@/components/modules/date-range-picker"
import { getDateRangeFromParams, formatCurrency } from "@/lib/utils"
import { getRevenueBreakdown } from "@/lib/services/get-revenue-breakdown"
import { format } from "date-fns"

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function RevenueBreakdownPage({
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

  // Fetch revenue data
  let revenueData = null
  let error = null

  try {
    revenueData = await getRevenueBreakdown(fromDate, toDate)
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error"
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Revenue Breakdown
          </h1>
          <p className="text-muted-foreground">
            Detailed analysis of revenue components and financial performance
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
            <CardDescription>Unable to fetch revenue data</CardDescription>
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
      ) : revenueData ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Gross Revenue</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    revenueData.totals.grossRevenue,
                    revenueData.totals.currency
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Refunds</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(
                    revenueData.totals.refunds,
                    revenueData.totals.currency
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Net Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(
                    revenueData.totals.netRevenue,
                    revenueData.totals.currency
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Additional Revenue Components */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Taxes Collected</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    revenueData.totals.taxes,
                    revenueData.totals.currency
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Discounts Given</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(
                    revenueData.totals.discounts,
                    revenueData.totals.currency
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  Shipping Revenue
                </p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    revenueData.totals.shipping,
                    revenueData.totals.currency
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Component Breakdown</CardTitle>
              <CardDescription>
                Detailed breakdown of all revenue components and their impact
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Component</th>
                      <th className="text-right p-3">Amount</th>
                      <th className="text-right p-3">% of Gross</th>
                      <th className="text-right p-3">Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueData.breakdown.map((component) => (
                      <tr
                        key={component.category}
                        className="border-b hover:bg-gray-50"
                      >
                        <td className="p-3 font-medium">
                          {component.category}
                        </td>
                        <td
                          className={`text-right p-3 font-semibold ${
                            component.amount < 0
                              ? "text-red-600"
                              : component.category === "Net Revenue"
                                ? "text-green-600"
                                : "text-gray-900"
                          }`}
                        >
                          {formatCurrency(component.amount, component.currency)}
                        </td>
                        <td className="text-right p-3">
                          {component.percentage.toFixed(1)}%
                        </td>
                        <td className="text-right p-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              component.amount < 0
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {component.amount < 0 ? "Reduction" : "Addition"}
                          </span>
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
              No revenue data found for the selected date range
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Try selecting a different date range or ensure that transaction
              data has been synced for this period.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
