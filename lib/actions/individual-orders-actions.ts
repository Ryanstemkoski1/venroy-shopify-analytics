"use server"

import {
  getIndividualOrders,
  getAllIndividualOrdersForExport,
  generateOrdersCSV,
} from "@/lib/services/get-individual-orders"

export async function fetchIndividualOrdersAction(
  fromDate: string,
  toDate: string,
  page: number = 1,
  pageSize: number = 50
) {
  try {
    const result = await getIndividualOrders(fromDate, toDate, page, pageSize)
    return { success: true, data: result }
  } catch (error) {
    console.error("Failed to fetch individual orders:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function exportOrdersAction(fromDate: string, toDate: string) {
  try {
    // Get ALL orders for export (no pagination)
    const allOrders = await getAllIndividualOrdersForExport(fromDate, toDate)
    const csvContent = generateOrdersCSV(allOrders)

    // Format dates for filename (extract just the date part)
    const formatDateForFilename = (dateStr: string) => {
      // Extract date part from ISO string or return as-is if already date format
      return dateStr.includes("T") ? dateStr.split("T")[0] : dateStr
    }

    const formattedFromDate = formatDateForFilename(fromDate)
    const formattedToDate = formatDateForFilename(toDate)

    return {
      success: true,
      csvContent,
      filename: `venroy-orders-${formattedFromDate}-to-${formattedToDate}-all.csv`,
    }
  } catch (error) {
    console.error("Failed to export orders:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
