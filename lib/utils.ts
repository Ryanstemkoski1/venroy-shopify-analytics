import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isValid } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface DateRange {
  from: Date
  to: Date
}

export function getDateRangeFromParams(
  searchParams: URLSearchParams
): DateRange {
  const fromParam = searchParams.get("from")
  const toParam = searchParams.get("to")

  // Default to last 7 days (including today)
  const defaultFrom = new Date()
  defaultFrom.setDate(defaultFrom.getDate() - 6)
  defaultFrom.setHours(0, 0, 0, 0)

  const defaultTo = new Date()
  defaultTo.setHours(23, 59, 59, 999)

  let from = defaultFrom
  let to = defaultTo

  // Parse from parameter
  if (fromParam) {
    try {
      // Parse as local date to avoid timezone issues
      const parsedFrom = new Date(fromParam + "T00:00:00")
      if (isValid(parsedFrom)) {
        from = parsedFrom
        from.setHours(0, 0, 0, 0)
      }
    } catch {
      // Invalid date, use default
    }
  }

  // Parse to parameter
  if (toParam) {
    try {
      // Parse as local date to avoid timezone issues
      const parsedTo = new Date(toParam + "T23:59:59")
      if (isValid(parsedTo)) {
        to = parsedTo
        to.setHours(23, 59, 59, 999)
      }
    } catch {
      // Invalid date, use default
    }
  }

  return { from, to }
}

export function formatDateRange(dateRange: DateRange): string {
  return `${format(dateRange.from, "LLL dd, yyyy")} - ${format(dateRange.to, "LLL dd, yyyy")}`
}

export function formatDateForApi(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export function formatDateTimeForApi(date: Date): string {
  return date.toISOString()
}

export function formatChannelName(channel: string): string {
  // Since we now use channelInformation.displayName, this function
  // mainly handles fallback cases and basic formatting
  if (!channel || channel.trim() === "") {
    return "Unknown"
  }

  // Handle specific legacy cases that might still come through
  switch (channel.toLowerCase()) {
    case "pos":
      return "POS"
    case "web":
      return "Online Store"
    case "shopify_draft_order":
      return "Draft Order"
    default:
      // For properly formatted display names, return as-is
      // For raw identifiers, capitalize first letter
      return channel.charAt(0).toUpperCase() + channel.slice(1)
  }
}

/**
 * Get currency symbol from currency code
 */
export function getCurrencySymbol(currencyCode: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    AUD: "A$",
    CAD: "C$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CHF: "CHF",
    CNY: "¥",
    INR: "₹",
    NZD: "NZ$",
    SGD: "S$",
    HKD: "HK$",
    SEK: "kr",
    NOK: "kr",
    DKK: "kr",
    PLN: "zł",
    CZK: "Kč",
    HUF: "Ft",
    RON: "lei",
    BGN: "лв",
    HRK: "kn",
    RUB: "₽",
    BRL: "R$",
    MXN: "$",
    CLP: "$",
    COP: "$",
    PEN: "S/",
    ARS: "$",
    UYU: "$",
    ZAR: "R",
    THB: "฿",
    MYR: "RM",
    IDR: "Rp",
    PHP: "₱",
    VND: "₫",
    KRW: "₩",
    TWD: "NT$",
  }

  return symbols[currencyCode.toUpperCase()] || currencyCode
}

/**
 * Format currency amount with symbol
 */
export function formatCurrency(amount: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode)
  const formattedAmount = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${symbol}${formattedAmount}`
}
