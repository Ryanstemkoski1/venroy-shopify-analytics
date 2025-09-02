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
import type { TransactionTypeData } from "@/lib/services/get-transaction-analysis"

interface TransactionTableProps {
  data: TransactionTypeData[]
}

export function TransactionTable({ data }: TransactionTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        No transaction data available
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Type</TableHead>
            <TableHead className="text-right">Count</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
            <TableHead className="text-right">Average Amount</TableHead>
            <TableHead className="text-right">Success Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.kind}>
              <TableCell className="font-medium">
                <Badge variant="outline" className="capitalize">
                  {row.kind.replace("_", " ")}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-medium">
                {row.count.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(row.totalAmount, row.currency)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(row.averageAmount, row.currency)}
              </TableCell>
              <TableCell className="text-right">
                <Badge
                  variant={
                    row.successRate >= 95
                      ? "default"
                      : row.successRate >= 85
                        ? "secondary"
                        : "destructive"
                  }
                  className="tabular-nums"
                >
                  {row.successRate.toFixed(1)}%
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
