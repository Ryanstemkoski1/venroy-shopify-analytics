import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DateRangePicker } from "@/components/modules/date-range-picker"
import { SalesChannelChart } from "@/components/modules/sales-channel-chart"
import { SalesChannelTable } from "@/components/modules/sales-channel-table"
import { getDateRangeFromParams, formatCurrency } from "@/lib/utils"
import { getSalesByChannel } from "@/lib/services/get-sales-by-channel"
import { format } from "date-fns"
import { IndividualOrdersSection } from "@/components/modules/individual-orders-section"

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function NetSalesByChannelPage({
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

  // Format dates for Shopify API (YYYY-MM-DD)
  const fromDate = format(dateRange.from, "yyyy-MM-dd")
  const toDate = format(dateRange.to, "yyyy-MM-dd")

  // Fetch sales data
  let salesData = null
  let error = null

  try {
    salesData = await getSalesByChannel(fromDate, toDate)
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error"
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Net Sales by Channel
          </h1>
          <p className="text-muted-foreground">
            View net sales performance across different sales channels
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
            <CardDescription>
              Unable to fetch sales data from Shopify
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600">
                <strong>Error:</strong> {error}
              </p>
              <p className="mt-2 text-xs text-red-500">
                Please check your Shopify API credentials and try again.
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
                <p className="text-xs text-muted-foreground">Total Net Sales</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    salesData.totals.netSales,
                    salesData.totals.currency
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sales Channel Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Net Sales by Channel</CardTitle>
              <CardDescription>
                Horizontal bar chart showing net sales performance across
                different sales channels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SalesChannelChart
                data={salesData.channels}
                currency={salesData.totals.currency}
              />
            </CardContent>
          </Card>

          {/* Sales Channel Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Sales Metrics by Channel</CardTitle>
              <CardDescription>
                Comprehensive breakdown of sales, returns, discounts, taxes, and
                shipping charges by channel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SalesChannelTable
                data={salesData.channels}
                currency={salesData.totals.currency}
              />
            </CardContent>
          </Card>

          {/* Individual Orders Section */}
          <IndividualOrdersSection dateRange={dateRange} />
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
