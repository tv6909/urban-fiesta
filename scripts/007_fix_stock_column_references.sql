-- Fix stock column references in functions and triggers
-- The database uses 'current_stock' but functions reference 'stock_quantity'

-- Drop existing triggers first
DROP TRIGGER IF EXISTS update_product_stock_trigger ON receipt_items;
DROP TRIGGER IF EXISTS handle_return_stock_trigger ON return_items;

-- Drop existing functions
DROP FUNCTION IF EXISTS update_product_stock_on_sale();
DROP FUNCTION IF EXISTS handle_return_stock();

-- Recreate function to update product stock on sale with correct column name
CREATE OR REPLACE FUNCTION update_product_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    -- Decrease stock for receipt items using correct column name
    UPDATE products 
    SET 
        current_stock = current_stock - NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.product_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger to update stock when receipt item is added
CREATE TRIGGER update_product_stock_trigger
    AFTER INSERT ON receipt_items
    FOR EACH ROW
    EXECUTE FUNCTION update_product_stock_on_sale();

-- Recreate function to handle return items stock with correct column name
CREATE OR REPLACE FUNCTION handle_return_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Increase stock for return items using correct column name
    UPDATE products 
    SET 
        current_stock = current_stock + NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.product_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger to update stock when return item is added
CREATE TRIGGER handle_return_stock_trigger
    AFTER INSERT ON return_items
    FOR EACH ROW
    EXECUTE FUNCTION handle_return_stock();
