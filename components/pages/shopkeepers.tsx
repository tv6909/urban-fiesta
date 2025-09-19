"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, Phone, CreditCard } from "lucide-react"
import { syncManager } from "@/lib/sync-manager"

interface PendingReceipt {
  receiptNumber: string
  receiptDate: string
  totalAmount: number
  amountReceived: number
  pendingAmount: number
}

interface Shopkeeper {
  id: number
  name: string
  phone: string
  balance: number
  pendingReceipts: PendingReceipt[]
  totalPendingAmount: number
}

export function Shopkeepers() {
  const [shopkeepers, setShopkeepers] = useState<Shopkeeper[]>([])
  const [payingShopkeeper, setPayingShopkeeper] = useState<number | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")

  useEffect(() => {
    const loadShopkeepers = async () => {
      try {
        const shopkeepersData = await syncManager.getShopkeepers()
        console.log("[v0] Loaded shopkeepers from database:", shopkeepersData)

        if (shopkeepersData && shopkeepersData.length > 0) {
          const formattedShopkeepers = await Promise.all(
            shopkeepersData.map(async (sk: any) => {
              // Get receipts for this shopkeeper to calculate balance - use shopkeeper_id for reliable matching
              const receipts = await syncManager.getReceipts()
              const shopkeeperReceipts = receipts.filter((receipt: any) => receipt.shopkeeper_id === sk.id)

              // Use the shopkeeper's current_balance directly instead of calculating from receipts
              // This ensures we use the authoritative database value
              const pendingAmount = sk.current_balance || 0

              const pendingReceipts = shopkeeperReceipts
                .filter((receipt: any) => (receipt.pendingAmount || 0) > 0)
                .map((receipt: any) => ({
                  receiptNumber: receipt.receiptNumber,
                  receiptDate: receipt.date,
                  totalAmount: receipt.total || 0,
                  amountReceived: receipt.receivedAmount || 0,
                  pendingAmount: receipt.pendingAmount || 0,
                }))

              return {
                id: sk.id,
                name: sk.name,
                phone: sk.contact || sk.phone || "",
                // Use current_balance directly as the amount owed by shopkeeper
                balance: -(sk.current_balance || 0),
                pendingReceipts: pendingReceipts,
                totalPendingAmount: pendingAmount,
              }
            }),
          )
          setShopkeepers(formattedShopkeepers)
        }
      } catch (error) {
        console.error("[v0] Failed to load shopkeepers:", error)
      }
    }

    loadShopkeepers()

    const handleBalanceUpdate = (event: CustomEvent) => {
      const {
        shopkeeperName,
        shopkeeperPhone,
        receiptNumber,
        receiptDate,
        totalAmount,
        amountReceived,
        pendingAmount,
      } = event.detail

      setShopkeepers((prev) => {
        const existingShopkeeper = prev.find((s) => s.name === shopkeeperName && s.phone === shopkeeperPhone)

        if (existingShopkeeper) {
          return prev.map((s) =>
            s.id === existingShopkeeper.id
              ? {
                  ...s,
                  pendingReceipts: [
                    ...s.pendingReceipts,
                    {
                      receiptNumber,
                      receiptDate,
                      totalAmount,
                      amountReceived,
                      pendingAmount,
                    },
                  ],
                  totalPendingAmount: s.totalPendingAmount + pendingAmount,
                }
              : s,
          )
        } else {
          const newShopkeeper: Shopkeeper = {
            id: Date.now(),
            name: shopkeeperName,
            phone: shopkeeperPhone,
            balance: 0,
            pendingReceipts: [
              {
                receiptNumber,
                receiptDate,
                totalAmount,
                amountReceived,
                pendingAmount,
              },
            ],
            totalPendingAmount: pendingAmount,
          }
          return [...prev, newShopkeeper]
        }
      })
    }

    window.addEventListener("update-shopkeeper-balance", handleBalanceUpdate as EventListener)
    return () => window.removeEventListener("update-shopkeeper-balance", handleBalanceUpdate as EventListener)
  }, [])

  const handlePayment = async (shopkeeperId: number) => {
    const amount = Number.parseFloat(paymentAmount)
    if (!amount || amount <= 0) return

    const shopkeeper = shopkeepers.find((s) => s.id === shopkeeperId)
    if (!shopkeeper) return

    // Calculate total due amount (absolute balance if negative, or totalPendingAmount)
    const totalDue = shopkeeper.balance < 0 ? Math.abs(shopkeeper.balance) : shopkeeper.totalPendingAmount

    // Validate payment doesn't exceed due amount
    if (amount > totalDue) {
      alert(`Payment amount (${amount}) cannot exceed due amount (${totalDue})`)
      return
    }

    try {
      // Use the new payment processing function
      const { processShopkeeperPayment } = await import("@/lib/database")
      const result = await processShopkeeperPayment(shopkeeperId.toString(), amount)

      console.log(`[v0] Payment processed: ${result.paymentProcessed}, receipts updated: ${result.updatedReceipts}`)

      // Also update in sync manager
      const existingShopkeepers = await syncManager.getShopkeepers()
      const existingShopkeeper = existingShopkeepers.find((s) => s.id === shopkeeperId)
      if (existingShopkeeper) {
        const updatedShopkeeper = {
          ...existingShopkeeper,
          current_balance: result.newBalance,
          updated_at: new Date().toISOString(),
        }
        await syncManager.saveShopkeeper(updatedShopkeeper)
      }

      const paymentHistory = {
        id: crypto.randomUUID(),
        shopkeeper_id: shopkeeperId,
        receipt_id: null, // This is a standalone payment, not tied to a specific receipt
        amount: amount,
        type: "payment",
        description: `Manual payment received from ${shopkeeper.name}`,
        created_at: new Date().toISOString(),
      }
      await syncManager.savePaymentHistory(paymentHistory)

      // Update local state immediately for UI responsiveness
      setShopkeepers((prev) =>
        prev.map((s) => {
          if (s.id === shopkeeperId) {
            // Use the new balance from the payment processing result
            const newBalance = -result.newBalance

            // Reduce pending amount proportionally
            const newPendingAmount = Math.max(0, s.totalPendingAmount - amount)

            // Update pending receipts proportionally
            let remainingPayment = amount
            const updatedPendingReceipts = s.pendingReceipts
              .map((receipt) => {
                if (remainingPayment <= 0) return receipt

                const paymentForThis = Math.min(remainingPayment, receipt.pendingAmount)
                remainingPayment -= paymentForThis

                return {
                  ...receipt,
                  amountReceived: receipt.amountReceived + paymentForThis,
                  pendingAmount: receipt.pendingAmount - paymentForThis,
                }
              })
              .filter((receipt) => receipt.pendingAmount > 0)

            return {
              ...s,
              balance: newBalance,
              totalPendingAmount: newPendingAmount,
              pendingReceipts: updatedPendingReceipts,
            }
          }
          return s
        }),
      )

      window.dispatchEvent(
        new CustomEvent("shopkeeper-payment-made", {
          detail: {
            shopkeeperId: shopkeeperId,
            shopkeeperName: shopkeeper.name,
            paymentAmount: amount,
            newBalance: result.newBalance,
            timestamp: new Date().toISOString(),
          },
        }),
      )

      // Reset payment form
      setPaymentAmount("")
      setPayingShopkeeper(null)

      console.log(`[v0] Payment of ${amount} processed for shopkeeper ${shopkeeper.name}`)
    } catch (error) {
      console.error("Failed to process payment:", error)
      alert("Failed to process payment. Please try again.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Shopkeepers</h1>
          <p className="text-muted-foreground">Manage registered shopkeepers and their accounts</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Shopkeeper
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search shopkeepers..." className="pl-10" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shopkeepers.map((shopkeeper) => (
          <Card key={shopkeeper.id}>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">{shopkeeper.name}</h3>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{shopkeeper.phone}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Balance:</span>
                    <span
                      className={`text-sm font-medium ${shopkeeper.balance >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      PKR {Math.abs(shopkeeper.balance).toLocaleString()}
                      {shopkeeper.balance < 0 && " (Due)"}
                    </span>
                  </div>

                  {shopkeeper.totalPendingAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Pending Amount:</span>
                      <span className="text-sm font-medium text-red-600">
                        PKR {shopkeeper.totalPendingAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Pay Now Button - show if there's a due amount */}
                {(shopkeeper.balance < 0 || shopkeeper.totalPendingAmount > 0) && (
                  <div className="space-y-2">
                    {payingShopkeeper === shopkeeper.id ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Enter payment amount"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            className="flex-1"
                            min="0.01"
                            step="0.01"
                            max={shopkeeper.balance < 0 ? Math.abs(shopkeeper.balance) : shopkeeper.totalPendingAmount}
                          />
                          <Button
                            size="sm"
                            onClick={() => handlePayment(shopkeeper.id)}
                            disabled={!paymentAmount || Number.parseFloat(paymentAmount) <= 0}
                          >
                            <CreditCard className="h-4 w-4 mr-1" />
                            Pay
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPayingShopkeeper(null)
                            setPaymentAmount("")
                          }}
                          className="w-full"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full bg-transparent"
                        onClick={() => setPayingShopkeeper(shopkeeper.id)}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pay Now
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
