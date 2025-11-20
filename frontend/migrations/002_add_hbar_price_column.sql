-- Add average_hbar_price column to positions table
ALTER TABLE positions ADD COLUMN IF NOT EXISTS average_hbar_price TEXT;

-- Add total_hbar_cost column to positions table (total HBAR spent)
ALTER TABLE positions ADD COLUMN IF NOT EXISTS total_hbar_cost TEXT;

-- Add hbar_price_usd column to asset_transactions table  
ALTER TABLE asset_transactions ADD COLUMN IF NOT EXISTS hbar_price_usd TEXT;