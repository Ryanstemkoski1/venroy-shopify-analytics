"use client"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import type { SalesChannelData } from "@/lib/services/get-sales-by-channel"
import { formatChannelName, formatCurrency } from "@/lib/utils"

interface SalesChannelChartProps {
  data: SalesChannelData[]
  currency: string
}

const chartConfig = {
  netSales: {
    label: "Net Sales",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function SalesChannelChart({ data, currency }: SalesChannelChartProps) {
  // Sort data by netSales descending for better visualization
  const sortedData = [...data].sort((a, b) => b.netSales - a.netSales)

  const chartData = sortedData.map((channel, index) => ({
    channel: formatChannelName(channel.channel),
    netSales: channel.netSales,
    fill: `var(--chart-${index + 1})`,
  }))

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-muted-foreground">
          No sales data available for the selected date range
        </p>
      </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-[360px] w-full">
      <BarChart
        layout="vertical"
        accessibilityLayer
        data={chartData}
        height={360}
        barGap={30}
      >
        <CartesianGrid horizontal={false} />
        <XAxis
          type="number"
          dataKey="netSales"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => `${value.toLocaleString()}`}
          domain={["dataMin", "dataMax"]}
        />
        <YAxis
          dataKey="channel"
          type="category"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          width={70}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value) => [
                `${formatCurrency(Number(value), currency)} Net Sales`,
                "",
              ]}
            />
          }
        />
        <Bar dataKey="netSales" barSize={30} />
      </BarChart>
    </ChartContainer>
  )
}
