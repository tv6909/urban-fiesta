import { createClient } from "@/lib/supabase/client"
import { offlineStorage } from "./offline-storage"

class SyncManager {
  private supabase = createClient()
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : false
  private syncInProgress = false

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.isOnline = true
        this.syncToServer()
      })

      window.addEventListener("offline", () => {
        this.isOnline = false
      })
    }
  }

  async syncToServer(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) {
      console.log("[v0] Sync skipped - online:", this.isOnline, "syncInProgress:", this.syncInProgress)
      return
    }

    this.syncInProgress = true
    console.log("[v0] Starting sync to server...")

    try {
      const syncQueue = await offlineStorage.getSyncQueue()
      console.log("[v0] Sync queue items:", syncQueue.length)

      for (const item of syncQueue) {
        console.log("[v0] Processing sync item:", item.storeName, item.operation, item.data.id)
        await this.processSyncItem(item)
        await offlineStorage.markSynced(item.id)
        console.log("[v0] Sync item completed:", item.id)
      }

      console.log("[v0] Sync completed successfully")
    } catch (error) {
      console.error("[v0] Sync failed:", error)
    } finally {
      this.syncInProgress = false
    }
  }

  private async processSyncItem(item: any): Promise<void> {
    const { storeName, operation, data } = item

    try {
      console.log(`[v0] Syncing ${operation} for ${storeName} with data:`, data)
      switch (operation) {
        case "upsert":
          const { error: upsertError } = await this.supabase.from(storeName).upsert(data)
          if (upsertError) {
            console.error(`[v0] Upsert error for ${storeName}:`, upsertError)
            throw upsertError
          }
          console.log(`[v0] Successfully upserted to ${storeName}`)
          break
        case "delete":
          // Use hard delete for all tables including products
          const { error: deleteError } = await this.supabase.from(storeName).delete().eq("id", data.id)
          if (deleteError) {
            console.error(`[v0] Delete error for ${storeName}:`, deleteError)
            throw deleteError
          }
          console.log(`[v0] Successfully deleted from ${storeName}`)
          break
      }
    } catch (error) {
      console.error(`[v0] Failed to sync ${operation} for ${storeName}:`, error)
      throw error
    }
  }

  async syncFromServer(): Promise<void> {
    if (!this.isOnline) return

    console.log("[v0] Syncing from server...")

    const tables = [
      "categories",
      "products",
      "shopkeepers",
      "receipts",
      "receipt_items",
      "returns",
      "return_items",
      "settings",
      "payment_history",
      "stock_movements",
    ]

    for (const table of tables) {
      try {
        const { data, error } = await this.supabase.from(table).select("*")

        if (error) throw error

        if (data) {
          for (const item of data) {
            await offlineStorage.save(table, item)
          }
        }
      } catch (error) {
        console.error(`[v0] Failed to sync ${table} from server:`, error)
      }
    }

    console.log("[v0] Initial sync from server completed")
  }

  // CRUD operations that work offline-first
  async saveProduct(product: any): Promise<void> {
    if (!product.id) {
      product.id = crypto.randomUUID()
    }
    console.log("[v0] Saving product:", product.id, "online:", this.isOnline)
    await offlineStorage.save("products", product)
    if (this.isOnline) {
      console.log("[v0] Product saved, triggering sync to server...")
      await this.syncToServer()
    } else {
      console.log("[v0] Product saved offline, will sync when online")
    }
  }

  async saveCategory(category: any): Promise<void> {
    if (!category.id) {
      category.id = crypto.randomUUID()
    }
    await offlineStorage.save("categories", category)
    if (this.isOnline) {
      await this.syncToServer()
    }
  }

  async saveShopkeeper(shopkeeper: any): Promise<void> {
    if (!shopkeeper.id) {
      shopkeeper.id = crypto.randomUUID()
    }
    await offlineStorage.save("shopkeepers", shopkeeper)
    if (this.isOnline) {
      await this.syncToServer()
    }
  }

  async saveReceipt(receipt: any): Promise<void> {
    if (!receipt.id) {
      receipt.id = crypto.randomUUID()
    }
    if (!receipt.receipt_number) {
      const receipts = await this.getReceipts()
      const maxNumber = receipts.reduce((max, r) => {
        const num = Number.parseInt(r.receipt_number?.replace("RCP", "") || "0")
        return Math.max(max, num)
      }, 0)
      receipt.receipt_number = `RCP${String(maxNumber + 1).padStart(3, "0")}`
    }
    await offlineStorage.save("receipts", receipt)
    if (this.isOnline) {
      await this.syncToServer()
    }
  }

  async saveReturn(returnItem: any): Promise<void> {
    if (!returnItem.id) {
      returnItem.id = crypto.randomUUID()
    }
    if (!returnItem.return_number) {
      const returns = await this.getReturns()
      const maxNumber = returns.reduce((max, r) => {
        const num = Number.parseInt(r.return_number?.replace("RET", "") || "0")
        return Math.max(max, num)
      }, 0)
      returnItem.return_number = `RET${String(maxNumber + 1).padStart(3, "0")}`
    }

    // Save to offline storage first
    await offlineStorage.save("returns", returnItem)

    // If online, also save to database using proper function
    if (this.isOnline) {
      try {
        const { createReturnWithItems } = await import("@/lib/database")

        const originalReceiptId = returnItem.original_receipt_id || returnItem.receiptId || ""
        const shopkeeperId = returnItem.shopkeeper_id || ""

        if (!originalReceiptId || originalReceiptId.trim() === "") {
          console.error("[v0] Cannot save return: missing original_receipt_id")
          return // Skip database save but keep offline storage
        }

        if (!shopkeeperId || shopkeeperId.trim() === "") {
          console.error("[v0] Cannot save return: missing shopkeeper_id")
          return // Skip database save but keep offline storage
        }

        const validStatuses = ["pending", "approved", "rejected", "completed", "processed"]
        const status = validStatuses.includes(returnItem.status) ? returnItem.status : "completed"

        // Prepare return data for database function
        const returnData = {
          return_number: returnItem.return_number,
          original_receipt_id: originalReceiptId,
          customer_name: returnItem.customer_name || "",
          customer_phone: returnItem.customer_phone || "",
          reason: returnItem.reason || "Return processed",
          description: returnItem.description || "",
          refund_method: returnItem.refund_method || "cash",
          status: status,
          shopkeeper_id: shopkeeperId,
          items: [
            {
              product_id: returnItem.product_id || "",
              product_name: returnItem.product_name || "",
              quantity: returnItem.quantity || 0,
              unit_price: returnItem.unit_price || 0,
              total_price: returnItem.total_amount || 0,
            },
          ],
        }

        console.log(`[v0] Saving return to database with validated data:`, {
          return_number: returnData.return_number,
          original_receipt_id: returnData.original_receipt_id,
          status: returnData.status,
          shopkeeper_id: returnData.shopkeeper_id,
        })

        await createReturnWithItems(returnData)
        console.log(`[v0] Return ${returnItem.return_number} saved to database`)
      } catch (error) {
        console.error("[v0] Failed to save return to database:", error)
        // Continue with offline storage - will sync later
      }
    }
  }

  async savePaymentHistory(paymentHistory: any): Promise<void> {
    if (!paymentHistory.id) {
      paymentHistory.id = crypto.randomUUID()
    }
    await offlineStorage.save("payment_history", paymentHistory)
    if (this.isOnline) {
      await this.syncToServer()
    }
  }

  async saveReceiptItem(receiptItem: any): Promise<void> {
    if (!receiptItem.id) {
      receiptItem.id = crypto.randomUUID()
    }
    await offlineStorage.save("receipt_items", receiptItem)
    if (this.isOnline) {
      await this.syncToServer()
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    await offlineStorage.delete("products", productId)
    if (this.isOnline) {
      await this.syncToServer()
    }
  }

  async deleteCategory(categoryId: string): Promise<void> {
    await offlineStorage.delete("categories", categoryId)
    if (this.isOnline) {
      await this.syncToServer()
    }
  }

  async deleteShopkeeper(shopkeeperId: string): Promise<void> {
    await offlineStorage.delete("shopkeepers", shopkeeperId)
    if (this.isOnline) {
      await this.syncToServer()
    }
  }

  async deleteReceipt(receiptId: string): Promise<void> {
    await offlineStorage.delete("receipts", receiptId)
    if (this.isOnline) {
      await this.syncToServer()
    }
  }

  async deleteReturn(returnId: string): Promise<void> {
    await offlineStorage.delete("returns", returnId)
    if (this.isOnline) {
      await this.syncToServer()
    }
  }

  // Get operations (offline-first)
  async getProducts(): Promise<any[]> {
    return await offlineStorage.getAll("products")
  }

  async getCategories(): Promise<any[]> {
    return await offlineStorage.getAll("categories")
  }

  async getShopkeepers(): Promise<any[]> {
    const shopkeepers = await offlineStorage.getAll("shopkeepers")

    // Ensure current_balance is properly calculated
    return shopkeepers.map((shopkeeper: any) => ({
      ...shopkeeper,
      current_balance: shopkeeper.current_balance || 0,
      total_purchases: shopkeeper.total_purchases || 0,
    }))
  }

  async getShopkeeperByPhone(phone: string): Promise<any | null> {
    const shopkeepers = await this.getShopkeepers()
    return shopkeepers.find((shopkeeper: any) => shopkeeper.contact === phone) || null
  }

  async getReceipts(): Promise<any[]> {
    const receipts = await offlineStorage.getAll("receipts")
    const shopkeepers = await this.getShopkeepers()
    const receiptItems = await offlineStorage.getAll("receipt_items")

    return receipts.map((receipt: any) => {
      const shopkeeper = shopkeepers.find((s: any) => s.id === receipt.shopkeeper_id)
      const items = receiptItems.filter((item: any) => item.receipt_id === receipt.id)

      // Properly compute pending amount and balance (don't double-subtract returns!)
      const finalTotal = receipt.final_total || 0
      const amountReceived = receipt.amount_received || 0
      const returnTotal = receipt.return_total || 0
      const computedPendingAmount = Math.max(finalTotal - amountReceived, 0) // Don't subtract returnTotal again!

      return {
        ...receipt,
        // Map database fields to UI fields with proper fallbacks
        id: receipt.id,
        receiptNumber: receipt.receipt_number || `RCP${receipt.id.slice(-3)}`, // Critical for UI compatibility
        total: finalTotal,
        receivedAmount: amountReceived,
        changeAmount: Math.max(0, amountReceived - finalTotal),
        pendingAmount: computedPendingAmount,
        balance: computedPendingAmount, // Alias for UI components that use 'balance'

        // Add customer details from shopkeeper with proper fallbacks
        customerName: shopkeeper?.name || "Unknown Customer",
        customerPhone: shopkeeper?.contact || "",

        // Add receipt items with proper field mapping including productId
        items: items.map((item: any) => ({
          productId: item.product_id, // Critical for return functionality
          productName: item.product_name || "Unknown Product",
          quantity: item.quantity || 0,
          price: item.unit_price || 0,
          total: item.total_price || 0,
        })),

        returnItems: [], // TODO: Add return items if needed

        // Keep original database fields for compatibility
        final_total: finalTotal,
        amount_received: amountReceived,
        pending_amount: computedPendingAmount, // Use computed value, not database value
        shopkeeper_id: receipt.shopkeeper_id,

        // Additional fields for UI with proper defaults
        subtotal: receipt.subtotal || finalTotal,
        discount: 0, // TODO: Add discount field to database if needed
        returnTotal: returnTotal,
        tax: 0,
        paymentMethod: "cash", // Default payment method
        date: receipt.created_at || new Date().toISOString(),
        status: computedPendingAmount > 0 ? "partial" : "paid", // Use computed pending amount for status
        notes: receipt.notes || "",
      }
    })
  }

  async getReturns(): Promise<any[]> {
    if (this.isOnline) {
      try {
        const { getReturnsWithDetails } = await import("@/lib/database")
        const dbReturns = await getReturnsWithDetails()

        // Update offline storage with latest data
        for (const returnItem of dbReturns) {
          await offlineStorage.save("returns", returnItem)
        }

        return dbReturns
      } catch (error) {
        console.error("[v0] Failed to get returns from database, using offline:", error)
      }
    }

    // Fallback to offline storage
    return await offlineStorage.getAll("returns")
  }

  async createOrUpdateShopkeeper(shopkeeperData: {
    name: string
    phone: string
    receiptNumber: string
    receiptDate: string
    totalAmount: number
    amountReceived: number
    pendingAmount: number
  }): Promise<string> {
    try {
      const existingShopkeepers = await this.getShopkeepers()
      const existingShopkeeper = existingShopkeepers.find(
        (s) => s.name === shopkeeperData.name && s.contact === shopkeeperData.phone,
      )

      let shopkeeperId: string

      if (existingShopkeeper) {
        const updatedShopkeeper = {
          ...existingShopkeeper,
          current_balance: (existingShopkeeper.current_balance || 0) + shopkeeperData.pendingAmount,
          total_purchases: (existingShopkeeper.total_purchases || 0) + shopkeeperData.totalAmount,
          updated_at: new Date().toISOString(),
        }
        await this.saveShopkeeper(updatedShopkeeper)
        shopkeeperId = existingShopkeeper.id
      } else {
        // Create new shopkeeper with initial payment data
        const newShopkeeper = {
          id: crypto.randomUUID(),
          name: shopkeeperData.name,
          contact: shopkeeperData.phone,
          address: "",
          credit_limit: 0,
          current_balance: shopkeeperData.pendingAmount,
          total_purchases: shopkeeperData.totalAmount,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        await this.saveShopkeeper(newShopkeeper)
        shopkeeperId = newShopkeeper.id
      }

      console.log(`[v0] Successfully updated shopkeeper ${shopkeeperData.name} with payment tracking:`)
      console.log(`[v0] - Total purchases: ${shopkeeperData.totalAmount}`)
      console.log(`[v0] - Amount received: ${shopkeeperData.amountReceived}`)
      console.log(`[v0] - Pending amount: ${shopkeeperData.pendingAmount}`)

      return shopkeeperId
    } catch (error) {
      console.error("[v0] Failed to create/update shopkeeper:", error)
      throw error
    }
  }

  async updateProductStock(productId: string, quantityChange: number): Promise<void> {
    try {
      const products = await this.getProducts()
      const product = products.find((p) => p.id === productId)

      if (!product) {
        throw new Error(`Product with ID ${productId} not found`)
      }

      const updatedProduct = {
        ...product,
        current_stock: Math.max(0, (product.current_stock || 0) + quantityChange),
        updated_at: new Date().toISOString(),
      }

      await this.saveProduct(updatedProduct)
      console.log(
        `[v0] Updated product stock: ${product.name} (${product.current_stock} -> ${updatedProduct.current_stock})`,
      )
    } catch (error) {
      console.error("[v0] Failed to update product stock:", error)
      throw error
    }
  }

  getConnectionStatus(): boolean {
    return this.isOnline
  }

  async manualSync(): Promise<void> {
    if (!this.isOnline) {
      throw new Error("Cannot sync while offline")
    }
    await this.syncToServer()
    await this.syncFromServer()
  }
}

export const syncManager = new SyncManager()
