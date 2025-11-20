// Token logo imports
import pUSD from '@/assets/rwa/pUSD.png';
import pEUR from '@/assets/rwa/pEUR.png';
import pGBP from '@/assets/rwa/pGBP.png';
import pJPY from '@/assets/rwa/PJPY.png';
import pHKD from '@/assets/rwa/pHKD.png';
import pAED from '@/assets/rwa/pAED.png';
import pTSLA from '@/assets/rwa/tesla-rwa-coin.png';
import pAAPL from '@/assets/rwa/apple.png';
import pBTC from '@/assets/rwa/bitcoin.png';
import pETH from '@/assets/rwa/eth.png';
import pGOLD from '@/assets/rwa/gold.png';
import pSPY from '@/assets/rwa/s&p500.png';
import pTBILL from '@/assets/rwa/TBILL.png';

// Token logo mapping
export const TOKEN_LOGOS: Record<string, string> = {
  // Currencies
  pUSD,
  pEUR,
  pGBP,
  pJPY,
  pHKD,
  pAED,
  
  // Assets
  pTSLA,
  pAAPL,
  pBTC,
  pETH,
  pGOLD,
  pSPY,
  pTBILL,
};

// Helper function to get token logo by symbol
export const getTokenLogo = (symbol: string): string | undefined => {
  return TOKEN_LOGOS[symbol];
};
