import { Suspense } from "react"
import { DateRangePicker } from "@/components/modules/date-range-picker"
import { ChannelPerformanceTable } from "@/components/modules/channel-performance-table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getChannelPerformance } from "@/lib/services/get-channel-performance"
import { formatCurrency } from "@/lib/utils"

interface ChannelPerformancePageProps {
  searchParams: Promise<{
    from?: string
    to?: string
  }>
}

async function ChannelPerformanceAnalytics({
  from,
  to,
}: {
  from: string
  to: string
}) {
  const data = await getChannelPerformance(from, to)

  return (
    <>
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Badge variant="outline" className="text-xs">
              Orders
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.totals.totalOrders.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {data.channels.length} channels
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <Badge variant="outline" className="text-xs">
              Revenue
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.totals.totalRevenue, data.totals.currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              From {data.totals.totalOrders.toLocaleString()} orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Order Value
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              AOV
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                data.totals.averageOrderValue,
                data.totals.currency
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Average across all channels
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Channels
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              Channels
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.channels.length}</div>
            <p className="text-xs text-muted-foreground">
              Sales channels with orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Channel Performance Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Channel Performance Analysis</CardTitle>
          <CardDescription>
            Channel performance and revenue distribution by traffic source for{" "}
            {data.dateRange.from} to {data.dateRange.to}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChannelPerformanceTable data={data.channels} />
        </CardContent>
      </Card>
    </>
  )
}

function ChannelPerformanceAnalyticsLoading() {
  return (
    <>
      {/* Summary Cards Skeletons */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[120px]" />
              <Skeleton className="h-5 w-[60px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[100px] mb-2" />
              <Skeleton className="h-3 w-[160px]" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[280px] mb-2" />
          <Skeleton className="h-4 w-[360px]" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

export default async function ChannelPerformancePage({
  searchParams,
}: ChannelPerformancePageProps) {
  // Default to last 30 days
  const defaultTo = new Date()
  const defaultFrom = new Date()
  defaultFrom.setDate(defaultTo.getDate() - 29)

  const params = await searchParams
  const from = params.from || defaultFrom.toISOString().split("T")[0]
  const to = params.to || defaultTo.toISOString().split("T")[0]

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Channel Performance
        </h2>
        <DateRangePicker />
      </div>

      <Suspense fallback={<ChannelPerformanceAnalyticsLoading />}>
        <ChannelPerformanceAnalytics from={from} to={to} />
      </Suspense>
    </div>
  )
}
