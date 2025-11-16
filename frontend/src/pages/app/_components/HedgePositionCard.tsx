import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, TrendDown, TrendUp, Activity } from "@phosphor-icons/react";
import { useVault } from "@/hooks/useVault";

interface HedgeInfo {
  isActive: boolean;
  hedgedAmount: string;
  entryPrice: string;
  currentPrice: string;
  pnl: string;
  effectiveCollateral: string;
}

export const HedgePositionCard = () => {
  const { getHedgeInfo } = useVault();
  const [hedgeInfo, setHedgeInfo] = useState<HedgeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHedgeInfo = async () => {
      try {
        const info = await getHedgeInfo();
        setHedgeInfo(info);
      } catch (error) {
        console.error("Error fetching hedge info:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHedgeInfo();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchHedgeInfo, 10000);
    return () => clearInterval(interval);
  }, [getHedgeInfo]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield size={20} />
            Delta-Neutral Hedge
          </CardTitle>
          <CardDescription>Loading hedge position...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!hedgeInfo || !hedgeInfo.isActive) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield size={20} weight="regular" />
            Delta-Neutral Hedge
          </CardTitle>
          <CardDescription>
            No active hedge position. Deposit collateral to automatically open a hedge.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const pnl = parseFloat(hedgeInfo.pnl);
  const isProfitable = pnl >= 0;
  const protectionLevel = 90; // 90% hedge ratio

  return (
    <Card className="border-green-500/20 bg-green-500/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield size={20} weight="fill" color="#22c55e" />
            Delta-Neutral Hedge
          </CardTitle>
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            {protectionLevel}% Protected
          </Badge>
        </div>
        <CardDescription>
          Automatic hedging via perpetual futures
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hedged Amount */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Hedged Amount</span>
          <span className="font-mono font-medium">
            {parseFloat(hedgeInfo.hedgedAmount).toFixed(2)} HBAR
          </span>
        </div>

        {/* Entry Price */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Entry Price</span>
          <span className="font-mono text-sm">
            ${parseFloat(hedgeInfo.entryPrice).toFixed(4)}
          </span>
        </div>

        {/* Current Price */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Current Price</span>
          <span className="font-mono text-sm">
            ${parseFloat(hedgeInfo.currentPrice).toFixed(4)}
          </span>
        </div>

        {/* PnL */}
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Activity size={12} />
            Hedge PnL
          </span>
          <span className={`font-mono font-medium flex items-center gap-1 ${
            isProfitable ? 'text-green-500' : 'text-red-500'
          }`}>
            {isProfitable ? (
              <TrendUp size={12} />
            ) : (
              <TrendDown size={12} />
            )}
            {isProfitable ? '+' : ''}{pnl.toFixed(4)} HBAR
          </span>
        </div>

        {/* Effective Collateral */}
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-sm font-medium">Effective Collateral</span>
          <span className="font-mono font-bold">
            {parseFloat(hedgeInfo.effectiveCollateral).toFixed(2)} HBAR
          </span>
        </div>

        {/* Info Box */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
          <p className="flex items-center gap-1">
            <Shield size={12} />
            Your position is {protectionLevel}% protected from HBAR price volatility through an automatic SHORT hedge.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
