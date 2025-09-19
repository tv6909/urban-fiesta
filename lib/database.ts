import { createClient } from "@/lib/supabase/client"

export interface Product {
  id: string
  name: string
  sku: string
  description?: string
  cost_price: number
  selling_price: number
  current_stock: number
  min_stock_level: number
  is_active: boolean
  category_id: string
  image_url?: string
  created_at: string
  updated_at: string
  category?: Category
}

export interface Category {
  id: string
  name: string
  description?: string
  image_url?: string
  created_at: string
  updated_at: string
  product_count?: number
}

export interface Receipt {
  id: string
  receipt_number: string
  shopkeeper_id: string
  subtotal: number
  return_total: number
  final_total: number
  amount_received: number
  pending_amount: number
  created_at: string
  updated_at: string
  shopkeeper?: Shopkeeper
  receipt_items?: ReceiptItem[]
}

export interface Shopkeeper {
  id: string
  name: string
  contact?: string
  address?: string
  credit_limit: number
  current_balance: number
  total_purchases: number
  created_at: string
  updated_at: string
}

export interface ReceiptItem {
  id: string
  receipt_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  created_at: string
}

export interface Cart {
  id: string
  session_id: string
  created_at: string
}

export interface CartItem {
  id: string
  cart_id: string
  product_id: string
  quantity: number
  product?: Product
  cart?: Cart
}

export interface StockMovement {
  id: string
  product_id: string
  type: "in" | "out"
  quantity: number
  reason: string
  created_at: string
}

export interface Return {
  id: string
  return_number: string
  original_receipt_id: string
  customer_name: string
  customer_phone: string
  reason: string
  description?: string
  refund_method: string
  status: string
  shopkeeper_id: string
  total_amount: number
  created_at: string
  updated_at: string
  items?: Array<{
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
    total_price: number
  }>
}

export async function getDashboardMetrics() {
  const supabase = createClient()

  try {
    // Get total products count
    const { count: totalProducts } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)

    // Get total categories count
    const { count: totalCategories } = await supabase.from("categories").select("*", { count: "exact", head: true })

    // Get today's receipts and revenue
    const today = new Date().toISOString().split("T")[0]
    const { data: todayReceipts, count: todayReceiptsCount } = await supabase
      .from("receipts")
      .select("final_total", { count: "exact" })
      .gte("created_at", `${today}T00:00:00`)
      .lt("created_at", `${today}T23:59:59`)

    const todayRevenue = todayReceipts?.reduce((sum, receipt) => sum + (receipt.final_total || 0), 0) || 0

    // Get low stock items
    const { data: lowStockItems, count: lowStockCount } = await supabase
      .from("products")
      .select("*", { count: "exact" })
      .lte("current_stock", "min_stock_level")
      .eq("is_active", true)

    // Get active shopkeepers count
    const { count: activeShopkeepers } = await supabase.from("shopkeepers").select("*", { count: "exact", head: true })

    // Calculate monthly growth (simplified - comparing this month vs last month)
    const thisMonth = new Date()
    const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 1)
    const thisMonthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1)

    const { data: thisMonthSales } = await supabase
      .from("receipts")
      .select("final_total")
      .gte("created_at", thisMonthStart.toISOString())

    const { data: lastMonthSales } = await supabase
      .from("receipts")
      .select("final_total")
      .gte("created_at", lastMonth.toISOString())
      .lt("created_at", thisMonthStart.toISOString())

    const thisMonthTotal = thisMonthSales?.reduce((sum, receipt) => sum + (receipt.final_total || 0), 0) || 0
    const lastMonthTotal = lastMonthSales?.reduce((sum, receipt) => sum + (receipt.final_total || 0), 0) || 0
    const monthlyGrowth = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0

    return {
      totalProducts: totalProducts || 0,
      totalCategories: totalCategories || 0,
      todayReceipts: todayReceiptsCount || 0,
      todayRevenue,
      lowStockItems: lowStockCount || 0,
      activeShopkeepers: activeShopkeepers || 0,
      monthlyGrowth: Math.round(monthlyGrowth * 10) / 10,
      lowStockProducts: lowStockItems || [],
    }
  } catch (error) {
    console.error("[v0] Error fetching dashboard metrics:", error)
    throw error
  }
}

export async function getRecentActivity(limit = 5) {
  const supabase = createClient()

  try {
    // Get recent receipts
    const { data: recentReceipts } = await supabase
      .from("receipts")
      .select(`
        id,
        receipt_number,
        final_total,
        created_at,
        shopkeeper:shopkeepers(name)
      `)
      .order("created_at", { ascending: false })
      .limit(limit)

    // Get recent returns
    const { data: recentReturns } = await supabase
      .from("returns")
      .select(`
        id,
        return_number,
        total_amount,
        status,
        created_at,
        shopkeeper:shopkeepers(name)
      `)
      .order("created_at", { ascending: false })
      .limit(limit)

    // Get recent low stock alerts
    const { data: lowStockAlerts } = await supabase
      .from("products")
      .select("id, name, current_stock, min_stock_level, updated_at")
      .lte("current_stock", "min_stock_level")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(limit)

    // Combine and format activities
    const activities = [
      ...(recentReceipts?.map((receipt) => ({
        id: `receipt-${receipt.id}`,
        type: "sale" as const,
        description: `Receipt #${receipt.receipt_number} - PKR ${receipt.final_total?.toLocaleString()}`,
        time: formatTimeAgo(receipt.created_at),
        status: "completed" as const,
      })) || []),
      ...(recentReturns?.map((returnItem) => ({
        id: `return-${returnItem.id}`,
        type: "return" as const,
        description: `Return #${returnItem.return_number} - PKR ${returnItem.total_amount?.toLocaleString()}`,
        time: formatTimeAgo(returnItem.created_at),
        status: returnItem.status as "pending" | "completed" | "cancelled",
      })) || []),
      ...(lowStockAlerts?.map((product) => ({
        id: `stock-${product.id}`,
        type: "stock" as const,
        description: `Low stock alert: ${product.name}`,
        time: formatTimeAgo(product.updated_at),
        status: "warning" as const,
      })) || []),
    ]

    // Sort by time and return limited results
    return activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, limit)
  } catch (error) {
    console.error("[v0] Error fetching recent activity:", error)
    throw error
  }
}

function formatTimeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

  if (diffInMinutes < 1) return "Just now"
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours} hours ago`

  const diffInDays = Math.floor(diffInHours / 24)
  return `${diffInDays} days ago`
}

export async function getCategories() {
  const supabase = createClient()

  try {
    const { data: categories, error } = await supabase.from("categories").select("*").order("name")

    if (error) throw error

    // Calculate product count for each category separately
    const categoriesWithCount = await Promise.all(
      (categories || []).map(async (category) => {
        const { count } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("category_id", category.id)
          .eq("is_active", true)

        return {
          ...category,
          product_count: count || 0,
        }
      }),
    )

    return categoriesWithCount
  } catch (error) {
    console.error("[v0] Error fetching categories:", error)
    throw error
  }
}

export async function addCategory(categoryData: {
  name: string
  description?: string
  image_url?: string
}) {
  const supabase = createClient()

  try {
    const { data, error } = await supabase.from("categories").insert([categoryData]).select().single()

    if (error) throw error

    // Also save to local storage for immediate availability
    const { offlineStorage } = await import("./offline-storage")
    await offlineStorage.save("categories", data)

    return data
  } catch (error) {
    console.error("[v0] Error adding category:", error)
    throw error
  }
}

export async function deleteCategory(categoryId: string) {
  const supabase = createClient()

  try {
    // Check if category has products
    const { count } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("category_id", categoryId)

    if (count && count > 0) {
      throw new Error("Cannot delete category with existing products")
    }

    const { error } = await supabase.from("categories").delete().eq("id", categoryId)

    if (error) throw error

    // Also remove from local storage
    const { offlineStorage } = await import("./offline-storage")
    await offlineStorage.delete("categories", categoryId)

    return true
  } catch (error) {
    console.error("[v0] Error deleting category:", error)
    throw error
  }
}

export async function getProducts(categoryId?: string) {
  const supabase = createClient()

  try {
    let query = supabase
      .from("products")
      .select(`
        *,
        category:categories(*)
      `)
      .order("name")

    if (categoryId) {
      query = query.eq("category_id", categoryId)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("[v0] Error fetching products:", error)
    throw error
  }
}

export async function addProduct(productData: {
  name: string
  sku: string
  description?: string
  cost_price: number
  selling_price: number
  current_stock: number
  min_stock_level: number
  category_id: string
  image_url?: string
}) {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from("products")
      .insert([
        {
          ...productData,
          is_active: true,
        },
      ])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error("[v0] Error adding product:", error)
    throw error
  }
}

export async function updateProduct(productId: string, productData: Partial<Product>) {
  const supabase = createClient()

  try {
    const { data, error } = await supabase.from("products").update(productData).eq("id", productId).select().single()

    if (error) throw error
    return data
  } catch (error) {
    console.error("[v0] Error updating product:", error)
    throw error
  }
}

export async function deleteProduct(productId: string) {
  const supabase = createClient()

  try {
    // Hard delete - actually remove the product from the database
    const { error } = await supabase.from("products").delete().eq("id", productId)

    if (error) throw error
    return true
  } catch (error) {
    console.error("[v0] Error deleting product:", error)
    throw error
  }
}

export async function getCartItems(sessionId: string) {
  const supabase = createClient()

  try {
    // First get the cart for this session
    const { data: cart } = await supabase.from("cart").select("id").eq("session_id", sessionId).single()

    if (!cart) {
      return []
    }

    // Then get cart items with product details
    const { data, error } = await supabase
      .from("cart_items")
      .select(`
        *,
        product:products(*)
      `)
      .eq("cart_id", cart.id)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("[v0] Error fetching cart items:", error)
    return []
  }
}

export async function addToCart(sessionId: string, productId: string, quantity = 1) {
  const supabase = createClient()
  console.log("[v0] DEBUG: addToCart called", { sessionId: sessionId.substring(0, 20) + "...", productId, quantity })

  try {
    console.log("[v0] DEBUG: Fetching product details for", productId)
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("current_stock, name, is_active")
      .eq("id", productId)
      .single()

    if (productError) {
      console.log("[v0] DEBUG: Product fetch error", productError)
      throw new Error(`Product fetch failed: ${productError.message || JSON.stringify(productError)}`)
    }

    if (!product) {
      throw new Error("Product not found")
    }

    if (!product.is_active) {
      throw new Error("Product is not available")
    }

    if (product.current_stock < quantity) {
      throw new Error(`Insufficient stock. Available: ${product.current_stock}`)
    }

    // Get or create cart
    let { data: cart } = await supabase.from("cart").select("*").eq("session_id", sessionId).single()

    if (!cart) {
      const { data: newCart, error: cartError } = await supabase
        .from("cart")
        .insert([{ session_id: sessionId }])
        .select()
        .single()

      if (cartError) throw cartError
      cart = newCart
    }

    // Check if item already exists in cart
    const { data: existingItem } = await supabase
      .from("cart_items")
      .select("*")
      .eq("cart_id", cart.id)
      .eq("product_id", productId)
      .single()

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity
      if (product.current_stock < newQuantity) {
        throw new Error(`Insufficient stock. Available: ${product.current_stock}, Requested: ${newQuantity}`)
      }

      const { data, error } = await supabase
        .from("cart_items")
        .update({ quantity: newQuantity })
        .eq("id", existingItem.id)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      const { data, error } = await supabase
        .from("cart_items")
        .insert([{ cart_id: cart.id, product_id: productId, quantity }])
        .select()
        .single()

      if (error) throw error
      return data
    }
  } catch (error) {
    console.error("[v0] Error adding to cart:", error)
    // Ensure we always throw a proper Error object with a message
    if (error instanceof Error) {
      throw error
    } else {
      throw new Error(`Add to cart failed: ${typeof error === "object" ? JSON.stringify(error) : error}`)
    }
  }
}

export async function updateCartItemQuantity(cartItemId: string, quantity: number) {
  const supabase = createClient()

  try {
    if (quantity <= 0) {
      return await removeFromCart(cartItemId)
    }

    // Check stock before updating
    const { data: cartItem } = await supabase
      .from("cart_items")
      .select(`
        *,
        product:products(current_stock, name)
      `)
      .eq("id", cartItemId)
      .single()

    if (!cartItem || !cartItem.product) {
      throw new Error("Cart item not found")
    }

    if (cartItem.product.current_stock < quantity) {
      throw new Error(`Insufficient stock. Available: ${cartItem.product.current_stock}`)
    }

    const { data, error } = await supabase
      .from("cart_items")
      .update({ quantity })
      .eq("id", cartItemId)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error("[v0] Error updating cart item:", error)
    throw error
  }
}

export async function removeFromCart(cartItemId: string) {
  const supabase = createClient()

  try {
    const { error } = await supabase.from("cart_items").delete().eq("id", cartItemId)

    if (error) throw error
    return true
  } catch (error) {
    console.error("[v0] Error removing from cart:", error)
    throw error
  }
}

export async function clearCart(sessionId: string) {
  const supabase = createClient()

  try {
    const { data: cart } = await supabase.from("cart").select("id").eq("session_id", sessionId).single()

    if (cart) {
      const { error } = await supabase.from("cart_items").delete().eq("cart_id", cart.id)

      if (error) throw error
    }
    return true
  } catch (error) {
    console.error("[v0] Error clearing cart:", error)
    throw error
  }
}

export async function validateStockForReceipt(items: Array<{ productId: string; quantity: number }>) {
  const supabase = createClient()

  try {
    const stockChecks = await Promise.all(
      items.map(async (item) => {
        const { data: product } = await supabase
          .from("products")
          .select("id, name, current_stock")
          .eq("id", item.productId)
          .single()

        return {
          productId: item.productId,
          productName: product?.name || "Unknown",
          requestedQuantity: item.quantity,
          availableStock: product?.current_stock || 0,
          isValid: (product?.current_stock || 0) >= item.quantity,
        }
      }),
    )

    const invalidItems = stockChecks.filter((check) => !check.isValid)

    return {
      isValid: invalidItems.length === 0,
      invalidItems,
      stockChecks,
    }
  } catch (error) {
    console.error("[v0] Error validating stock:", error)
    throw error
  }
}

export async function updateProductStock(productId: string, quantitySold: number) {
  const supabase = createClient()

  try {
    console.log(`[v0] Updating stock for product ${productId}: subtracting ${quantitySold}`)

    // Get current stock first
    const { data: product } = await supabase.from("products").select("current_stock, name").eq("id", productId).single()

    if (!product) {
      throw new Error("Product not found")
    }

    console.log(`[v0] Current stock for ${product.name}: ${product.current_stock}`)
    const newStock = Math.max(0, product.current_stock - quantitySold)
    console.log(`[v0] New stock will be: ${newStock}`)

    // Update product stock
    const { error: updateError } = await supabase
      .from("products")
      .update({ current_stock: newStock })
      .eq("id", productId)

    if (updateError) throw updateError

    // Record stock movement
    const { error: movementError } = await supabase.from("stock_movements").insert([
      {
        product_id: productId,
        type: "out",
        quantity: quantitySold,
        reason: "Sale",
      },
    ])

    if (movementError) throw movementError

    return { newStock, productName: product.name }
  } catch (error) {
    console.error("[v0] Error updating product stock:", error)
    throw error
  }
}

export async function getShopkeeperDetails(shopkeeperId: string) {
  const supabase = createClient()

  try {
    // Get shopkeeper basic info
    const { data: shopkeeper } = await supabase.from("shopkeepers").select("*").eq("id", shopkeeperId).single()

    if (!shopkeeper) throw new Error("Shopkeeper not found")

    // Get receipts for this shopkeeper
    const { data: receipts } = await supabase
      .from("receipts")
      .select("*")
      .eq("shopkeeper_id", shopkeeperId)
      .order("created_at", { ascending: false })

    // Calculate totals
    const totalOrders = receipts?.length || 0
    const totalReceived = receipts?.reduce((sum, receipt) => sum + (receipt.amount_received || 0), 0) || 0
    const totalPending = receipts?.reduce((sum, receipt) => sum + (receipt.pending_amount || 0), 0) || 0
    const totalPurchases = receipts?.reduce((sum, receipt) => sum + (receipt.final_total || 0), 0) || 0

    return {
      ...shopkeeper,
      totalOrders,
      totalReceived,
      totalPending,
      totalPurchases,
      receipts: receipts || [],
    }
  } catch (error) {
    console.error("[v0] Error fetching shopkeeper details:", error)
    throw error
  }
}

export async function getShopkeepers() {
  const supabase = createClient()

  try {
    const { data: shopkeepers, error } = await supabase.from("shopkeepers").select("*").order("name")

    if (error) throw error

    // Calculate balances for each shopkeeper
    const shopkeepersWithBalances = await Promise.all(
      (shopkeepers || []).map(async (shopkeeper) => {
        const { data: receipts } = await supabase
          .from("receipts")
          .select("final_total, amount_received, pending_amount")
          .eq("shopkeeper_id", shopkeeper.id)

        const totalOrders = receipts?.length || 0
        const totalReceived = receipts?.reduce((sum, receipt) => sum + (receipt.amount_received || 0), 0) || 0
        const totalPending = receipts?.reduce((sum, receipt) => sum + (receipt.pending_amount || 0), 0) || 0
        const totalPurchases = receipts?.reduce((sum, receipt) => sum + (receipt.final_total || 0), 0) || 0

        return {
          ...shopkeeper,
          totalOrders,
          totalReceived,
          totalPending,
          totalPurchases,
        }
      }),
    )

    return shopkeepersWithBalances
  } catch (error) {
    console.error("[v0] Error fetching shopkeepers:", error)
    throw error
  }
}

export async function createOrGetShopkeeper(name: string, contact?: string, address?: string) {
  const supabase = createClient()

  try {
    // First try to find existing shopkeeper by name
    const { data: existingShopkeeper } = await supabase.from("shopkeepers").select("*").eq("name", name).single()

    if (existingShopkeeper) {
      return existingShopkeeper
    }

    // Create new shopkeeper if not found
    const { data: newShopkeeper, error } = await supabase
      .from("shopkeepers")
      .insert([
        {
          name,
          contact: contact || "",
          address: address || "",
          credit_limit: 0,
          current_balance: 0,
          total_purchases: 0,
        },
      ])
      .select()
      .single()

    if (error) throw error
    return newShopkeeper
  } catch (error) {
    console.error("[v0] Error creating/getting shopkeeper:", error)
    throw error
  }
}

export async function createReceipt(receiptData: {
  shopkeeper_id: string
  subtotal: number
  return_total?: number
  final_total: number
  amount_received: number
  pending_amount: number
  items: Array<{
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
    total_price: number
  }>
}) {
  const supabase = createClient()

  try {
    // Generate receipt number
    const { data: existingReceipts } = await supabase
      .from("receipts")
      .select("receipt_number")
      .order("created_at", { ascending: false })
      .limit(1)

    let receiptNumber = "RCP001"
    if (existingReceipts && existingReceipts.length > 0) {
      const lastNumber = existingReceipts[0].receipt_number
      const numberPart = Number.parseInt(lastNumber.replace("RCP", "")) || 0
      receiptNumber = `RCP${String(numberPart + 1).padStart(3, "0")}`
    }

    // Create receipt
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .insert([
        {
          receipt_number: receiptNumber,
          shopkeeper_id: receiptData.shopkeeper_id,
          subtotal: receiptData.subtotal,
          return_total: receiptData.return_total || 0,
          final_total: receiptData.final_total,
          amount_received: receiptData.amount_received,
          pending_amount: receiptData.pending_amount,
        },
      ])
      .select()
      .single()

    if (receiptError) throw receiptError

    // Create receipt items
    const receiptItems = receiptData.items.map((item) => ({
      ...item,
      receipt_id: receipt.id,
    }))

    const { error: itemsError } = await supabase.from("receipt_items").insert(receiptItems)

    if (itemsError) throw itemsError

    // Update shopkeeper balance by adding to existing amounts and handling extra payments
    const { data: currentShopkeeper } = await supabase
      .from("shopkeepers")
      .select("current_balance, total_purchases")
      .eq("id", receiptData.shopkeeper_id)
      .single()

    // Calculate extra payment that should reduce existing due balance
    const extraPayment = Math.max(0, receiptData.amount_received - receiptData.final_total)
    
    // Update balance: add pending amount for this receipt, subtract any extra payment that reduces existing dues
    const newBalance = Math.max(0, (currentShopkeeper?.current_balance || 0) + receiptData.pending_amount - extraPayment)
    
    console.log(`[v0] Shopkeeper balance update: current=${currentShopkeeper?.current_balance || 0}, pending=${receiptData.pending_amount}, extra_payment=${extraPayment}, new_balance=${newBalance}`)

    const { error: shopkeeperError } = await supabase
      .from("shopkeepers")
      .update({
        current_balance: newBalance,
        total_purchases: (currentShopkeeper?.total_purchases || 0) + receiptData.final_total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", receiptData.shopkeeper_id)

    if (shopkeeperError) throw shopkeeperError

    // Stock will be automatically updated by database triggers when receipt_items are inserted
    console.log(`[v0] Stock will be automatically updated by triggers for ${receiptData.items.length} items`)

    return receipt
  } catch (error) {
    console.error("[v0] Error creating receipt:", error)
    throw error
  }
}

export async function getReceiptsWithDetails() {
  const supabase = createClient()

  try {
    const { data: receipts, error } = await supabase
      .from("receipts")
      .select(`
        *,
        shopkeeper:shopkeepers(*),
        receipt_items(*)
      `)
      .order("created_at", { ascending: false })

    if (error) throw error

    // Transform receipts to match UI expectations
    return (receipts || []).map((receipt: any) => {
      const items =
        receipt.receipt_items?.map((item: any) => ({
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          price: item.unit_price,
          total: item.total_price,
        })) || []

      const computedPendingAmount = Math.max((receipt.final_total || 0) - (receipt.amount_received || 0), 0)

      return {
        id: receipt.id,
        receiptNumber: receipt.receipt_number,
        customerName: receipt.shopkeeper?.name || "Unknown Customer",
        customerPhone: receipt.shopkeeper?.contact || "",
        total: receipt.final_total || 0,
        receivedAmount: receipt.amount_received || 0,
        changeAmount: Math.max(0, (receipt.amount_received || 0) - (receipt.final_total || 0)),
        pendingAmount: computedPendingAmount,
        balance: computedPendingAmount,
        items,
        returnItems: [],
        subtotal: receipt.subtotal || 0,
        discount: 0,
        returnTotal: receipt.return_total || 0,
        tax: 0,
        paymentMethod: "cash",
        date: receipt.created_at,
        status: computedPendingAmount > 0 ? "partial" : "paid",
        notes: "",
        // Keep original database fields
        final_total: receipt.final_total,
        amount_received: receipt.amount_received,
        pending_amount: computedPendingAmount,
        shopkeeper_id: receipt.shopkeeper_id,
      }
    })
  } catch (error) {
    console.error("[v0] Error fetching receipts with details:", error)
    throw error
  }
}

export async function deleteReceipt(receiptId: string) {
  const supabase = createClient()

  try {
    // Delete receipt items first
    const { error: itemsError } = await supabase.from("receipt_items").delete().eq("receipt_id", receiptId)
    if (itemsError) throw itemsError

    // Delete the receipt
    const { error } = await supabase.from("receipts").delete().eq("id", receiptId)
    if (error) throw error

    // Also remove from local storage
    const { offlineStorage } = await import("./offline-storage")
    await offlineStorage.delete("receipts", receiptId)

    return true
  } catch (error) {
    console.error("[v0] Error deleting receipt:", error)
    throw error
  }
}

export async function createReturnWithItems(returnData: {
  return_number?: string
  original_receipt_id: string
  customer_name: string
  customer_phone: string
  reason: string
  description?: string
  refund_method: string
  status: string
  shopkeeper_id: string
  items: Array<{
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
    total_price: number
  }>
}) {
  const supabase = createClient()

  try {
    if (!returnData.original_receipt_id || returnData.original_receipt_id.trim() === "") {
      throw new Error("original_receipt_id is required and cannot be empty")
    }

    if (!returnData.shopkeeper_id || returnData.shopkeeper_id.trim() === "") {
      throw new Error("shopkeeper_id is required and cannot be empty")
    }

    const validStatuses = ["pending", "approved", "rejected", "completed", "processed"]
    if (!validStatuses.includes(returnData.status)) {
      console.log(`[v0] Invalid status '${returnData.status}', using 'completed' instead`)
      returnData.status = "completed"
    }

    // Generate return number if not provided
    let returnNumber = returnData.return_number
    if (!returnNumber) {
      const { data: existingReturns } = await supabase
        .from("returns")
        .select("return_number")
        .order("created_at", { ascending: false })
        .limit(1)

      let maxNumber = 0
      if (existingReturns && existingReturns.length > 0) {
        const lastNumber = existingReturns[0].return_number
        maxNumber = Number.parseInt(lastNumber.replace("RET", "")) || 0
      }
      returnNumber = `RET${String(maxNumber + 1).padStart(3, "0")}`
    }

    console.log(`[v0] Creating return with validated data:`, {
      return_number: returnNumber,
      original_receipt_id: returnData.original_receipt_id,
      status: returnData.status,
      shopkeeper_id: returnData.shopkeeper_id,
    })

    // Use the database function to create return with items
    const { data: result, error } = await supabase.rpc("create_return_with_items", {
      p_return_number: returnNumber,
      p_original_receipt_id: returnData.original_receipt_id,
      p_customer_name: returnData.customer_name,
      p_customer_phone: returnData.customer_phone,
      p_reason: returnData.reason,
      p_description: returnData.description || "",
      p_refund_method: returnData.refund_method,
      p_status: returnData.status,
      p_shopkeeper_id: returnData.shopkeeper_id,
      p_items: returnData.items,
    })

    if (error) {
      console.error("[v0] Error creating return with items:", error)
      throw error
    }

    console.log(`[v0] Return created successfully: ${returnNumber}`)
    return { id: result, return_number: returnNumber }
  } catch (error) {
    console.error("[v0] Error creating return with items:", error)
    throw error
  }
}

export async function getReturnsWithDetails() {
  const supabase = createClient()

  try {
    const { data: returns, error } = await supabase.rpc("get_returns_with_items")

    if (error) throw error

    // Transform returns to match UI expectations
    return (returns || []).map((returnItem: any) => ({
      id: returnItem.id,
      return_number: returnItem.return_number,
      receiptId: returnItem.original_receipt_id,
      customerName: returnItem.customer_name,
      customerPhone: returnItem.customer_phone,
      reason: returnItem.reason,
      description: returnItem.description,
      amount: returnItem.total_amount,
      refundMethod: returnItem.refund_method,
      status: returnItem.status,
      date: returnItem.created_at,
      processedDate: returnItem.updated_at,
      items: returnItem.items || [],
      // Add individual item details for backward compatibility
      productId: returnItem.items?.[0]?.product_id || "",
      productName: returnItem.items?.[0]?.product_name || "",
      quantity: returnItem.items?.[0]?.quantity || 0,
      notes: returnItem.description || "",
    }))
  } catch (error) {
    console.error("[v0] Error fetching returns with details:", error)
    throw error
  }
}

export async function processShopkeeperPayment(shopkeeperId: string, paymentAmount: number) {
  const supabase = createClient()

  try {
    // Get current shopkeeper data
    const { data: shopkeeper } = await supabase
      .from("shopkeepers")
      .select("current_balance")
      .eq("id", shopkeeperId)
      .single()

    if (!shopkeeper) throw new Error("Shopkeeper not found")

    // Get pending receipts for this shopkeeper (oldest first)
    const { data: pendingReceipts } = await supabase
      .from("receipts")
      .select("id, final_total, amount_received, pending_amount")
      .eq("shopkeeper_id", shopkeeperId)
      .gt("pending_amount", 0)
      .order("created_at", { ascending: true })

    let remainingPayment = paymentAmount
    const receiptUpdates = []

    // Distribute payment across pending receipts
    for (const receipt of pendingReceipts || []) {
      if (remainingPayment <= 0) break

      const receiptPending = receipt.pending_amount
      const paymentForThisReceipt = Math.min(remainingPayment, receiptPending)
      
      if (paymentForThisReceipt > 0) {
        const newAmountReceived = receipt.amount_received + paymentForThisReceipt
        const newPendingAmount = Math.max(0, receipt.final_total - newAmountReceived)

        receiptUpdates.push({
          id: receipt.id,
          amount_received: newAmountReceived,
          pending_amount: newPendingAmount
        })

        remainingPayment -= paymentForThisReceipt
      }
    }

    // Update all affected receipts
    for (const update of receiptUpdates) {
      await supabase
        .from("receipts")
        .update({
          amount_received: update.amount_received,
          pending_amount: update.pending_amount,
          updated_at: new Date().toISOString()
        })
        .eq("id", update.id)
    }

    // Update shopkeeper balance
    const newBalance = Math.max(0, shopkeeper.current_balance - paymentAmount)
    await supabase
      .from("shopkeepers")
      .update({
        current_balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq("id", shopkeeperId)

    return {
      success: true,
      updatedReceipts: receiptUpdates.length,
      newBalance: newBalance,
      paymentProcessed: paymentAmount
    }

  } catch (error) {
    console.error("[v0] Error processing shopkeeper payment:", error)
    throw error
  }
}
