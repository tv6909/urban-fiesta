"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateReceiptModal } from "@/components/modals/create-receipt-modal"
import { ReceiptDetailModal } from "@/components/modals/receipt-detail-modal"
import { Plus, Eye, Download, Search, Calendar, Printer } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { syncManager } from "@/lib/sync-manager"
import { ReceiptImageGenerator } from "@/lib/receipt-image-generator"
import { getReceiptsWithDetails } from "@/lib/database"

export function Receipts() {
  const [receipts, setReceipts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  const { toast } = useToast()

  useEffect(() => {
    const loadReceipts = async () => {
      try {
        setLoading(true)
        console.log("[v0] Loading receipts from database...")

        const receiptsData = await getReceiptsWithDetails()
        console.log("[v0] Loaded receipts:", receiptsData.length)

        setReceipts(receiptsData)
      } catch (error) {
        console.error("[v0] Failed to load receipts:", error)
        toast({
          title: "Error",
          description: "Failed to load receipts. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadReceipts()
  }, [toast])

  const handleCreateReceipt = async (newReceipt: any) => {
    try {
      console.log("[v0] New receipt created, refreshing list...")

      const updatedReceipts = await getReceiptsWithDetails()
      console.log("[v0] Refreshed receipts list, new count:", updatedReceipts.length)
      setReceipts(updatedReceipts)

      toast({
        title: "Receipt Created",
        description: `Receipt ${newReceipt.receiptNumber || newReceipt.id} has been saved successfully.`,
      })
    } catch (error) {
      console.error("[v0] Failed to refresh receipts list:", error)
      toast({
        title: "Error",
        description: "Failed to refresh receipts list. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteReceipt = async (receiptId: string) => {
    try {
      await syncManager.deleteReceipt(receiptId)
      setReceipts((prev) => prev.filter((r) => r.id !== receiptId))
      toast({
        title: "Receipt Deleted",
        description: "Receipt has been permanently deleted.",
      })
    } catch (error) {
      console.error("[v0] Failed to delete receipt:", error)
      toast({
        title: "Error",
        description: "Failed to delete receipt. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleCreateReturn = (returnData: any) => {
    // Dispatch custom event to notify Returns page
    window.dispatchEvent(new CustomEvent("new-return-created", { detail: returnData }))

    toast({
      title: "Return Recorded",
      description: `Return for ${returnData.productName} has been recorded in the Returns section.`,
    })
  }

  // Filter receipts based on search and filters
  const filteredReceipts = receipts.filter((receipt) => {
    const receiptId = receipt.receiptNumber || receipt.id || ""
    const customerName = receipt.customerName || ""
    const customerPhone = receipt.customerPhone || ""

    const matchesSearch =
      receiptId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customerPhone.includes(searchTerm)

    const matchesPayment = paymentFilter === "all" || receipt.paymentMethod === paymentFilter

    const matchesTab =
      activeTab === "all" ||
      (activeTab === "today" && new Date(receipt.date).toDateString() === new Date().toDateString())

    return matchesSearch && matchesPayment && matchesTab
  })

  const handlePrintReceipt = (receiptId: string) => {
    toast({
      title: "Printing Receipt",
      description: `Receipt ${receiptId} is being prepared for printing.`,
    })
  }

  const handleDownloadReceipt = async (receipt: any) => {
    try {
      await ReceiptImageGenerator.generateReceiptImage(receipt)
      toast({
        title: "Receipt Downloaded",
        description: `Receipt ${receipt.receiptNumber || receipt.id} image has been downloaded.`,
      })
    } catch (error) {
      console.error("[v0] Failed to generate image:", error)
      toast({
        title: "Error",
        description: "Failed to generate receipt image. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Calculate summary stats
  const todayReceipts = receipts.filter((r) => new Date(r.date).toDateString() === new Date().toDateString())
  const todayRevenue = todayReceipts.reduce((sum, r) => sum + (r.total || 0), 0)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading receipts...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Receipts</h1>
          <p className="text-muted-foreground">Manage sales receipts and transactions</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Receipt
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{todayReceipts.length}</div>
            <p className="text-xs text-muted-foreground">Today's Receipts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">PKR {todayRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Today's Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{receipts.length}</div>
            <p className="text-xs text-muted-foreground">Total Receipts</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Receipts</TabsTrigger>
          <TabsTrigger value="today">Today</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search receipts by ID, customer name, or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Payment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline">
                    <Calendar className="h-4 w-4 mr-2" />
                    Date Range
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Receipts List */}
          <div className="space-y-4">
            {filteredReceipts.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No receipts found</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {searchTerm ? "Try adjusting your search criteria" : "Create your first receipt to get started"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredReceipts.map((receipt) => (
                <Card key={receipt.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="font-semibold">
                            Receipt #{receipt.receiptNumber || receipt.id?.slice(-6) || "N/A"}
                          </h3>
                          <p className="text-sm text-muted-foreground">{receipt.customerName || "Unknown Customer"}</p>
                          <p className="text-xs text-muted-foreground">{receipt.customerPhone || "No phone"}</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold">PKR {(receipt.total || 0).toLocaleString()}</p>
                          <p className="text-sm text-muted-foreground">
                            {receipt.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0}{" "}
                            items
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">{receipt.paymentMethod || "cash"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground mt-1">
                            {receipt.date ? new Date(receipt.date).toLocaleDateString() : "No date"}{" "}
                            {receipt.date ? new Date(receipt.date).toLocaleTimeString() : ""}
                          </p>
                          {receipt.pendingAmount > 0 && (
                            <p className="text-xs text-orange-600 font-medium">
                              Pending: PKR {receipt.pendingAmount.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedReceipt(receipt)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePrintReceipt(receipt.receiptNumber || receipt.id)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDownloadReceipt(receipt)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {receipt.notes && (
                      <div className="mt-3 p-2 bg-muted rounded text-sm">
                        <strong>Notes:</strong> {receipt.notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {showCreateModal && (
        <CreateReceiptModal
          onClose={() => setShowCreateModal(false)}
          onCreateReceipt={handleCreateReceipt}
          onCreateReturn={handleCreateReturn}
        />
      )}
      {selectedReceipt && (
        <ReceiptDetailModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          onDelete={handleDeleteReceipt}
        />
      )}
    </div>
  )
}
