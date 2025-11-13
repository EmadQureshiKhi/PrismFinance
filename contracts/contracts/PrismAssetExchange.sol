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
        
        // Get prices from oracle
        uint256 hbarPrice = pythOracle.getPrice("HBAR");
        uint256 assetPrice = pythOracle.getPrice(oracleSymbol);
        
        require(hbarPrice > 0 && assetPrice > 0, "Invalid prices");
        
        // Calculate fee
        uint256 fee = (msg.value * buyFee) / FEE_DENOMINATOR;
        uint256 hbarAfterFee = msg.value - fee;
        
        // Calculate tokens to mint
        // On Hedera, msg.value is in tinybars (8 decimals), not wei (18 decimals)
        // hbarAfterFee: 8 decimals (tinybars), hbarPrice: 8 decimals, assetPrice: 8 decimals
        // We want result in 18 decimals for ERC20 compatibility
        // (8 decimals * 8 decimals * 1e18) / (8 decimals * 1e8) = 18 decimals
        uint256 tokensToMint = (hbarAfterFee * hbarPrice * 1e18) / (assetPrice * 1e8);
        
        require(tokensToMint >= minTokensOut, "Slippage exceeded");
        require(tokensToMint > 0, "Amount too small");
        
        // Update state
        balances[msg.sender][tokenSymbol] += tokensToMint;
        totalSupply[tokenSymbol] += tokensToMint;
        assetReserves[tokenSymbol] += hbarAfterFee;
        accumulatedFees += fee;
        
        emit AssetPurchased(msg.sender, tokenSymbol, msg.value, tokensToMint, fee);
    }
    
    /**
     * @notice Sell synthetic asset for HBAR
     * @param tokenSymbol Asset to sell (e.g., "pTSLA")
     * @param tokenAmount Amount of tokens to sell
     * @param minHbarOut Minimum HBAR to receive (slippage protection)
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
        
        // Get prices from oracle
        uint256 hbarPrice = pythOracle.getPrice("HBAR");
        uint256 assetPrice = pythOracle.getPrice(oracleSymbol);
        
        require(hbarPrice > 0 && assetPrice > 0, "Invalid prices");
        
        // Calculate HBAR to return (18 decimals)
        // tokenAmount: 18 decimals, assetPrice: 8 decimals, hbarPrice: 8 decimals
        // (18 decimals * 8 decimals) / 8 decimals = 18 decimals ✓
        uint256 hbarToReturn = (tokenAmount * assetPrice) / hbarPrice;
        
        // Calculate fee
        uint256 fee = (hbarToReturn * sellFee) / FEE_DENOMINATOR;
        uint256 hbarAfterFee = hbarToReturn - fee;
        
        require(hbarAfterFee >= minHbarOut, "Slippage exceeded");
        require(assetReserves[tokenSymbol] >= hbarToReturn, "Insufficient reserves");
        
        // Update state
        balances[msg.sender][tokenSymbol] -= tokenAmount;
        totalSupply[tokenSymbol] -= tokenAmount;
        assetReserves[tokenSymbol] -= hbarToReturn;
        accumulatedFees += fee;
        
        // Transfer HBAR to user (using .call for safety)
        (bool success, ) = payable(msg.sender).call{value: hbarAfterFee}("");
        require(success, "HBAR transfer failed");
        
        emit AssetSold(msg.sender, tokenSymbol, tokenAmount, hbarAfterFee, fee);
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
        
        fee = (hbarAmount * buyFee) / FEE_DENOMINATOR;
        uint256 hbarAfterFee = hbarAmount - fee;
        
        tokensOut = (hbarAfterFee * hbarPrice) / assetPrice;
    }
    
    /**
     * @notice Calculate how much HBAR user would receive for tokens
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
