import { supabase } from '@/lib/supabase';

export interface VaultTransactionData {
  walletAddress: string;
  type: 'deposit_mint' | 'burn_withdraw';
  hbarAmount: string;
  tokenSymbol: string;
  tokenAmount: string;
  collateralRatio?: string;
  txHash: string;
  blockNumber?: string;
}

export interface AssetTransactionData {
  walletAddress: string;
  type: 'buy' | 'sell';
  assetSymbol: string;
  amount: string;
  priceUsd: string;
  totalCost: string;
  hbarPriceUsd: string; // Store HBAR price at time of purchase
  txHash: string;
  blockNumber?: string;
}

class DatabaseService {
  // Ensure user exists in database
  async ensureUser(walletAddress: string, evmAddress?: string) {
    try {
      // Check if user exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching user:', fetchError);
        throw fetchError;
      }

      if (existingUser) {
        return existingUser.id;
      }

      // Create new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          wallet_address: walletAddress,
          evm_address: evmAddress,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating user:', insertError);
        throw insertError;
      }

      console.log('✅ New user created:', newUser.id);
      return newUser.id;
    } catch (error) {
      console.error('Error ensuring user:', error);
      throw error;
    }
  }

  // Log vault transaction
  async logVaultTransaction(data: VaultTransactionData) {
    try {
      const userId = await this.ensureUser(data.walletAddress);

      const { error } = await supabase
        .from('vault_transactions')
        .insert({
          user_id: userId,
          type: data.type,
          hbar_amount: data.hbarAmount,
          token_symbol: data.tokenSymbol,
          token_amount: data.tokenAmount,
          collateral_ratio: data.collateralRatio,
          tx_hash: data.txHash,
          block_number: data.blockNumber,
        });

      if (error) throw error;

      // Update position snapshot
      await this.updateVaultPosition(userId, data.tokenSymbol, data.type, data.tokenAmount);

      console.log('✅ Vault transaction logged:', data.txHash);
    } catch (error) {
      console.error('Error logging vault transaction:', error);
      // Don't throw - we don't want to break the UI if DB fails
    }
  }

  // Log asset transaction
  async logAssetTransaction(data: AssetTransactionData) {
    try {
      const userId = await this.ensureUser(data.walletAddress);

      const { error } = await supabase
        .from('asset_transactions')
        .insert({
          user_id: userId,
          type: data.type,
          asset_symbol: data.assetSymbol,
          amount: data.amount,
          price_usd: data.priceUsd,
          total_cost: data.totalCost,
          hbar_price_usd: data.hbarPriceUsd, // Store HBAR price at purchase time
          tx_hash: data.txHash,
          block_number: data.blockNumber,
        });

      if (error) throw error;

      // Update position snapshot
      await this.updateAssetPosition(userId, data.assetSymbol, data.type, data.amount, data.priceUsd, data.hbarPriceUsd, data.totalCost);

      console.log('✅ Asset transaction logged:', data.txHash);
    } catch (error) {
      console.error('Error logging asset transaction:', error);
      // Don't throw - we don't want to break the UI if DB fails
    }
  }

  // Update vault position snapshot
  private async updateVaultPosition(userId: string, symbol: string, type: string, amount: string) {
    try {
      const { data: existing } = await supabase
        .from('positions')
        .select('amount')
        .eq('user_id', userId)
        .eq('type', 'vault')
        .eq('symbol', symbol)
        .maybeSingle();

      const currentAmount = parseFloat(existing?.amount || '0');
      const changeAmount = parseFloat(amount);
      const newAmount = type === 'deposit_mint'
        ? currentAmount + changeAmount
        : Math.max(0, currentAmount - changeAmount);

      await supabase
        .from('positions')
        .upsert({
          user_id: userId,
          type: 'vault',
          symbol,
          amount: newAmount.toString(),
        }, {
          onConflict: 'user_id,type,symbol'
        });
    } catch (error) {
      console.error('Error updating vault position:', error);
    }
  }

  // Update asset position snapshot
  private async updateAssetPosition(userId: string, symbol: string, type: string, amount: string, priceUsd: string, hbarPriceUsd: string, totalCost: string) {
    try {
      const { data: existing } = await supabase
        .from('positions')
        .select('amount, average_price, average_hbar_price, total_hbar_cost')
        .eq('user_id', userId)
        .eq('type', 'asset')
        .eq('symbol', symbol)
        .maybeSingle();

      const currentAmount = parseFloat(existing?.amount || '0');
      const changeAmount = parseFloat(amount);

      const hbarPrice = parseFloat(hbarPriceUsd);
      const assetPrice = parseFloat(priceUsd);
      const hbarCost = parseFloat(totalCost); // HBAR spent in this transaction

      let newAmount: number;
      let newAveragePrice: number;
      let newAverageHbarPrice: number;
      let newTotalHbarCost: number;

      if (type === 'buy') {
        newAmount = currentAmount + changeAmount;
        let currentAvgPrice = parseFloat(existing?.average_price || '0');
        let currentAvgHbarPrice = parseFloat(existing?.average_hbar_price || '0');
        let currentTotalHbarCost = parseFloat(existing?.total_hbar_cost || '0');
        
        // Handle NaN values (from corrupted data)
        if (isNaN(currentAvgPrice)) currentAvgPrice = 0;
        if (isNaN(currentAvgHbarPrice)) currentAvgHbarPrice = 0;
        if (isNaN(currentTotalHbarCost)) currentTotalHbarCost = 0;

        // Calculate weighted average prices
        newAveragePrice = ((currentAmount * currentAvgPrice) + (changeAmount * assetPrice)) / newAmount;
        newAverageHbarPrice = ((currentAmount * currentAvgHbarPrice) + (changeAmount * hbarPrice)) / newAmount;
        newTotalHbarCost = currentTotalHbarCost + hbarCost; // Add HBAR spent
      } else {
        newAmount = Math.max(0, currentAmount - changeAmount);
        // Handle floating point precision issues - if amount is very small, set to 0
        if (newAmount < 0.000001) {
          newAmount = 0;
          newTotalHbarCost = 0; // Reset if position is closed
        } else {
          // Proportionally reduce HBAR cost when selling
          const sellRatio = changeAmount / currentAmount;
          const currentTotalHbarCost = parseFloat(existing?.total_hbar_cost || '0');
          newTotalHbarCost = currentTotalHbarCost * (1 - sellRatio);
        }
        newAveragePrice = parseFloat(existing?.average_price || '0');
        newAverageHbarPrice = parseFloat(existing?.average_hbar_price || '0');
      }

      console.log(`💾 Updating ${symbol} position: ${currentAmount} → ${newAmount} (${type}), total HBAR cost: ${newTotalHbarCost}, avg HBAR price: $${newAverageHbarPrice}`);

      const { data, error } = await supabase
        .from('positions')
        .upsert({
          user_id: userId,
          type: 'asset',
          symbol,
          amount: newAmount.toString(),
          average_price: newAveragePrice.toString(), // Store average asset price
          average_hbar_price: newAverageHbarPrice.toString(), // Store average HBAR price at purchase
          total_hbar_cost: newTotalHbarCost.toString(), // Store total HBAR spent
        }, {
          onConflict: 'user_id,type,symbol'
        })
        .select();

      if (error) {
        console.error('❌ Error upserting position:', error);
      } else {
        console.log('✅ Position updated successfully:', data);
      }
    } catch (error) {
      console.error('Error updating asset position:', error);
    }
  }

  // Get vault transaction history
  async getVaultTransactions(walletAddress: string, limit = 50) {
    try {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (userError) {
        console.error('Error fetching user for transactions:', userError);
        return [];
      }

      if (!user) return [];

      const { data, error } = await supabase
        .from('vault_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching vault transactions:', error);
      return [];
    }
  }

  // Get asset transaction history
  async getAssetTransactions(walletAddress: string, limit = 50) {
    try {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (userError) {
        console.error('Error fetching user for asset transactions:', userError);
        return [];
      }

      if (!user) return [];

      const { data, error } = await supabase
        .from('asset_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching asset transactions:', error);
      return [];
    }
  }

  // Get all positions for a user
  async getUserPositions(walletAddress: string) {
    try {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (userError) {
        console.error('Error fetching user for positions:', userError);
        return { vault: [], assets: [] };
      }

      if (!user) return { vault: [], assets: [] };

      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      const vault = data?.filter(p => p.type === 'vault') || [];
      const assets = data?.filter(p => p.type === 'asset') || [];

      return { vault, assets };
    } catch (error) {
      console.error('Error fetching user positions:', error);
      return { vault: [], assets: [] };
    }
  }

  // Get asset positions with profit/loss calculations
  async getAssetProfitLoss(walletAddress: string) {
    try {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (userError || !user) {
        return [];
      }

      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'asset');

      if (error) throw error;

      console.log('🔍 All positions from DB:', data);

      // Filter out positions with very small amounts
      const filteredData = (data || []).filter(pos => {
        const amount = parseFloat(pos.amount || '0');
        console.log(`🔍 Position ${pos.symbol}: amount = ${amount}`);
        return amount > 0.000001;
      });
      console.log('🔍 Filtered positions (> 0.000001):', filteredData);

      // DISABLED: Fix the average price conversion (HBAR stored as USD) - one time fix
      const fixedData = filteredData.map(position => {
        const avgPrice = parseFloat(position.average_price || '0');

        // If average price is > $10,000, it's likely HBAR stored as USD
        if (avgPrice > 10000) {
          const historicalHbarPrice = 0.145; // Reasonable estimate for historical conversion
          const correctedPrice = avgPrice * historicalHbarPrice;
          console.log(`🔧 One-time fix for ${position.symbol}: ${avgPrice} HBAR × $${historicalHbarPrice} = $${correctedPrice.toFixed(2)}`);

          return {
            ...position,
            average_price: correctedPrice.toString()
          };
        }

        return position;
      });

      return filteredData;
    } catch (error) {
      console.error('Error fetching asset profit/loss:', error);
      return [];
    }
  }


}

export const db = new DatabaseService();