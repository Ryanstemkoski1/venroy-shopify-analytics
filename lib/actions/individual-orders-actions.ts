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

    return {
      success: true,
      csvContent,
      filename: `venroy-orders-${fromDate}-to-${toDate}-all.csv`,
    }
  } catch (error) {
    console.error("Failed to export orders:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
