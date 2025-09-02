import { Suspense } from "react"
import { DateRangePicker } from "@/components/modules/date-range-picker"
import { TransactionTable } from "@/components/modules/transaction-table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getTransactionAnalysis } from "@/lib/services/get-transaction-analysis"
import { formatCurrency } from "@/lib/utils"

interface TransactionsPageProps {
  searchParams: Promise<{
    from?: string
    to?: string
  }>
}

async function TransactionAnalytics({
  from,
  to,
}: {
  from: string
  to: string
}) {
  const data = await getTransactionAnalysis(from, to)

  return (
    <>
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Transactions
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              Total
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.totals.totalTransactions.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.totals.successfulTransactions.toLocaleString()} successful,{" "}
              {data.totals.failedTransactions.toLocaleString()} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Badge
              variant={
                data.totals.successRate >= 95
                  ? "default"
                  : data.totals.successRate >= 85
                    ? "secondary"
                    : "destructive"
              }
              className="text-xs"
            >
              Rate
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.totals.successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Overall transaction success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <Badge variant="outline" className="text-xs">
              Volume
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.totals.totalAmount, data.totals.currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total successful transaction volume
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Amount
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              Avg
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                data.totals.averageTransactionAmount,
                data.totals.currency
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Average successful transaction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Types Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Types Breakdown</CardTitle>
          <CardDescription>
            Analysis of transaction types, success rates, and amounts for{" "}
            {data.dateRange.from} to {data.dateRange.to}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionTable data={data.byType} />
        </CardContent>
      </Card>
    </>
  )
}

function TransactionAnalyticsLoading() {
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
          <Skeleton className="h-6 w-[240px] mb-2" />
          <Skeleton className="h-4 w-[320px]" />
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

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
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
        <h2 className="text-3xl font-bold tracking-tight">Transactions</h2>
        <DateRangePicker />
      </div>

      <Suspense fallback={<TransactionAnalyticsLoading />}>
        <TransactionAnalytics from={from} to={to} />
      </Suspense>
    </div>
  )
}
