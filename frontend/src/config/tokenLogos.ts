// Token logo imports
import pUSD from '@/assets/RWA/pUSD.png';
import pEUR from '@/assets/RWA/pEUR.png';
import pGBP from '@/assets/RWA/pGBP.png';
import pJPY from '@/assets/RWA/PJPY.png';
import pHKD from '@/assets/RWA/pHKD.png';
import pAED from '@/assets/RWA/pAED.png';
import pTSLA from '@/assets/RWA/tesla-rwa-coin.png';
import pAAPL from '@/assets/RWA/apple.png';
import pBTC from '@/assets/RWA/bitcoin.png';
import pETH from '@/assets/RWA/eth.png';
import pGOLD from '@/assets/RWA/gold.png';
import pSPY from '@/assets/RWA/s&p500.png';
import pTBILL from '@/assets/RWA/TBILL.png';

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
