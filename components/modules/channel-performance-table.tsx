"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import type { ChannelPerformance } from "@/lib/services/get-channel-performance"

interface ChannelPerformanceTableProps {
  data: ChannelPerformance[]
}

export function ChannelPerformanceTable({
  data,
}: ChannelPerformanceTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        No channel performance data available
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Channel</TableHead>
            <TableHead className="text-right">Orders</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">AOV</TableHead>
            <TableHead className="text-right">Order Share</TableHead>
            <TableHead className="text-right">Revenue Share</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.channel}>
              <TableCell className="font-medium">
                <Badge variant="outline" className="capitalize">
                  {row.channel}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-medium">
                {row.orders.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(row.revenue, row.currency)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(row.averageOrderValue, row.currency)}
              </TableCell>
              <TableCell className="text-right">
                <Badge
                  variant={
                    row.orderShare >= 30
                      ? "default"
                      : row.orderShare >= 15
                        ? "secondary"
                        : "outline"
                  }
                  className="tabular-nums"
                >
                  {row.orderShare.toFixed(1)}%
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-sm font-medium tabular-nums">
                    {row.revenueShare.toFixed(1)}%
                  </span>
                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(row.revenueShare, 100)}%` }}
                    />
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
