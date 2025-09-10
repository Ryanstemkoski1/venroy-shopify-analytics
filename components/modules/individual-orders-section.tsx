"use client"

import { useState, useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { Package, Download, ChevronLeft, ChevronRight } from "lucide-react"
import { type IndividualOrdersResponse } from "@/lib/services/get-individual-orders"
import {
  fetchIndividualOrdersAction,
  exportOrdersAction,
} from "@/lib/actions/individual-orders-actions"
import { format } from "date-fns"

interface IndividualOrdersSectionProps {
  dateRange: { from: Date; to: Date }
}

export function IndividualOrdersSection({
  dateRange,
}: IndividualOrdersSectionProps) {
  const [data, setData] = useState<IndividualOrdersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [isExporting, setIsExporting] = useState(false)

  const fromDate = format(dateRange.from, "yyyy-MM-dd")
  const toDate = format(dateRange.to, "yyyy-MM-dd")

  // Fetch data using server action
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const result = await fetchIndividualOrdersAction(
          fromDate,
          toDate,
          currentPage,
          50
        )

        if (result.success && result.data) {
          setData(result.data)
        } else {
          setError(result.error || "Failed to fetch orders")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [fromDate, toDate, currentPage])

  // Export functionality using server action
  const handleExport = async () => {
    try {
      setIsExporting(true)

      const result = await exportOrdersAction(fromDate, toDate)

      if (result.success && result.csvContent && result.filename) {
        // Create download
        const blob = new Blob([result.csvContent], { type: "text/csv" })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = result.filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      } else {
        alert(`Export failed: ${result.error}`)
      }
    } catch (error) {
      console.error("Export failed:", error)
      alert("Failed to export data. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  const getStatusBadge = (status: string | null) => {
    const colorMap: Record<string, string> = {
      paid: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      refunded: "bg-red-100 text-red-800",
      partially_refunded: "bg-orange-100 text-orange-800",
      authorized: "bg-blue-100 text-blue-800",
      voided: "bg-gray-100 text-gray-800",
    }

    const color = status
      ? colorMap[status.toLowerCase()] || "bg-gray-100 text-gray-800"
      : "bg-gray-100 text-gray-800"

    return (
      <Badge variant="secondary" className={color}>
        {status || "Unknown"}
      </Badge>
    )
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-12 bg-gray-100 rounded animate-pulse"
            ></div>
          ))}
        </div>
      )
    }

    if (error) {
      return (
        <div className="text-center py-8">
          <p className="text-red-600">Error loading orders: {error}</p>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      )
    }

    if (!data || data.orders.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No orders found for the selected date range.
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Summary and Export */}
        <div className="flex justify-between items-start gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-blue-600 font-medium">Total Orders</p>
              <p className="text-lg font-bold text-blue-900">
                {data.summary?.totalOrders || 0}
              </p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-xs text-green-600 font-medium">Total Sales</p>
              <p className="text-lg font-bold text-green-900">
                {data.summary?.totalSales
                  ? formatCurrency(
                      data.summary.totalSales,
                      data.summary.currency || "USD"
                    )
                  : "$0.00"}
              </p>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <p className="text-xs text-red-600 font-medium">Total Refunds</p>
              <p className="text-lg font-bold text-red-900">
                {data.summary?.totalRefunds
                  ? formatCurrency(
                      data.summary.totalRefunds,
                      data.summary.currency || "USD"
                    )
                  : "$0.00"}
              </p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <p className="text-xs text-purple-600 font-medium">Net Amount</p>
              <p className="text-lg font-bold text-purple-900">
                {data.summary?.totalNet
                  ? formatCurrency(
                      data.summary.totalNet,
                      data.summary.currency || "USD"
                    )
                  : "$0.00"}
              </p>
            </div>
          </div>

          <Button
            onClick={handleExport}
            disabled={isExporting}
            variant="outline"
            className="shrink-0"
          >
            {isExporting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                <span className="ml-2">Exporting...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </>
            )}
          </Button>
        </div>

        {/* Orders Table */}
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total Sales</TableHead>
                <TableHead className="text-right">Net Amount</TableHead>
                <TableHead className="text-center">Transactions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    <div>
                      <p className="font-semibold">{order.name}</p>
                      <p className="text-sm text-gray-500">
                        {order.shopify_order_id.slice(-8)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p>
                        {new Date(
                          order.processed_at || order.created_at
                        ).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(
                          order.processed_at || order.created_at
                        ).toLocaleTimeString()}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {order.channel_display_name ||
                          order.source_name ||
                          "Unknown"}
                      </p>
                      {order.channel_id && (
                        <p className="text-xs text-gray-500">
                          ID: {order.channel_id}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(order.financial_status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div>
                      <p className="font-semibold">
                        {formatCurrency(order.total_sales, order.currency)}
                      </p>
                      {order.total_refunds > 0 && (
                        <p className="text-sm text-red-600">
                          -{formatCurrency(order.total_refunds, order.currency)}{" "}
                          refunded
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(order.net_amount, order.currency)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{order.transaction_count}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing{" "}
              {(data.pagination.page - 1) * data.pagination.pageSize + 1} to{" "}
              {Math.min(
                data.pagination.page * data.pagination.pageSize,
                data.pagination.totalCount
              )}{" "}
              of {data.pagination.totalCount} orders
            </p>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(data.pagination.page - 1)}
                disabled={data.pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(data.pagination.page + 1)}
                disabled={data.pagination.page >= data.pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Individual Orders
        </CardTitle>
        <CardDescription>
          View individual order records for troubleshooting data discrepancies
        </CardDescription>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  )
}
