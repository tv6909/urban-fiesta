"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { X, Download, Search } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { syncManager } from "@/lib/sync-manager"
import { ReceiptImageGenerator } from "@/lib/receipt-image-generator"

interface ReceiptItem {
  productName: string
  quantity: number
  price: number
  total: number
}

interface ReturnItem {
  productId: number
  productName: string
  quantity: number
  amount: number
  originalPrice: number
}

interface Receipt {
  id: string
  customerName: string
  customerPhone: string
  amount: number
  receivedAmount?: number
  changeAmount?: number
  pendingAmount?: number
  balance?: number
  items: ReceiptItem[]
  returnItems?: ReturnItem[]
  subtotal: number
  discount: number
  returnTotal?: number
  tax: number
  total: number
  paymentMethod: string
  date: string
  status: string
  notes: string
  extraPayment?: number
  shopkeeperBalance?: number
}

interface ReceiptDetailModalProps {
  receipt: Receipt
  onClose: () => void
  onDelete?: (receiptId: string) => void // Add delete callback
}

export function ReceiptDetailModal({ receipt, onClose, onDelete }: ReceiptDetailModalProps) {
  const { toast } = useToast()

  const handleDownload = async () => {
    try {
      await ReceiptImageGenerator.generateReceiptImage(receipt)
      toast({
        title: "Receipt Downloaded",
        description: `Receipt ${receipt.id} has been downloaded as an image.`,
      })
    } catch (error) {
      console.error("Download failed:", error)
      toast({
        title: "Download Failed",
        description: "Failed to download receipt. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleShare = async () => {
    try {
      // First generate the receipt image
      const imageBlob = await ReceiptImageGenerator.generateReceiptImageBlob(receipt)

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [new File([imageBlob], "receipt.png", { type: "image/png" })] })
      ) {
        // Use Web Share API with image file for WhatsApp sharing
        const file = new File([imageBlob], `HZ-Shop-Receipt-${receipt.id}.png`, { type: "image/png" })
        await navigator.share({
          title: `HZ Shop Receipt #${receipt.id}`,
          text: `Receipt from HZ Shop for ${receipt.customerName}`,
          files: [file],
        })
        toast({
          title: "Receipt Shared",
          description: "Receipt image has been shared successfully.",
        })
      } else {
        // Fallback: Create WhatsApp URL with text and prompt user to share image separately
        const shareText = generateReceiptText(receipt)
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`

        // Download the image for manual sharing
        const url = URL.createObjectURL(imageBlob)
        const link = document.createElement("a")
        link.href = url
        link.download = `HZ-Shop-Receipt-${receipt.id}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        // Open WhatsApp
        window.open(whatsappUrl, "_blank")

        toast({
          title: "Receipt Ready to Share",
          description:
            "Receipt image downloaded and WhatsApp opened. You can now attach the image to your WhatsApp message.",
        })
      }
    } catch (error) {
      console.error("Share failed:", error)
      // Fallback to text sharing
      const shareText = generateReceiptText(receipt)

      if (navigator.share) {
        try {
          await navigator.share({
            title: `HZ Shop Receipt #${receipt.id}`,
            text: shareText,
          })
          toast({
            title: "Receipt Shared",
            description: "Receipt has been shared successfully.",
          })
        } catch (shareError) {
          await navigator.clipboard.writeText(shareText)
          toast({
            title: "Receipt Copied",
            description: "Receipt details copied to clipboard for sharing.",
          })
        }
      } else {
        await navigator.clipboard.writeText(shareText)
        toast({
          title: "Receipt Copied",
          description: "Receipt details copied to clipboard for sharing.",
        })
      }
    }
  }

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete receipt #${receipt.id}? This action cannot be undone.`)) {
      try {
        // Use the database function directly like products do
        const { deleteReceipt } = await import("@/lib/database")
        await deleteReceipt(receipt.id)
        onDelete?.(receipt.id)
        onClose()
        toast({
          title: "Receipt Deleted",
          description: `Receipt #${receipt.id} has been permanently deleted.`,
        })
      } catch (error) {
        console.error("Delete failed:", error)
        toast({
          title: "Delete Failed",
          description: "Failed to delete receipt. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  const generateReceiptText = (receipt: Receipt) => {
    return `
HZ SHOP RECEIPT
===============

Receipt #: ${receipt.id}
Date: ${new Date(receipt.date).toLocaleString()}
Customer: ${receipt.customerName}
Phone: ${receipt.customerPhone}

ITEMS:
------
${receipt.items
  .map(
    (item) =>
      `${item.productName} x${item.quantity} @ ₹${item.price.toLocaleString()} = ₹${item.total.toLocaleString()}`,
  )
  .join("\n")}

${
  receipt.returnItems && receipt.returnItems.length > 0
    ? `
RETURNS:
--------
${receipt.returnItems
  .map(
    (item) =>
      `${item.productName} x${item.quantity} @ ₹${(item.amount / item.quantity).toLocaleString()} = -₹${item.amount.toLocaleString()}`,
  )
  .join("\n")}
`
    : ""
}

SUMMARY:
--------
Subtotal: ₹${(receipt.subtotal || 0).toLocaleString()}
${(receipt.discount || 0) > 0 ? `Discount: -₹${(receipt.discount || 0).toLocaleString()}\n` : ""}${receipt.returnTotal && receipt.returnTotal > 0 ? `Returns: -₹${receipt.returnTotal.toLocaleString()}\n` : ""}Total: ₹${(receipt.total || 0).toLocaleString()}
${receipt.receivedAmount ? `Received: ₹${receipt.receivedAmount.toLocaleString()}\n` : ""}${receipt.changeAmount && receipt.changeAmount > 0 ? `Change: ₹${receipt.changeAmount.toLocaleString()}\n` : ""}
${receipt.notes ? `\nNotes: ${receipt.notes}\n` : ""}
===============
Thank you for your business!
HZ Shop - Your trusted retail partner
    `.trim()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Receipt #{receipt.id}</CardTitle>
            <CardDescription>{new Date(receipt.date).toLocaleString()}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Search className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
              >
                <X className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Receipt Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">HZ Shop</h2>
            <p className="text-muted-foreground">Professional Retail Management</p>
            <Separator className="my-4" />
          </div>

          {/* Customer Information */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Customer Information</h3>
            <div className="space-y-1">
              <p>
                <strong>Name:</strong> {receipt.customerName}
              </p>
              <p>
                <strong>Phone:</strong> {receipt.customerPhone}
              </p>
              <p>
                <strong>Date:</strong> {new Date(receipt.date).toLocaleString()}
              </p>
              <p className="flex items-center gap-2">
                <strong>Status:</strong>
                <Badge variant={receipt.status === "paid" ? "default" : "outline"}>{receipt.status}</Badge>
              </p>
            </div>
          </div>

          {/* Items */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Items</h3>
            <div className="border rounded-lg">
              <div className="grid grid-cols-4 gap-4 p-3 bg-muted font-medium text-sm">
                <span>Product</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Price</span>
                <span className="text-right">Total</span>
              </div>
              {receipt.items.map((item, index) => (
                <div key={index} className="grid grid-cols-4 gap-4 p-3 border-t">
                  <span className="font-medium">{item.productName}</span>
                  <span className="text-center">{item.quantity}</span>
                  <span className="text-right">₹{item.price.toLocaleString()}</span>
                  <span className="text-right">₹{item.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Return Items */}
          {receipt.returnItems && receipt.returnItems.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2 text-orange-600">Return Items</h3>
              <div className="border rounded-lg border-orange-200 bg-orange-50/30">
                <div className="grid grid-cols-4 gap-4 p-3 bg-orange-100 font-medium text-sm text-orange-800">
                  <span>Product</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Total</span>
                </div>
                {receipt.returnItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-4 gap-4 p-3 border-t border-orange-200">
                    <span className="font-medium text-orange-800">{item.productName}</span>
                    <span className="text-center text-orange-700">{item.quantity}</span>
                    <span className="text-right text-orange-700">
                      PKR {(item.amount / item.quantity).toLocaleString()}
                    </span>
                    <span className="text-right font-medium text-orange-800">-PKR {item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Summary */}
          <div className="mb-6">
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>PKR {(receipt.subtotal || 0).toLocaleString()}</span>
                </div>
                {(receipt.discount || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>-PKR {(receipt.discount || 0).toLocaleString()}</span>
                  </div>
                )}
                {receipt.returnTotal && receipt.returnTotal > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Returns:</span>
                    <span>-PKR {receipt.returnTotal.toLocaleString()}</span>
                  </div>
                )}
                {(receipt.tax || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>PKR {(receipt.tax || 0).toLocaleString()}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>PKR {(receipt.total || 0).toLocaleString()}</span>
                </div>
                {receipt.receivedAmount && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span>Received Amount:</span>
                      <span>PKR {receipt.receivedAmount.toLocaleString()}</span>
                    </div>
                    {receipt.changeAmount && receipt.changeAmount > 0 && (
                      <div className="flex justify-between">
                        <span>Change:</span>
                        <span>PKR {receipt.changeAmount.toLocaleString()}</span>
                      </div>
                    )}
                    {receipt.extraPayment && receipt.extraPayment > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Extra Payment Applied:</span>
                        <span>PKR {receipt.extraPayment.toLocaleString()}</span>
                      </div>
                    )}
                    {/* Display pending amount if there's any outstanding balance */}
                    {(() => {
                      const pendingAmt = Math.max((receipt.total || 0) - (receipt.receivedAmount || 0), 0)
                      return (
                        pendingAmt > 0 && (
                          <div className="flex justify-between text-orange-600">
                            <span>Pending Amount:</span>
                            <span>PKR {pendingAmt.toLocaleString()}</span>
                          </div>
                        )
                      )
                    })()}
                  </>
                )}

                {receipt.shopkeeperBalance !== undefined && (
                  <>
                    <Separator className="border-orange-300" />
                    <div className="flex justify-between font-bold text-orange-700 bg-orange-50 p-2 rounded">
                      <span>TOTAL OUTSTANDING BALANCE:</span>
                      <span>PKR {receipt.shopkeeperBalance.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-orange-600 text-center">
                      (Cumulative amount due across all transactions)
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          {receipt.notes && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">{receipt.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            <p>Thank you for your business!</p>
            <p>HZ Shop - Your trusted retail partner</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
