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
import { format, parseISO } from "date-fns"
import { formatCurrency } from "@/lib/utils"

interface TimeSeriesData {
  date: string
  [key: string]: string | number
}

interface TimeSeriesChartProps {
  data: TimeSeriesData[]
  currency?: string
  dataKey: string
  label: string
  color?: string
  formatValue?: (value: number) => string
}

export function TimeSeriesChart({
  data,
  currency = "USD",
  dataKey,
  label,
  color = "var(--chart-1)",
  formatValue,
}: TimeSeriesChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No data available for the selected date range
      </div>
    )
  }

  const chartConfig: ChartConfig = {
    [dataKey]: {
      label,
      color,
    },
  }

  const defaultFormatValue = (value: number) => {
    if (formatValue) return formatValue(value)
    return typeof value === "number" && currency
      ? formatCurrency(value, currency)
      : value.toLocaleString()
  }

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => {
              try {
                const date = parseISO(value)
                return format(date, "MMM dd")
              } catch {
                return value
              }
            }}
            className="text-muted-foreground"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(value) => {
              if (typeof value === "number") {
                if (currency) {
                  return formatCurrency(value, currency)
                }
                return value.toLocaleString()
              }
              return value
            }}
            className="text-muted-foreground"
            tick={{ fontSize: 12 }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => [
                  defaultFormatValue(value as number),
                  label,
                ]}
                labelFormatter={(value) => {
                  try {
                    const date = parseISO(value as string)
                    return format(date, "EEEE, MMMM do, yyyy")
                  } catch {
                    return value
                  }
                }}
              />
            }
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2.5}
            dot={{ fill: color, strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
