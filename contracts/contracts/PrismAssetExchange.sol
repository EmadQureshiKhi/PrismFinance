// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPriceOracle.sol";

/**
 * @title PrismAssetExchange
 * @notice Ownership-based synthetic asset exchange (pTSLA, pBTC, pGOLD, etc.)
 * @dev Users swap HBAR for synthetic assets at real-time Pyth oracle prices
 * 
 * Key Differences from PrismVault:
 * - Ownership-based (not debt-based)
 * - Users profit from price appreciation
 * - No collateral ratio requirements
 * - Direct swap mechanism (HBAR ↔ Asset)
 * - Uses Pyth Network for real-time price feeds
 */
contract PrismAssetExchange is ReentrancyGuard, Ownable(msg.sender) {
    
    // ============ State Variables ============
    
    IPriceOracle public pythOracle; // Pyth-based oracle for real-time prices
    
    // User balances: user => tokenSymbol => balance
    mapping(address => mapping(string => uint256)) public balances;
    
    // Total supply per asset
    mapping(string => uint256) public totalSupply;
    
    // HBAR reserves backing each asset
    mapping(string => uint256) public assetReserves;
    
    // Supported assets
    mapping(string => bool) public supportedAssets;
    
    // Fee settings (in basis points, 100 = 1%)
    uint256 public buyFee = 30;  // 0.3% buy fee
    uint256 public sellFee = 30; // 0.3% sell fee
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Decimal conversion constants
    uint256 public constant WEI_PER_TINYBAR = 10_000_000_000; // 10^10
    uint256 public constant TINYBARS_PER_HBAR = 100_000_000;  // 10^8
    
    // Protocol fee collector
    address public feeCollector;
    
    // Accumulated fees
    uint256 public accumulatedFees;
    
    // ============ Events ============
    
    event AssetPurchased(
        address indexed user,
        string indexed tokenSymbol,
        uint256 hbarPaid,
        uint256 tokensReceived,
        uint256 fee
    );
    
    event AssetSold(
        address indexed user,
        string indexed tokenSymbol,
        uint256 tokensSold,
        uint256 hbarReceived,
        uint256 fee
    );
    
    event AssetAdded(string indexed tokenSymbol);
    event AssetRemoved(string indexed tokenSymbol);
    event FeesUpdated(uint256 buyFee, uint256 sellFee);
    event FeeCollectorUpdated(address indexed newCollector);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event ReservesAdded(address indexed depositor, uint256 hbarAmount, string[] assets, uint256[] amounts);
    
    // ============ Constructor ============
    
    constructor(address _pythOracle) {
        require(_pythOracle != address(0), "Invalid oracle");
        pythOracle = IPriceOracle(_pythOracle);
        feeCollector = msg.sender;
        
        // Add supported assets
        _addAsset("pTSLA");  // Tesla
        _addAsset("pAAPL");  // Apple
        _addAsset("pBTC");   // Bitcoin
        _addAsset("pETH");   // Ethereum
        _addAsset("pGOLD");  // Gold
        _addAsset("pSPY");   // S&P 500
        _addAsset("pTBILL"); // Treasury Bills
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Buy synthetic asset with HBAR
     * @param tokenSymbol Asset to buy (e.g., "pTSLA")
     * @param minTokensOut Minimum tokens to receive (slippage protection)
     */
    function buyAsset(string memory tokenSymbol, uint256 minTokensOut) 
        external 
        payable 
        nonReentrant 
    {
        require(supportedAssets[tokenSymbol], "Asset not supported");
        require(msg.value > 0, "Must send HBAR");
        
        // Strip 'p' prefix for oracle lookup
        string memory oracleSymbol = _stripPrefix(tokenSymbol);
        
        // Check price freshness (prevents stale price exploitation)
        require(pythOracle.isPriceFresh("HBAR"), "Stale HBAR price");
        require(pythOracle.isPriceFresh(oracleSymbol), "Stale asset price");
        
        // Get prices from oracle (8 decimals)
        uint256 hbarPrice = pythOracle.getPrice("HBAR");
        uint256 assetPrice = pythOracle.getPrice(oracleSymbol);
        
        require(hbarPrice > 0 && assetPrice > 0, "Invalid prices");
        
        // Convert msg.value from tinybars (8 decimals) to wei (18 decimals)
        uint256 hbarWei = msg.value * WEI_PER_TINYBAR;
        
        // Calculate fee (in wei)
        uint256 feeWei = (hbarWei * buyFee) / FEE_DENOMINATOR;
        uint256 hbarAfterFeeWei = hbarWei - feeWei;
        
        // Calculate tokens to mint (result in wei, 18 decimals)
        // hbarAfterFeeWei: 18 decimals, hbarPrice: 8 decimals, assetPrice: 8 decimals
        // (18 decimals * 8 decimals) / 8 decimals = 18 decimals ✓
        uint256 tokensToMint = (hbarAfterFeeWei * hbarPrice) / assetPrice;
        
        require(tokensToMint >= minTokensOut, "Slippage exceeded");
        require(tokensToMint > 0, "Amount too small");
        
        // Update state (all in wei for internal accounting)
        balances[msg.sender][tokenSymbol] += tokensToMint;
        totalSupply[tokenSymbol] += tokensToMint;
        assetReserves[tokenSymbol] += hbarAfterFeeWei;
        accumulatedFees += feeWei;
        
        emit AssetPurchased(msg.sender, tokenSymbol, msg.value, tokensToMint, feeWei);
    }
    
    /**
     * @notice Sell synthetic asset for HBAR
     * @param tokenSymbol Asset to sell (e.g., "pTSLA")
     * @param tokenAmount Amount of tokens to sell (in wei, 18 decimals)
     * @param minHbarOut Minimum HBAR to receive (in wei, 18 decimals)
     */
    function sellAsset(
        string memory tokenSymbol,
        uint256 tokenAmount,
        uint256 minHbarOut
    ) 
        external 
        nonReentrant 
    {
        require(supportedAssets[tokenSymbol], "Asset not supported");
        require(tokenAmount > 0, "Amount must be > 0");
        require(balances[msg.sender][tokenSymbol] >= tokenAmount, "Insufficient balance");
        
        // Strip 'p' prefix for oracle lookup
        string memory oracleSymbol = _stripPrefix(tokenSymbol);
        
        // Check price freshness (prevents stale price exploitation)
        require(pythOracle.isPriceFresh("HBAR"), "Stale HBAR price");
        require(pythOracle.isPriceFresh(oracleSymbol), "Stale asset price");
        
        // Get prices from oracle (8 decimals)
        uint256 hbarPrice = pythOracle.getPrice("HBAR");
        uint256 assetPrice = pythOracle.getPrice(oracleSymbol);
        
        require(hbarPrice > 0 && assetPrice > 0, "Invalid prices");
        
        // Calculate HBAR to return (in wei, 18 decimals)
        // tokenAmount: 18 decimals, assetPrice: 8 decimals, hbarPrice: 8 decimals
        // (18 decimals * 8 decimals) / 8 decimals = 18 decimals ✓
        uint256 hbarToReturnWei = (tokenAmount * assetPrice) / hbarPrice;
        
        // Calculate fee (in wei)
        uint256 feeWei = (hbarToReturnWei * sellFee) / FEE_DENOMINATOR;
        uint256 hbarAfterFeeWei = hbarToReturnWei - feeWei;
        
        require(hbarAfterFeeWei >= minHbarOut, "Slippage exceeded");
        require(assetReserves[tokenSymbol] >= hbarToReturnWei, "Insufficient reserves");
        
        // Update state (all in wei)
        balances[msg.sender][tokenSymbol] -= tokenAmount;
        totalSupply[tokenSymbol] -= tokenAmount;
        assetReserves[tokenSymbol] -= hbarToReturnWei;
        accumulatedFees += feeWei;
        
        // Convert wei to tinybars for HBAR transfer
        uint256 tinybars = hbarAfterFeeWei / WEI_PER_TINYBAR;
        
        // Transfer HBAR to user (using .call for safety)
        (bool success, ) = payable(msg.sender).call{value: tinybars}("");
        require(success, "HBAR transfer failed");
        
        emit AssetSold(msg.sender, tokenSymbol, tokenAmount, hbarAfterFeeWei, feeWei);
    }
    
    /**
     * @notice Add HBAR reserves to back assets (owner only)
     * @dev Distributes HBAR proportionally to all assets based on their market value
     * This increases the reserve ratio and provides more liquidity for sellers
     */
    function fundReserves() 
        external 
        payable 
        onlyOwner 
        nonReentrant 
    {
        require(msg.value > 0, "Must send HBAR");
        
        // Convert msg.value from tinybars to wei
        uint256 hbarWei = msg.value * WEI_PER_TINYBAR;
        
        // Get all assets and their market values
        string[7] memory assets = ["pTSLA", "pAAPL", "pBTC", "pETH", "pGOLD", "pSPY", "pTBILL"];
        uint256[] memory marketValues = new uint256[](7);
        uint256 totalMarketValue = 0;
        
        // Calculate market value for each asset
        for (uint256 i = 0; i < 7; i++) {
            uint256 supply = totalSupply[assets[i]];
            if (supply > 0) {
                try pythOracle.getPrice(_stripPrefix(assets[i])) returns (uint256 assetPrice) {
                    // supply is in wei (18 decimals), assetPrice is in 8 decimals
                    // marketValue = (supply * assetPrice) / 1e8 (result in wei equivalent)
                    marketValues[i] = (supply * assetPrice) / 1e8;
                    totalMarketValue += marketValues[i];
                } catch {
                    marketValues[i] = 0;
                }
            }
        }
        
        // Distribute reserves proportionally
        string[] memory updatedAssets = new string[](7);
        uint256[] memory addedAmounts = new uint256[](7);
        uint256 assetsUpdated = 0;
        
        if (totalMarketValue > 0) {
            // Distribute based on market value proportion
            for (uint256 i = 0; i < 7; i++) {
                if (marketValues[i] > 0) {
                    uint256 proportion = (hbarWei * marketValues[i]) / totalMarketValue;
                    assetReserves[assets[i]] += proportion;
                    updatedAssets[assetsUpdated] = assets[i];
                    addedAmounts[assetsUpdated] = proportion;
                    assetsUpdated++;
                }
            }
        } else {
            // No assets exist yet, distribute equally
            uint256 perAsset = hbarWei / 7;
            for (uint256 i = 0; i < 7; i++) {
                assetReserves[assets[i]] += perAsset;
                updatedAssets[i] = assets[i];
                addedAmounts[i] = perAsset;
            }
            assetsUpdated = 7;
        }
        
        // Trim arrays to actual size
        string[] memory finalAssets = new string[](assetsUpdated);
        uint256[] memory finalAmounts = new uint256[](assetsUpdated);
        for (uint256 i = 0; i < assetsUpdated; i++) {
            finalAssets[i] = updatedAssets[i];
            finalAmounts[i] = addedAmounts[i];
        }
        
        emit ReservesAdded(msg.sender, hbarWei, finalAssets, finalAmounts);
    }
    
    /**
     * @notice Add reserves to a specific asset (owner only)
     * @param tokenSymbol Asset to add reserves to
     */
    function fundAssetReserves(string memory tokenSymbol) 
        external 
        payable 
        onlyOwner 
        nonReentrant 
    {
        require(msg.value > 0, "Must send HBAR");
        require(supportedAssets[tokenSymbol], "Asset not supported");
        
        // Convert msg.value from tinybars to wei
        uint256 hbarWei = msg.value * WEI_PER_TINYBAR;
        
        // Add to specific asset reserves
        assetReserves[tokenSymbol] += hbarWei;
        
        // Create arrays for event
        string[] memory assets = new string[](1);
        uint256[] memory amounts = new uint256[](1);
        assets[0] = tokenSymbol;
        amounts[0] = hbarWei;
        
        emit ReservesAdded(msg.sender, hbarWei, assets, amounts);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get user's balance of an asset
     */
    function balanceOf(address user, string memory tokenSymbol) 
        external 
        view 
        returns (uint256) 
    {
        return balances[user][tokenSymbol];
    }
    
    /**
     * @notice Calculate how many tokens user would receive for HBAR
     * @param tokenSymbol Asset symbol
     * @param hbarAmount HBAR amount in wei (18 decimals)
     * @return tokensOut Tokens out in wei (18 decimals)
     * @return fee Fee in wei (18 decimals)
     */
    function getQuoteBuy(string memory tokenSymbol, uint256 hbarAmount) 
        external 
        view 
        returns (uint256 tokensOut, uint256 fee) 
    {
        require(supportedAssets[tokenSymbol], "Asset not supported");
        
        uint256 hbarPrice = pythOracle.getPrice("HBAR");
        uint256 assetPrice = pythOracle.getPrice(_stripPrefix(tokenSymbol));
        
        require(hbarPrice > 0 && assetPrice > 0, "Invalid prices");
        
        // hbarAmount is in wei (18 decimals)
        fee = (hbarAmount * buyFee) / FEE_DENOMINATOR;
        uint256 hbarAfterFee = hbarAmount - fee;
        
        // Calculate tokens (result in wei, 18 decimals)
        tokensOut = (hbarAfterFee * hbarPrice) / assetPrice;
    }
    
    /**
     * @notice Calculate how much HBAR user would receive for tokens
     * @param tokenSymbol Asset symbol
     * @param tokenAmount Token amount in wei (18 decimals)
     * @return hbarOut HBAR out in wei (18 decimals)
     * @return fee Fee in wei (18 decimals)
     */
    function getQuoteSell(string memory tokenSymbol, uint256 tokenAmount) 
        external 
        view 
        returns (uint256 hbarOut, uint256 fee) 
    {
        require(supportedAssets[tokenSymbol], "Asset not supported");
        
        uint256 hbarPrice = pythOracle.getPrice("HBAR");
        uint256 assetPrice = pythOracle.getPrice(_stripPrefix(tokenSymbol));
        
        require(hbarPrice > 0 && assetPrice > 0, "Invalid prices");
        
        // Calculate HBAR to return (in wei, 18 decimals)
        uint256 hbarToReturn = (tokenAmount * assetPrice) / hbarPrice;
        
        fee = (hbarToReturn * sellFee) / FEE_DENOMINATOR;
        hbarOut = hbarToReturn - fee;
    }
    
    /**
     * @notice Get current price of an asset in HBAR
     */
    function getAssetPriceInHbar(string memory tokenSymbol) 
        external 
        view 
        returns (uint256) 
    {
        uint256 hbarPrice = pythOracle.getPrice("HBAR");
        uint256 assetPrice = pythOracle.getPrice(_stripPrefix(tokenSymbol));
        
        require(hbarPrice > 0 && assetPrice > 0, "Invalid prices");
        
        // Return price with 18 decimals (1 token = X HBAR)
        return (assetPrice * 1e18) / hbarPrice;
    }
    
    /**
     * @notice Get all user balances
     */
    function getUserBalances(address user) 
        external 
        view 
        returns (
            string[] memory symbols,
            uint256[] memory amounts
        ) 
    {
        string[7] memory assets = ["pTSLA", "pAAPL", "pBTC", "pETH", "pGOLD", "pSPY", "pTBILL"];
        
        symbols = new string[](7);
        amounts = new uint256[](7);
        
        for (uint256 i = 0; i < 7; i++) {
            symbols[i] = assets[i];
            amounts[i] = balances[user][assets[i]];
        }
    }
    
    // ============ Proof of Reserves Functions ============
    
    /**
     * @notice Get reserve information for a specific asset
     * @param tokenSymbol Asset symbol (e.g., "pBTC", "pTSLA")
     * @return hbarReserve HBAR backing this asset (in tinybars, 8 decimals)
     * @return supply Total tokens minted (in wei, 18 decimals)
     * @return marketValue Current market value of all tokens (in USD, 8 decimals)
     * @return reserveRatio Reserve ratio (18 decimals, 1e18 = 100%)
     * @return healthy Whether reserves are adequate (>= 95%)
     */
    function getAssetReserveInfo(string memory tokenSymbol) external view returns (
        uint256 hbarReserve,
        uint256 supply,
        uint256 marketValue,
        uint256 reserveRatio,
        bool healthy
    ) {
        require(supportedAssets[tokenSymbol], "Asset not supported");
        
        hbarReserve = assetReserves[tokenSymbol];
        supply = totalSupply[tokenSymbol];
        
        // If no supply, reserves are healthy by default
        if (supply == 0) {
            return (hbarReserve, 0, 0, type(uint256).max, true);
        }
        
        // Get prices (both in 8 decimals - USD cents)
        uint256 assetPrice = pythOracle.getPrice(_stripPrefix(tokenSymbol));
        uint256 hbarPrice = pythOracle.getPrice("HBAR");
        
        // Calculate market value of all tokens
        // supply (18 decimals) * assetPrice (8 decimals) / 1e18 = USD value (8 decimals)
        marketValue = (supply * assetPrice) / 1e18;
        
        // Calculate reserve value in USD
        // hbarReserve (8 decimals) * hbarPrice (8 decimals) / 1e8 = USD value (8 decimals)
        uint256 reserveValue = (hbarReserve * hbarPrice) / 1e8;
        
        // Calculate ratio (should be ~100%)
        // reserveValue (8 decimals) * 1e18 / marketValue (8 decimals) = ratio (18 decimals)
        reserveRatio = (reserveValue * 1e18) / marketValue;
        healthy = reserveRatio >= 0.95e18; // 95% minimum
    }
    
    /**
     * @notice Get reserve information for all assets
     * @return symbols Array of asset symbols
     * @return reserves Array of HBAR reserves (in tinybars, 8 decimals)
     * @return supplies Array of total supplies (in wei, 18 decimals)
     * @return ratios Array of reserve ratios (18 decimals, 1e18 = 100%)
     */
    function getAllAssetReserves() external view returns (
        string[] memory symbols,
        uint256[] memory reserves,
        uint256[] memory supplies,
        uint256[] memory ratios
    ) {
        string[7] memory assets = ["pTSLA", "pAAPL", "pBTC", "pETH", "pGOLD", "pSPY", "pTBILL"];
        
        symbols = new string[](7);
        reserves = new uint256[](7);
        supplies = new uint256[](7);
        ratios = new uint256[](7);
        
        uint256 hbarPrice = pythOracle.getPrice("HBAR");
        
        for (uint256 i = 0; i < 7; i++) {
            symbols[i] = assets[i];
            reserves[i] = assetReserves[assets[i]];
            supplies[i] = totalSupply[assets[i]];
            
            // Calculate ratio
            if (supplies[i] == 0) {
                ratios[i] = type(uint256).max;
            } else {
                uint256 assetPrice = pythOracle.getPrice(_stripPrefix(assets[i]));
                
                // Market value: supply (18 decimals) * assetPrice (8 decimals) / 1e18 = USD (8 decimals)
                uint256 marketValue = (supplies[i] * assetPrice) / 1e18;
                
                // Reserve value: reserves (8 decimals) * hbarPrice (8 decimals) / 1e8 = USD (8 decimals)
                uint256 reserveValue = (reserves[i] * hbarPrice) / 1e8;
                
                // Ratio: reserveValue (8 decimals) * 1e18 / marketValue (8 decimals) = ratio (18 decimals)
                ratios[i] = (reserveValue * 1e18) / marketValue;
            }
        }
    }
    
    /**
     * @notice Get combined reserve information for all assets
     * @return totalHbarReserves Total HBAR across all asset pools (in tinybars, 8 decimals)
     * @return totalMarketValue Total market value of all assets (in USD, 8 decimals)
     * @return overallRatio Overall reserve ratio (18 decimals, 1e18 = 100%)
     * @return healthy Whether overall reserves are adequate (>= 95%)
     */
    function getTotalAssetReserves() external view returns (
        uint256 totalHbarReserves,
        uint256 totalMarketValue,
        uint256 overallRatio,
        bool healthy
    ) {
        string[7] memory assets = ["pTSLA", "pAAPL", "pBTC", "pETH", "pGOLD", "pSPY", "pTBILL"];
        
        uint256 hbarPrice = pythOracle.getPrice("HBAR");
        
        for (uint256 i = 0; i < 7; i++) {
            // Add HBAR reserves (in tinybars, 8 decimals)
            totalHbarReserves += assetReserves[assets[i]];
            
            // Add market value (in USD, 8 decimals)
            if (totalSupply[assets[i]] > 0) {
                uint256 assetPrice = pythOracle.getPrice(_stripPrefix(assets[i]));
                // supply (18 decimals) * assetPrice (8 decimals) / 1e18 = USD (8 decimals)
                totalMarketValue += (totalSupply[assets[i]] * assetPrice) / 1e18;
            }
        }
        
        // Calculate overall ratio
        if (totalMarketValue == 0) {
            overallRatio = type(uint256).max;
            healthy = true;
        } else {
            // totalHbarReserves (8 decimals) * hbarPrice (8 decimals) / 1e8 = USD (8 decimals)
            uint256 totalReserveValue = (totalHbarReserves * hbarPrice) / 1e8;
            // totalReserveValue (8 decimals) * 1e18 / totalMarketValue (8 decimals) = ratio (18 decimals)
            overallRatio = (totalReserveValue * 1e18) / totalMarketValue;
            healthy = overallRatio >= 0.95e18; // 95% minimum
        }
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Add a new supported asset
     */
    function addAsset(string memory tokenSymbol) external onlyOwner {
        _addAsset(tokenSymbol);
    }
    
    function _addAsset(string memory tokenSymbol) internal {
        require(!supportedAssets[tokenSymbol], "Asset already supported");
        supportedAssets[tokenSymbol] = true;
        emit AssetAdded(tokenSymbol);
    }
    
    /**
     * @notice Remove a supported asset
     */
    function removeAsset(string memory tokenSymbol) external onlyOwner {
        require(supportedAssets[tokenSymbol], "Asset not supported");
        require(totalSupply[tokenSymbol] == 0, "Asset has supply");
        supportedAssets[tokenSymbol] = false;
        emit AssetRemoved(tokenSymbol);
    }
    
    /**
     * @notice Update trading fees
     */
    function updateFees(uint256 _buyFee, uint256 _sellFee) external onlyOwner {
        require(_buyFee <= 500 && _sellFee <= 500, "Fee too high"); // Max 5%
        buyFee = _buyFee;
        sellFee = _sellFee;
        emit FeesUpdated(_buyFee, _sellFee);
    }
    
    /**
     * @notice Update fee collector address
     */
    function updateFeeCollector(address _feeCollector) external onlyOwner {
        require(_feeCollector != address(0), "Invalid address");
        feeCollector = _feeCollector;
        emit FeeCollectorUpdated(_feeCollector);
    }
    
    /**
     * @notice Withdraw accumulated fees
     */
    function withdrawFees() external {
        require(msg.sender == feeCollector || msg.sender == owner(), "Not authorized");
        require(accumulatedFees > 0, "No fees to withdraw");
        
        uint256 amount = accumulatedFees;
        accumulatedFees = 0;
        
        (bool success, ) = payable(feeCollector).call{value: amount}("");
        require(success, "Fee withdrawal failed");
        emit FeesWithdrawn(feeCollector, amount);
    }
    
    /**
     * @notice Add HBAR reserves to a specific asset
     * @dev Allows admin to manually add liquidity to asset reserves
     */
    function addReserves(string memory tokenSymbol) external payable onlyOwner {
        require(supportedAssets[tokenSymbol], "Asset not supported");
        require(msg.value > 0, "Must send HBAR");
        
        assetReserves[tokenSymbol] += msg.value;
    }
    
    /**
     * @notice Update Pyth oracle
     */
    function updateOracle(address _pythOracle) external onlyOwner {
        require(_pythOracle != address(0), "Invalid oracle");
        pythOracle = IPriceOracle(_pythOracle);
    }
    
    /**
     * @notice Emergency withdraw (only if no supply exists)
     */
    function emergencyWithdraw() external onlyOwner {
        // Check no assets have supply
        require(totalSupply["pTSLA"] == 0, "pTSLA has supply");
        require(totalSupply["pAAPL"] == 0, "pAAPL has supply");
        require(totalSupply["pBTC"] == 0, "pBTC has supply");
        require(totalSupply["pETH"] == 0, "pETH has supply");
        require(totalSupply["pGOLD"] == 0, "pGOLD has supply");
        require(totalSupply["pSPY"] == 0, "pSPY has supply");
        require(totalSupply["pTBILL"] == 0, "pTBILL has supply");
        
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Emergency withdrawal failed");
    }
    
    // ============ Internal Helper Functions ============
    
    /**
     * @notice Strip 'p' prefix from token symbol for oracle lookup
     * @dev pTSLA -> TSLA, pBTC -> BTC, etc.
     */
    function _stripPrefix(string memory tokenSymbol) internal pure returns (string memory) {
        bytes memory symbolBytes = bytes(tokenSymbol);
        require(symbolBytes.length > 1 && symbolBytes[0] == 'p', "Invalid symbol");
        
        bytes memory result = new bytes(symbolBytes.length - 1);
        for (uint i = 1; i < symbolBytes.length; i++) {
            result[i - 1] = symbolBytes[i];
        }
        return string(result);
    }
    
    // ============ Receive Function ============
    
    receive() external payable {
        // Allow contract to receive HBAR
    }
}
