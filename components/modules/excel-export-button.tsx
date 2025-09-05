"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet } from "lucide-react"

interface ExcelExportButtonProps {
  dateRange: { from: Date; to: Date }
}

export function ExcelExportButton({ dateRange }: ExcelExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    try {
      setIsExporting(true)

      const fromDate = dateRange.from.toISOString().split("T")[0]
      const toDate = dateRange.to.toISOString().split("T")[0]

      // Call the export API
      const response = await fetch(
        `/api/orders/export?fromDate=${fromDate}&toDate=${toDate}`,
        {
          method: "GET",
        }
      )

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`)
      }

      // Get the blob data
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url

      // Generate filename with date range
      const filename = `venroy-orders-${fromDate}-to-${toDate}.xlsx`
      link.download = filename

      // Trigger download
      document.body.appendChild(link)
      link.click()

      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Export failed:", error)
      alert("Failed to export data. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-2"
    >
      {isExporting ? (
        <>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-white" />
          Exporting...
        </>
      ) : (
        <>
          <FileSpreadsheet className="h-4 w-4" />
          Export to Excel
        </>
      )}
    </Button>
  )
}
