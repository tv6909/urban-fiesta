-- Fix the returns table schema and status constraint to match the application needs

-- First, update the status constraint to include 'completed' status
ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_status_check;
ALTER TABLE returns ADD CONSTRAINT returns_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'processed'));

-- Add missing columns that the application expects
DO $$ 
BEGIN
    -- Add original_receipt_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'returns' AND column_name = 'original_receipt_id') THEN
        ALTER TABLE returns ADD COLUMN original_receipt_id UUID REFERENCES receipts(id);
    END IF;
    
    -- Add customer_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'returns' AND column_name = 'customer_name') THEN
        ALTER TABLE returns ADD COLUMN customer_name TEXT;
    END IF;
    
    -- Add customer_phone column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'returns' AND column_name = 'customer_phone') THEN
        ALTER TABLE returns ADD COLUMN customer_phone TEXT;
    END IF;
    
    -- Add description column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'returns' AND column_name = 'description') THEN
        ALTER TABLE returns ADD COLUMN description TEXT;
    END IF;
    
    -- Add refund_method column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'returns' AND column_name = 'refund_method') THEN
        ALTER TABLE returns ADD COLUMN refund_method TEXT DEFAULT 'cash';
    END IF;
END $$;

-- Update return_items table to reference returns instead of receipts if needed
DO $$
BEGIN
    -- Check if return_items references receipts and change it to returns
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints tc
               JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
               WHERE tc.table_name = 'return_items' 
               AND kcu.column_name = 'receipt_id'
               AND tc.constraint_type = 'FOREIGN KEY') THEN
        
        -- Drop the foreign key constraint first
        ALTER TABLE return_items DROP CONSTRAINT return_items_receipt_id_fkey;
        
        -- Rename the column
        ALTER TABLE return_items RENAME COLUMN receipt_id TO return_id;
        
        -- Add the correct foreign key constraint
        ALTER TABLE return_items ADD CONSTRAINT return_items_return_id_fkey 
            FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create or replace the function to create returns with items
CREATE OR REPLACE FUNCTION create_return_with_items(
    p_return_number TEXT,
    p_original_receipt_id UUID,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_reason TEXT,
    p_description TEXT,
    p_refund_method TEXT,
    p_status TEXT,
    p_shopkeeper_id UUID,
    p_items JSONB
) RETURNS UUID AS $$
DECLARE
    v_return_id UUID;
    v_item JSONB;
    v_total_amount NUMERIC := 0;
BEGIN
    -- Validate status value
    IF p_status NOT IN ('pending', 'approved', 'rejected', 'completed', 'processed') THEN
        RAISE EXCEPTION 'Invalid status value: %. Must be one of: pending, approved, rejected, completed, processed', p_status;
    END IF;
    
    -- Calculate total amount from items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_total_amount := v_total_amount + (v_item->>'total_price')::NUMERIC;
    END LOOP;
    
    -- Create the return record
    INSERT INTO returns (
        return_number,
        original_receipt_id,
        receipt_id, -- Keep for backward compatibility
        customer_name,
        customer_phone,
        reason,
        description,
        total_amount,
        refund_method,
        status,
        shopkeeper_id
    ) VALUES (
        p_return_number,
        p_original_receipt_id,
        p_original_receipt_id, -- Same value for backward compatibility
        p_customer_name,
        p_customer_phone,
        p_reason,
        p_description,
        v_total_amount,
        p_refund_method,
        p_status,
        p_shopkeeper_id
    ) RETURNING id INTO v_return_id;
    
    -- Create return items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO return_items (
            return_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total_price
        ) VALUES (
            v_return_id,
            (v_item->>'product_id')::UUID,
            v_item->>'product_name',
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_price')::NUMERIC,
            (v_item->>'total_price')::NUMERIC
        );
    END LOOP;
    
    RETURN v_return_id;
END;
$$ LANGUAGE plpgsql;
