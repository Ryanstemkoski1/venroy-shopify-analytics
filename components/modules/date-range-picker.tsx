"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
} from "date-fns"
import { DateRange } from "react-day-picker"
import { useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  className?: string
}

export function DateRangePicker({ className }: DateRangePickerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const fromParam = searchParams.get("from")
  const toParam = searchParams.get("to")

  const defaultFrom = new Date()
  defaultFrom.setDate(defaultFrom.getDate() - 6)
  defaultFrom.setHours(0, 0, 0, 0)

  const defaultTo = new Date()
  defaultTo.setHours(23, 59, 59, 999)

  const initialFrom = fromParam ? new Date(fromParam) : defaultFrom
  const initialTo = toParam ? new Date(toParam) : defaultTo

  const [date, setDate] = React.useState<DateRange | undefined>({
    from: initialFrom,
    to: initialTo,
  })

  const [isOpen, setIsOpen] = React.useState(false)

  // Date range presets
  const presets = [
    {
      label: "Today",
      dateRange: { from: startOfDay(new Date()), to: endOfDay(new Date()) },
    },
    {
      label: "Yesterday",
      dateRange: {
        from: startOfDay(subDays(new Date(), 1)),
        to: endOfDay(subDays(new Date(), 1)),
      },
    },
    {
      label: "Last 7 days",
      dateRange: {
        from: startOfDay(subDays(new Date(), 6)),
        to: endOfDay(new Date()),
      },
    },
    {
      label: "Last 30 days",
      dateRange: {
        from: startOfDay(subDays(new Date(), 29)),
        to: endOfDay(new Date()),
      },
    },
    {
      label: "This week",
      dateRange: {
        from: startOfWeek(new Date(), { weekStartsOn: 1 }),
        to: endOfWeek(new Date(), { weekStartsOn: 1 }),
      },
    },
    {
      label: "Last week",
      dateRange: {
        from: startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }),
        to: endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }),
      },
    },
    {
      label: "This month",
      dateRange: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
    },
    {
      label: "Last month",
      dateRange: {
        from: startOfMonth(subMonths(new Date(), 1)),
        to: endOfMonth(subMonths(new Date(), 1)),
      },
    },
  ]

  const handlePresetSelect = (preset: { from: Date; to: Date }) => {
    setDate(preset)
  }

  const updateUrlParams = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      const params = new URLSearchParams(searchParams)
      params.set("from", format(range.from, "yyyy-MM-dd"))
      params.set("to", format(range.to, "yyyy-MM-dd"))
      router.push(`?${params.toString()}`)
    }
  }

  const handleSelect = (range: DateRange | undefined) => {
    setDate(range)
  }

  const handleSetDate = () => {
    if (date?.from && date?.to) {
      updateUrlParams(date)
      setIsOpen(false)
    }
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {/* Preset sidebar */}
            <div className="flex flex-col border-r p-3 min-w-[160px]">
              <div className="text-sm font-medium mb-2">Quick select</div>
              <div className="flex flex-col gap-1">
                {presets.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className="justify-start h-auto p-2 text-left"
                    onClick={() => handlePresetSelect(preset.dateRange)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Calendar section */}
            <div className="p-3">
              <Calendar
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={handleSelect}
                numberOfMonths={2}
              />
              <div className="flex justify-end pt-3 border-t">
                <Button
                  size="sm"
                  onClick={handleSetDate}
                  disabled={!date?.from || !date?.to}
                >
                  Set
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
