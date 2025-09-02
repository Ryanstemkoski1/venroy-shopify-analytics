import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { SalesChannelData } from "@/lib/services/get-sales-by-channel"
import { formatChannelName, getCurrencySymbol } from "@/lib/utils"

interface SalesChannelTableProps {
  data: SalesChannelData[]
  currency: string
}

export function SalesChannelTable({ data, currency }: SalesChannelTableProps) {
  const currencySymbol = getCurrencySymbol(currency)

  const formatCurrency = (value: number) => {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  // Sort data by netSales descending
  const sortedData = [...data].sort((a, b) => b.netSales - a.netSales)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border">
        <p className="text-muted-foreground">
          No sales data available for the selected date range
        </p>
      </div>
    )
  }

  return (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-bold text-gray-700">
              Sales Channel
            </TableHead>
            <TableHead className="text-right font-bold text-blue-600">
              Gross Sales ({currencySymbol})
            </TableHead>
            <TableHead className="text-right text-red-600">
              Refunds ({currencySymbol})
            </TableHead>
            <TableHead className="text-right font-bold text-green-600">
              Net Sales ({currencySymbol})
            </TableHead>
            <TableHead className="text-right text-orange-600">
              Discounts ({currencySymbol})
            </TableHead>
            <TableHead className="text-right text-purple-600">
              Taxes ({currencySymbol})
            </TableHead>
            <TableHead className="text-right text-cyan-600">
              Shipping ({currencySymbol})
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((channel, index) => (
            <TableRow key={index} className="hover:bg-gray-50">
              <TableCell className="font-medium text-gray-700">
                {formatChannelName(channel.channel)}
              </TableCell>
              <TableCell className="text-right font-semibold text-blue-600">
                {formatCurrency(channel.grossSales)}
              </TableCell>
              <TableCell className="text-right text-red-600">
                {formatCurrency(channel.refunds)}
              </TableCell>
              <TableCell className="text-right font-semibold text-green-600">
                {formatCurrency(channel.netSales)}
              </TableCell>
              <TableCell className="text-right text-orange-600">
                {formatCurrency(channel.discounts)}
              </TableCell>
              <TableCell className="text-right text-purple-600">
                {formatCurrency(channel.taxes)}
              </TableCell>
              <TableCell className="text-right text-cyan-600">
                {formatCurrency(channel.shippingCharges)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
