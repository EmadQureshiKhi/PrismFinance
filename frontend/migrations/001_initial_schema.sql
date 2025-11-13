-- Prism Finance Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE NOT NULL,
  evm_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vault transactions table
CREATE TABLE IF NOT EXISTS vault_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit_mint', 'burn_withdraw')),
  hbar_amount TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_amount TEXT NOT NULL,
  collateral_ratio TEXT,
  tx_hash TEXT UNIQUE NOT NULL,
  block_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asset transactions table
CREATE TABLE IF NOT EXISTS asset_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  asset_symbol TEXT NOT NULL,
  amount TEXT NOT NULL,
  price_usd TEXT NOT NULL,
  total_cost TEXT NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  block_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Positions table (snapshot of current holdings)
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('vault', 'asset')),
  symbol TEXT NOT NULL,
  amount TEXT NOT NULL,
  average_price TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, type, symbol)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vault_transactions_user_id ON vault_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_transactions_tx_hash ON vault_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_vault_transactions_created_at ON vault_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_transactions_user_id ON asset_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_transactions_asset_symbol ON asset_transactions(asset_symbol);
CREATE INDEX IF NOT EXISTS idx_asset_transactions_tx_hash ON asset_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_asset_transactions_created_at ON asset_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for positions table
CREATE TRIGGER update_positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for now - you can restrict later)
CREATE POLICY "Allow all operations on users" ON users FOR ALL USING (true);
CREATE POLICY "Allow all operations on vault_transactions" ON vault_transactions FOR ALL USING (true);
CREATE POLICY "Allow all operations on asset_transactions" ON asset_transactions FOR ALL USING (true);
CREATE POLICY "Allow all operations on positions" ON positions FOR ALL USING (true);
