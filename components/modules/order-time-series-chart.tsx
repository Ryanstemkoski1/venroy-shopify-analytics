"use client"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import type { DailyOrderData } from "@/lib/services/get-orders-over-time"
import { format, parseISO } from "date-fns"
import { formatCurrency } from "@/lib/utils"

interface OrderTimeSeriesChartProps {
  data: DailyOrderData[]
  currency: string
}

const chartConfig = {
  totalOrders: {
    label: "Orders",
    color: "var(--chart-1)",
  },
  totalValue: {
    label: "Order Value",
    color: "var(--chart-2)",
  },
  averageOrderValue: {
    label: "AOV",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

export function OrderTimeSeriesChart({
  data,
  currency,
}: OrderTimeSeriesChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No order data available for the selected date range
      </div>
    )
  }

  const chartData = data.map((day) => ({
    date: format(parseISO(day.date), "MMM dd"),
    fullDate: day.date,
    totalOrders: day.totalOrders,
    totalValue: day.totalValue,
    averageOrderValue: day.averageOrderValue,
  }))

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            className="text-muted-foreground"
            tick={{ fontSize: 12 }}
          />
          <YAxis className="text-muted-foreground" tick={{ fontSize: 12 }} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => {
                  if (name === "totalOrders") {
                    return [`${value} orders`, "Orders"]
                  }
                  return [
                    formatCurrency(Number(value), currency),
                    chartConfig[name as keyof typeof chartConfig]?.label ||
                      name,
                  ]
                }}
                labelFormatter={(_, payload) => {
                  if (payload?.[0]) {
                    return format(parseISO(payload[0].payload.fullDate), "PPP")
                  }
                  return ""
                }}
              />
            }
          />
          <Line
            type="monotone"
            dataKey="totalOrders"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            dot={{ r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="totalValue"
            stroke="var(--chart-2)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="averageOrderValue"
            stroke="var(--chart-3)"
            strokeWidth={2}
            strokeDasharray="3 3"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
