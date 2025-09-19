-- Fix return schema and add proper functions for return processing

-- First, check if we need to add the missing columns to returns table
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

-- Update return_items table to reference returns instead of receipts
DO $$
BEGIN
    -- Check if return_items has receipt_id column and change it to return_id
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'return_items' AND column_name = 'receipt_id') THEN
        -- Drop the foreign key constraint first
        ALTER TABLE return_items DROP CONSTRAINT IF EXISTS return_items_receipt_id_fkey;
        
        -- Rename the column
        ALTER TABLE return_items RENAME COLUMN receipt_id TO return_id;
        
        -- Add the correct foreign key constraint
        ALTER TABLE return_items ADD CONSTRAINT return_items_return_id_fkey 
            FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create function to create a complete return with items
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

-- Create function to get returns with items (for proper data retrieval)
CREATE OR REPLACE FUNCTION get_returns_with_items()
RETURNS TABLE (
    id UUID,
    return_number TEXT,
    original_receipt_id UUID,
    receipt_id UUID,
    customer_name TEXT,
    customer_phone TEXT,
    reason TEXT,
    description TEXT,
    total_amount NUMERIC,
    refund_method TEXT,
    status TEXT,
    shopkeeper_id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    items JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.return_number,
        r.original_receipt_id,
        r.receipt_id,
        r.customer_name,
        r.customer_phone,
        r.reason,
        r.description,
        r.total_amount,
        r.refund_method,
        r.status,
        r.shopkeeper_id,
        r.created_at,
        r.updated_at,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', ri.id,
                    'product_id', ri.product_id,
                    'product_name', ri.product_name,
                    'quantity', ri.quantity,
                    'unit_price', ri.unit_price,
                    'total_price', ri.total_price
                )
            ) FILTER (WHERE ri.id IS NOT NULL),
            '[]'::jsonb
        ) as items
    FROM returns r
    LEFT JOIN return_items ri ON r.id = ri.return_id
    GROUP BY r.id, r.return_number, r.original_receipt_id, r.receipt_id, 
             r.customer_name, r.customer_phone, r.reason, r.description,
             r.total_amount, r.refund_method, r.status, r.shopkeeper_id,
             r.created_at, r.updated_at
    ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql;
