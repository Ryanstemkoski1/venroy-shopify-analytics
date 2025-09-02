import { NextResponse } from "next/server"
import { syncOrders } from "@/lib/services/sync-orders"

export async function POST() {
  try {
    const result = await syncOrders()

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Sync completed successfully",
        ordersProcessed: result.ordersProcessed,
        transactionsProcessed: result.transactionsProcessed,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("❌ API sync failed:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// Allow GET requests too for easier testing
export async function GET() {
  return POST()
}
