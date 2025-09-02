/**
 * Transaction Analysis Service
 * Analyzes transaction patterns, volumes, and success rates
 */

import { createClient } from "../supabase/server"

export interface TransactionTypeData {
  kind: string
  count: number
  totalAmount: number
  averageAmount: number
  successRate: number
  currency: string
}

export interface TransactionAnalytics {
  dateRange: {
    from: string
    to: string
  }
  byType: TransactionTypeData[]
  totals: {
    totalTransactions: number
    successfulTransactions: number
    failedTransactions: number
    totalAmount: number
    averageTransactionAmount: number
    successRate: number
    currency: string
  }
}

/**
 * Get transaction analysis from database
 * Analyzes all transaction types, success rates, and patterns
 */
export async function getTransactionAnalysis(
  fromDate: string,
  toDate: string
): Promise<TransactionAnalytics> {
  try {
    const supabase = await createClient()

    // Ensure we're querying with proper UTC timestamps
    const fromDateUTC = fromDate.includes("T")
      ? fromDate
      : `${fromDate}T00:00:00.000Z`
    const toDateUTC = toDate.includes("T") ? toDate : `${toDate}T23:59:59.999Z`

    // Query all transactions with pagination
    const pageSize = 1000
    let page = 1
    let hasMore = true
    const allTransactions: Array<{
      amount: number
      kind: string | null
      status: string | null
      currency: string
      gateway: string | null
      processed_at: string
    }> = []

    while (hasMore) {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("amount, kind, status, currency, gateway, processed_at")
        .gte("processed_at", fromDateUTC)
        .lte("processed_at", toDateUTC)
        .range(from, to)
        .order("processed_at", { ascending: true })

      if (error) {
        console.error("❌ Database error fetching transactions:", error)
        throw new Error(`Database error: ${error.message}`)
      }

      if (!transactions || transactions.length === 0) {
        hasMore = false
        break
      }

      allTransactions.push(...transactions)
      hasMore = transactions.length === pageSize
      page++
    }

    if (allTransactions.length === 0) {
      return {
        dateRange: { from: fromDate, to: toDate },
        byType: [],
        totals: {
          totalTransactions: 0,
          successfulTransactions: 0,
          failedTransactions: 0,
          totalAmount: 0,
          averageTransactionAmount: 0,
          successRate: 0,
          currency: "USD",
        },
      }
    }

    // Group transactions by type (kind)
    const transactionGroups = new Map<
      string,
      {
        transactions: typeof allTransactions
        totalAmount: number
        successfulCount: number
        currency: string
      }
    >()

    allTransactions.forEach((transaction) => {
      const kind = transaction.kind || "Unknown"
      const isSuccessful = transaction.status?.toLowerCase() === "success"

      if (!transactionGroups.has(kind)) {
        transactionGroups.set(kind, {
          transactions: [],
          totalAmount: 0,
          successfulCount: 0,
          currency: transaction.currency || "USD",
        })
      }

      const group = transactionGroups.get(kind)!
      group.transactions.push(transaction)

      if (isSuccessful) {
        group.totalAmount += transaction.amount
        group.successfulCount += 1
      }
    })

    // Calculate by-type statistics
    const byType: TransactionTypeData[] = Array.from(
      transactionGroups.entries()
    )
      .map(([kind, group]) => ({
        kind,
        count: group.transactions.length,
        totalAmount: group.totalAmount,
        averageAmount:
          group.successfulCount > 0
            ? group.totalAmount / group.successfulCount
            : 0,
        successRate: (group.successfulCount / group.transactions.length) * 100,
        currency: group.currency,
      }))
      .sort((a, b) => b.count - a.count) // Sort by count descending

    // Calculate overall totals
    const totalTransactions = allTransactions.length
    const successfulTransactions = allTransactions.filter(
      (t) => t.status?.toLowerCase() === "success"
    ).length
    const failedTransactions = totalTransactions - successfulTransactions

    const totalAmount = allTransactions
      .filter((t) => t.status?.toLowerCase() === "success")
      .reduce((sum, t) => sum + t.amount, 0)

    const averageTransactionAmount =
      successfulTransactions > 0 ? totalAmount / successfulTransactions : 0

    const successRate =
      totalTransactions > 0
        ? (successfulTransactions / totalTransactions) * 100
        : 0

    const currency = allTransactions[0]?.currency || "USD"

    return {
      dateRange: { from: fromDate, to: toDate },
      byType,
      totals: {
        totalTransactions,
        successfulTransactions,
        failedTransactions,
        totalAmount,
        averageTransactionAmount,
        successRate,
        currency,
      },
    }
  } catch (error) {
    console.error("Error in getTransactionAnalysis:", error)
    throw error
  }
}
