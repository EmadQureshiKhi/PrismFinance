// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PrismReserveOracle.sol";
import "./interfaces/IPriceOracle.sol";
import "./PrismPerpsVault.sol";
import "./PrismPerpsEngine.sol";

/**
 * @title PrismVaultV2
 * @notice Fixed vault with proper wei/tinybar handling and real price feeds
 * @dev All internal accounting uses wei (18 decimals) to match EVM standard
 */
contract PrismVaultV2 {
    // State variables
    address public admin;
    PrismReserveOracle public oracle;
    IPriceOracle public priceOracle;
    
    // Hedera token IDs (stored as addresses for EVM compatibility)
    mapping(string => address) public tokenAddresses;
    
    // User positions: user => token => amount (in wei)
    mapping(address => mapping(string => uint256)) public positions;
    
    // Total minted per token (in wei)
    mapping(string => uint256) public totalMinted;
    
    // Collateral per user (in wei)
    mapping(address => uint256) public userCollateral;
    
    // ============ Yield System State Variables ============
    
    // Yield tracking per user
    mapping(address => uint256) public lastYieldClaim;     // Last claim timestamp
    mapping(address => uint256) public accruedYield;       // Accrued yield in wei
    mapping(address => uint256) public yieldStartTime;     // When user started earning yield
    
    // Yield reserve and rates
    uint256 public yieldReserve;                           // HBAR available for yield (in wei)
    uint256 public constant BASE_APY = 1000;               // 10% APY (basis points)
    uint256 public constant LST_BONUS_APY = 300;           // 3% bonus APY (basis points)
    uint256 public constant MAX_APY = 1500;                // 15% max APY (basis points)
    uint256 public constant SECONDS_PER_YEAR = 31536000;   // 365 days
    
    // Yield statistics
    uint256 public totalYieldPaid;                         // Total yield paid out (in wei)
    uint256 public totalYieldAccrued;                      // Total yield accrued (in wei)
    
    // ============ Delta-Neutral Hedging State Variables ============
    
    // Perps integration
    PrismPerpsVault public perpsVault;
    PrismPerpsEngine public perpsEngine;
    
    // Hedge settings
    bool public hedgingEnabled = true;
    uint256 public hedgeRatio = 9000;                      // 90% hedged (basis points)
    uint256 public hedgeLeverage = 1;                      // 1x leverage for safety
    
    // User hedge positions
    struct UserHedge {
        bytes32 perpsPositionId;                           // Position ID in perps engine
        uint256 collateralAmount;                          // HBAR deposited to vault (wei)
        uint256 hedgedAmount;                              // Amount hedged (wei)
        uint256 perpsCollateral;                           // Collateral locked in perps (wei)
        uint256 entryPrice;                                // Entry price (8 decimals)
        uint256 timestamp;                                 // When created
        bool isActive;                                     // Is hedge active
    }
    
    mapping(address => UserHedge) public userHedges;
    
    // Constants
    uint256 public constant MIN_COLLATERAL_RATIO = 150; // 150%
    uint256 public constant LIQUIDATION_RATIO = 130; // 130%
    uint256 public constant LIQUIDATION_PENALTY = 10; // 10%
    
    // Conversion: 1 tinybar = 10^10 wei (Hedera specific)
    uint256 public constant WEI_PER_TINYBAR = 10_000_000_000;
    uint256 public constant TINYBARS_PER_HBAR = 100_000_000;
    
    // Events
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Mint(address indexed user, string token, uint256 amount);
    event Burn(address indexed user, string token, uint256 amount);
    event Liquidation(address indexed user, address indexed liquidator, uint256 collateralSeized);
    
    // Yield events
    event YieldAccrued(address indexed user, uint256 amount);
    event YieldClaimed(address indexed user, uint256 amount);
    event YieldReserveFunded(uint256 amount);
    
    // Hedging events
    event HedgeOpened(address indexed user, bytes32 positionId, uint256 hedgedAmount);
    event HedgeClosed(address indexed user, bytes32 positionId, int256 pnl);
    event HedgeAdjusted(address indexed user, bytes32 oldPositionId, bytes32 newPositionId);
    event HedgingToggled(bool enabled);
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    constructor(address _oracle, address _priceOracle) {
        admin = msg.sender;
        oracle = PrismReserveOracle(payable(_oracle));
        priceOracle = IPriceOracle(_priceOracle);
    }
    
    /**
     * @notice Register a token address
     */
    function registerToken(string memory symbol, address tokenAddress) external onlyAdmin {
        tokenAddresses[symbol] = tokenAddress;
    }
    
    /**
     * @notice Set perps contracts for delta-neutral hedging
     */
    function setPerpsContracts(address _perpsVault, address _perpsEngine) external onlyAdmin {
        perpsVault = PrismPerpsVault(_perpsVault);
        perpsEngine = PrismPerpsEngine(_perpsEngine);
    }
    
    /**
     * @notice Toggle hedging on/off
     */
    function setHedgingEnabled(bool _enabled) external onlyAdmin {
        hedgingEnabled = _enabled;
        emit HedgingToggled(_enabled);
    }
    
    /**
     * @notice Set hedge ratio (basis points)
     */
    function setHedgeRatio(uint256 _ratio) external onlyAdmin {
        require(_ratio <= 10000, "Ratio cannot exceed 100%");
        hedgeRatio = _ratio;
    }
    
    /**
     * @notice Deposit HBAR collateral
     * @dev Hedera converts msg.value to tinybars automatically!
     * So msg.value is actually in tinybars (8 decimals), not wei (18 decimals)
     * We need to convert to wei for internal accounting
     */
    function depositCollateral() external payable {
        require(msg.value > 0, "Must deposit HBAR");
        
        // msg.value is in tinybars on Hedera, convert to wei for consistency
        uint256 weiAmount = msg.value * WEI_PER_TINYBAR;
        
        // Store collateral in wei
        userCollateral[msg.sender] += weiAmount;
        
        // Forward to oracle for custody
        oracle.depositCollateral{value: msg.value}();
        
        emit Deposit(msg.sender, weiAmount);
    }
    
    /**
     * @notice Withdraw HBAR collateral
     * @param amount Amount in wei (will be converted to tinybars for transfer)
     */
    function withdrawCollateral(uint256 amount) external {
        require(amount <= userCollateral[msg.sender], "Insufficient collateral");
        require(_checkUserHealth(msg.sender, amount, 0, ""), "Would break collateral ratio");
        
        userCollateral[msg.sender] -= amount;
        
        // Convert wei to tinybars for oracle withdrawal
        uint256 tinybars = amount / WEI_PER_TINYBAR;
        
        // Pull HBAR from oracle
        oracle.withdrawForVault(payable(msg.sender), tinybars);
        
        emit Withdraw(msg.sender, amount);
        
        // Close or adjust hedge based on remaining collateral
        if (userCollateral[msg.sender] == 0) {
            _closeHedgePosition(msg.sender, false); // Keep funds in perps vault for future hedges
        } else {
            _adjustHedgePosition(msg.sender);
        }
    }
    
    /**
     * @notice Mint synthetic tokens
     * @param token Token symbol (e.g., "pUSD", "pBTC")
     * @param amount Amount to mint (in wei for consistency)
     */
    function mint(string memory token, uint256 amount) external {
        require(tokenAddresses[token] != address(0), "Token not registered");
        require(amount > 0, "Amount must be > 0");
        require(_checkUserHealth(msg.sender, 0, amount, token), "Insufficient collateral");
        
        positions[msg.sender][token] += amount;
        totalMinted[token] += amount;
        
        emit Mint(msg.sender, token, amount);
        
        // Update oracle with new total debt
        _updateOracleDebt();
    }
    
    /**
     * @notice Deposit HBAR and mint tokens in one atomic transaction
     * @param token Token symbol to mint
     * @param mintAmount Amount to mint (in wei)
     */
    function depositAndMint(string memory token, uint256 mintAmount) external payable {
        require(msg.value > 0, "Must deposit HBAR");
        require(mintAmount > 0, "Must mint tokens");
        require(tokenAddresses[token] != address(0), "Token not registered");
        
        // Step 1: Update yield tracking before deposit
        if (userCollateral[msg.sender] > 0) {
            accruedYield[msg.sender] = calculateYield(msg.sender);
        }
        lastYieldClaim[msg.sender] = block.timestamp;
        
        // Step 2: Deposit collateral
        uint256 weiAmount = msg.value * WEI_PER_TINYBAR;
        userCollateral[msg.sender] += weiAmount;
        oracle.depositCollateral{value: msg.value}();
        emit Deposit(msg.sender, weiAmount);
        
        // Step 2.5: Adjust hedge position for new collateral amount
        _adjustHedgePosition(msg.sender);
        
        // Step 3: Mint tokens (in same transaction)
        require(_checkUserHealth(msg.sender, 0, mintAmount, token), "Insufficient collateral");
        positions[msg.sender][token] += mintAmount;
        totalMinted[token] += mintAmount;
        emit Mint(msg.sender, token, mintAmount);
        
        // Step 4: Update oracle with new total debt
        _updateOracleDebt();
    }
    
    /**
     * @notice Burn synthetic tokens
     */
    function burn(string memory token, uint256 amount) external {
        require(amount <= positions[msg.sender][token], "Insufficient position");
        
        positions[msg.sender][token] -= amount;
        totalMinted[token] -= amount;
        
        emit Burn(msg.sender, token, amount);
        
        // Update oracle with new total debt
        _updateOracleDebt();
    }
    
    /**
     * @notice Burn tokens and withdraw HBAR in one atomic transaction
     * @param token Token symbol to burn
     * @param burnAmount Amount to burn (in wei)
     * @param withdrawAmount Amount to withdraw (in wei)
     */
    function burnAndWithdraw(string memory token, uint256 burnAmount, uint256 withdrawAmount) external {
        require(burnAmount > 0 || withdrawAmount > 0, "Must burn or withdraw");
        
        // Step 1: Update yield tracking before position changes
        if (userCollateral[msg.sender] > 0) {
            accruedYield[msg.sender] = calculateYield(msg.sender);
        }
        lastYieldClaim[msg.sender] = block.timestamp;
        
        // Step 2: Burn tokens
        if (burnAmount > 0) {
            require(burnAmount <= positions[msg.sender][token], "Insufficient position");
            positions[msg.sender][token] -= burnAmount;
            totalMinted[token] -= burnAmount;
            emit Burn(msg.sender, token, burnAmount);
        }
        
        // Step 3: Withdraw collateral (in same transaction)
        if (withdrawAmount > 0) {
            require(withdrawAmount <= userCollateral[msg.sender], "Insufficient collateral");
            require(_checkUserHealth(msg.sender, withdrawAmount, 0, ""), "Would break collateral ratio");
            userCollateral[msg.sender] -= withdrawAmount;
            uint256 tinybars = withdrawAmount / WEI_PER_TINYBAR;
            oracle.withdrawForVault(payable(msg.sender), tinybars);
            emit Withdraw(msg.sender, withdrawAmount);
            
            // Close or adjust hedge based on remaining collateral
            if (userCollateral[msg.sender] == 0) {
                _closeHedgePosition(msg.sender, false); // Keep funds in perps vault for future hedges
            } else {
                _adjustHedgePosition(msg.sender);
            }
        }
        
        // Step 4: Update oracle with new total debt
        _updateOracleDebt();
    }
    
    /**
     * @notice Liquidate undercollateralized position
     */
    function liquidate(address user) external {
        require(_getUserCollateralRatio(user) < LIQUIDATION_RATIO, "Position is healthy");
        
        uint256 collateralToSeize = userCollateral[user];
        uint256 penalty = (collateralToSeize * LIQUIDATION_PENALTY) / 100;
        uint256 liquidatorReward = penalty;
        
        // Clear user position
        userCollateral[user] = 0;
        
        // Reward liquidator
        (bool success, ) = msg.sender.call{value: liquidatorReward}("");
        require(success, "Transfer failed");
        
        emit Liquidation(user, msg.sender, collateralToSeize);
    }
    
    /**
     * @notice Get user's collateral ratio
     */
    function getUserCollateralRatio(address user) external view returns (uint256) {
        return _getUserCollateralRatio(user);
    }
    
    /**
     * @notice Get user's total debt value in HBAR (wei)
     * @dev Converts each synthetic asset to HBAR value using price oracle
     */
    function getUserDebtValue(address user) public view returns (uint256) {
        uint256 totalDebtInHbar = 0;
        
        // Get HBAR price (8 decimals, e.g., 20000000 = $0.20)
        uint256 hbarPrice = priceOracle.getPrice("HBAR");
        
        // Helper function to convert asset to HBAR value
        totalDebtInHbar += _convertToHbarValue(positions[user]["pUSD"], "USD", hbarPrice);
        totalDebtInHbar += _convertToHbarValue(positions[user]["pEUR"], "EUR", hbarPrice);
        totalDebtInHbar += _convertToHbarValue(positions[user]["pGBP"], "GBP", hbarPrice);
        totalDebtInHbar += _convertToHbarValue(positions[user]["pJPY"], "JPY", hbarPrice);
        totalDebtInHbar += _convertToHbarValue(positions[user]["pHKD"], "HKD", hbarPrice);
        totalDebtInHbar += _convertToHbarValue(positions[user]["pAED"], "AED", hbarPrice);
        totalDebtInHbar += _convertToHbarValue(positions[user]["pTSLA"], "TSLA", hbarPrice);
        totalDebtInHbar += _convertToHbarValue(positions[user]["pAAPL"], "AAPL", hbarPrice);
        totalDebtInHbar += _convertToHbarValue(positions[user]["pTBILL"], "TBILL", hbarPrice);
        totalDebtInHbar += _convertToHbarValue(positions[user]["pGOLD"], "GOLD", hbarPrice);
        totalDebtInHbar += _convertToHbarValue(positions[user]["pSPY"], "SPY", hbarPrice);
        totalDebtInHbar += _convertToHbarValue(positions[user]["pBTC"], "BTC", hbarPrice);
        totalDebtInHbar += _convertToHbarValue(positions[user]["pETH"], "ETH", hbarPrice);
        
        return totalDebtInHbar;
    }
    
    /**
     * @notice Convert asset amount to HBAR value
     * @param amount Amount of asset (in wei, 18 decimals)
     * @param assetSymbol Asset symbol (without 'p' prefix)
     * @param hbarPrice HBAR price in USD (8 decimals)
     * @return HBAR value (in wei, 18 decimals)
     */
    function _convertToHbarValue(
        uint256 amount,
        string memory assetSymbol,
        uint256 hbarPrice
    ) internal view returns (uint256) {
        if (amount == 0) return 0;
        
        // Get asset price in USD (8 decimals)
        uint256 assetPrice = priceOracle.getPrice(assetSymbol);
        
        // Convert: (amount * assetPrice) / hbarPrice
        // amount is 18 decimals, prices are 8 decimals
        // Result should be 18 decimals (wei)
        return (amount * assetPrice) / hbarPrice;
    }
    
    /**
     * @notice Get comprehensive user position data
     * @param user User address
     * @return collateral User's HBAR collateral (in wei)
     * @return debt User's total debt value in HBAR (in wei)
     * @return ratio Collateral ratio (percentage, 150 = 150%)
     * @return healthy Whether position is healthy
     */
    function getUserPosition(address user) external view returns (
        uint256 collateral,
        uint256 debt,
        uint256 ratio,
        bool healthy
    ) {
        collateral = userCollateral[user];
        debt = getUserDebtValue(user);
        ratio = _getUserCollateralRatio(user);
        healthy = ratio >= MIN_COLLATERAL_RATIO;
    }
    
    /**
     * @notice Get maximum mintable amount for a token
     * @param user User address
     * @param token Token symbol (e.g., "pUSD")
     * @return maxMintable Maximum amount user can mint (in wei)
     */
    function getMaxMintable(address user, string memory token) external view returns (uint256) {
        uint256 collateral = userCollateral[user];
        if (collateral == 0) return 0;
        
        // Calculate max debt in HBAR (150% collateral ratio)
        // maxDebt = collateral / 1.5 = collateral * 100 / 150
        uint256 maxDebtInHbar = (collateral * 100) / MIN_COLLATERAL_RATIO;
        
        // Get current debt
        uint256 currentDebt = getUserDebtValue(user);
        
        // Available debt capacity
        if (maxDebtInHbar <= currentDebt) return 0;
        uint256 availableDebt = maxDebtInHbar - currentDebt;
        
        // Convert to token amount
        uint256 hbarPrice = priceOracle.getPrice("HBAR");
        uint256 tokenPrice = priceOracle.getPrice(_removePPrefix(token));
        
        // availableDebt is in HBAR (wei), convert to token amount
        // (availableDebt * hbarPrice) / tokenPrice
        // Both prices are 8 decimals, result is 18 decimals (wei)
        uint256 maxMintable = (availableDebt * hbarPrice) / tokenPrice;
        
        return maxMintable;
    }
    
    /**
     * @notice Get all user positions for all tokens
     * @param user User address
     * @return tokens Array of token symbols
     * @return amounts Array of position amounts (in wei)
     */
    function getUserPositions(address user) external view returns (
        string[] memory tokens,
        uint256[] memory amounts
    ) {
        // Define all supported tokens
        string[13] memory allTokens = [
            "pUSD", "pEUR", "pGBP", "pJPY", "pHKD", "pAED",
            "pTSLA", "pAAPL", "pTBILL", "pGOLD", "pSPY", "pBTC", "pETH"
        ];
        
        tokens = new string[](13);
        amounts = new uint256[](13);
        
        for (uint256 i = 0; i < 13; i++) {
            tokens[i] = allTokens[i];
            amounts[i] = positions[user][allTokens[i]];
        }
    }
    
    /**
     * @notice Helper to remove 'p' prefix from token symbol
     */
    function _removePPrefix(string memory symbol) internal pure returns (string memory) {
        bytes memory symbolBytes = bytes(symbol);
        require(symbolBytes.length > 1 && symbolBytes[0] == 'p', "Invalid symbol");
        
        bytes memory result = new bytes(symbolBytes.length - 1);
        for (uint i = 1; i < symbolBytes.length; i++) {
            result[i - 1] = symbolBytes[i];
        }
        return string(result);
    }
    
    /**
     * @notice Get total vault stats
     */
    function getVaultStats() external view returns (
        uint256 totalCollateral,
        uint256 totalDebt,
        uint256 globalRatio
    ) {
        // Get total collateral across all users (in wei)
        uint256 totalCol = address(this).balance;
        
        // Calculate total debt (in wei)
        uint256 totalDebtValue = 0;
        // Note: In production, iterate through all users or maintain a total
        // For now, this is simplified
        
        uint256 ratio = totalDebtValue > 0 ? (totalCol * 100) / totalDebtValue : type(uint256).max;
        
        return (totalCol, totalDebtValue, ratio);
    }
    
    // Internal functions
    
    function _getUserCollateralRatio(address user) internal view returns (uint256) {
        uint256 debt = getUserDebtValue(user);
        if (debt == 0) return type(uint256).max;
        
        // Both in wei, so ratio calculation is straightforward
        return (userCollateral[user] * 100) / debt;
    }
    
    function _checkUserHealth(
        address user,
        uint256 withdrawAmount,
        uint256 mintAmount,
        string memory token
    ) internal view returns (bool) {
        uint256 newCollateral = userCollateral[user] - withdrawAmount;
        
        // Convert mintAmount to HBAR value using prices
        uint256 mintAmountInHbar = 0;
        if (mintAmount > 0 && bytes(token).length > 0) {
            string memory assetSymbol = _removePPrefix(token);
            uint256 hbarPrice = priceOracle.getPrice("HBAR");
            uint256 assetPrice = priceOracle.getPrice(assetSymbol);
            mintAmountInHbar = (mintAmount * assetPrice) / hbarPrice;
        }
        
        uint256 newDebt = getUserDebtValue(user) + mintAmountInHbar;
        
        if (newDebt == 0) return true;
        
        uint256 newRatio = (newCollateral * 100) / newDebt;
        return newRatio >= MIN_COLLATERAL_RATIO;
    }
    
    /**
     * @notice Update oracle with current total debt
     * @dev Called after every mint/burn operation
     * Oracle expects debt in USD cents (8 decimals)
     */
    function _updateOracleDebt() internal {
        // Calculate total debt across all tokens in USD (8 decimals)
        uint256 totalDebtInUsd = 0;
        
        string[13] memory allTokens = [
            "pUSD", "pEUR", "pGBP", "pJPY", "pHKD", "pAED",
            "pTSLA", "pAAPL", "pTBILL", "pGOLD", "pSPY", "pBTC", "pETH"
        ];
        
        for (uint256 i = 0; i < 13; i++) {
            uint256 supply = totalMinted[allTokens[i]];
            if (supply > 0) {
                // Get token price in USD (8 decimals)
                string memory assetSymbol = _removePPrefix(allTokens[i]);
                uint256 tokenPrice = priceOracle.getPrice(assetSymbol);
                
                // Convert token amount (18 decimals) to USD value (8 decimals)
                // supply * tokenPrice / 1e18 = USD value in 8 decimals
                totalDebtInUsd += (supply * tokenPrice) / 1e18;
            }
        }
        
        // Update oracle (totalDebtInUsd is in 8 decimals - USD cents)
        oracle.updateSyntheticValue(totalDebtInUsd);
    }
    
    // ============ Yield System Functions ============
    
    /**
     * @notice Calculate accrued yield for a user
     * @param user User address
     * @return Total accrued yield in wei
     */
    function calculateYield(address user) public view returns (uint256) {
        uint256 collateral = userCollateral[user];
        if (collateral == 0) return accruedYield[user];
        
        uint256 timeElapsed = block.timestamp - lastYieldClaim[user];
        if (timeElapsed == 0) return accruedYield[user];
        
        // Calculate base yield: (collateral * BASE_APY * timeElapsed) / (10000 * 365 days)
        uint256 baseYield = (collateral * BASE_APY * timeElapsed) / (10000 * 365 days);
        
        // Calculate LST bonus: (collateral * LST_BONUS_APY * timeElapsed) / (10000 * 365 days)
        uint256 lstBonus = (collateral * LST_BONUS_APY * timeElapsed) / (10000 * 365 days);
        
        return baseYield + lstBonus + accruedYield[user];
    }
    
    /**
     * @notice Get current APY rates
     * @return base Base APY in basis points (1000 = 10%)
     * @return bonus LST bonus APY in basis points (300 = 3%)
     */
    function getCurrentAPY() public pure returns (uint256 base, uint256 bonus) {
        return (BASE_APY, LST_BONUS_APY);
    }
    
    /**
     * @notice Claim accrued yield
     * @dev Transfers yield to user in HBAR
     */
    function claimYield() external {
        uint256 yield = calculateYield(msg.sender);
        require(yield > 0, "No yield to claim");
        require(yieldReserve >= yield, "Insufficient yield reserve");
        
        // Update state
        accruedYield[msg.sender] = 0;
        lastYieldClaim[msg.sender] = block.timestamp;
        yieldReserve -= yield;
        totalYieldPaid += yield;
        
        // Convert wei to tinybars for transfer
        uint256 tinybars = yield / WEI_PER_TINYBAR;
        
        // Transfer HBAR to user
        (bool success, ) = msg.sender.call{value: tinybars}("");
        require(success, "Transfer failed");
        
        emit YieldClaimed(msg.sender, yield);
    }
    
    /**
     * @notice Fund the yield reserve (admin only)
     * @dev Receives HBAR and adds to yield reserve
     */
    function fundYieldReserve() external payable onlyAdmin {
        uint256 weiAmount = msg.value * WEI_PER_TINYBAR;
        yieldReserve += weiAmount;
        emit YieldReserveFunded(weiAmount);
    }
    
    /**
     * @notice Emergency withdraw (admin only)
     */
    function emergencyWithdraw(address payable recipient, uint256 amount) external onlyAdmin {
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");
    }
    
    // ============ Delta-Neutral Hedging Functions ============
    
    /**
     * @notice Adjust hedge position based on current collateral
     * @dev Closes existing hedge and opens new one with updated size
     */
    function _adjustHedgePosition(address user) internal {
        if (!hedgingEnabled || address(perpsEngine) == address(0)) return;
        
        uint256 currentCollateral = userCollateral[user];
        if (currentCollateral == 0) return;
        
        UserHedge storage hedge = userHedges[user];
        
        // If hedge exists, close it first
        if (hedge.isActive) {
            try perpsEngine.closePosition(hedge.perpsPositionId) {
                hedge.isActive = false;
            } catch {
                // If close fails, skip adjustment and keep old hedge
                return;
            }
        }
        
        // Open new hedge with current collateral amount
        uint256 targetHedgedAmount = (currentCollateral * hedgeRatio) / 10000;
        uint256 targetPerpsCollateral = targetHedgedAmount / hedgeLeverage;
        
        // Check if we have enough balance
        uint256 availableBalance = perpsVault.getAvailableBalance(address(this));
        if (availableBalance < targetPerpsCollateral) {
            // Not enough balance, skip hedging
            return;
        }
        
        _openNewHedge(user, currentCollateral, targetHedgedAmount, targetPerpsCollateral);
    }
    
    /**
     * @notice Open a new hedge position
     * @dev Internal helper for _adjustHedgePosition
     */
    function _openNewHedge(address user, uint256 collateralAmount, uint256 hedgedAmount, uint256 perpsCollateral) internal {
        // Check if vault has enough balance in perps vault
        uint256 availableBalance = perpsVault.getAvailableBalance(address(this));
        if (availableBalance < perpsCollateral) {
            // Not enough balance, skip hedging
            return;
        }
        
        // Open SHORT position (hedge against HBAR price drop)
        bytes32 positionId = perpsVault.openPositionForVault(
            false,              // SHORT
            perpsCollateral,    // collateral amount
            hedgeLeverage       // 1x leverage
        );
        
        // Get entry price
        uint256 entryPrice = priceOracle.getPrice("HBAR");
        
        // Store hedge info
        userHedges[user] = UserHedge({
            perpsPositionId: positionId,
            collateralAmount: collateralAmount,
            hedgedAmount: hedgedAmount,
            perpsCollateral: perpsCollateral,
            entryPrice: entryPrice,
            timestamp: block.timestamp,
            isActive: true
        });
        
        emit HedgeOpened(user, positionId, hedgedAmount);
    }
    
    /**
     * @notice Close hedge position when user withdraws all
     * @param withdrawCollateral Whether to withdraw collateral from perps vault
     */
    function _closeHedgePosition(address user, bool withdrawCollateral) internal {
        UserHedge storage hedge = userHedges[user];
        if (!hedge.isActive) return;
        
        // Close perps position
        perpsEngine.closePosition(hedge.perpsPositionId);
        
        // Only withdraw if requested (e.g., when user fully exits)
        if (withdrawCollateral) {
            uint256 perpsBalance = perpsVault.getAvailableBalance(address(this));
            if (perpsBalance > 0) {
                perpsVault.withdrawCollateral(perpsBalance);
            }
        }
        
        // Mark hedge as inactive
        hedge.isActive = false;
        
        emit HedgeClosed(user, hedge.perpsPositionId, 0);
    }
    
    /**
     * @notice Get user's effective collateral including hedge P&L
     */
    function getEffectiveCollateral(address user) public view returns (uint256) {
        uint256 collateral = userCollateral[user];
        UserHedge memory hedge = userHedges[user];
        
        if (!hedge.isActive || address(perpsEngine) == address(0)) return collateral;
        
        // Get position info from perps engine
        (
            bool isLong,
            uint256 size,
            ,  // collateral
            ,  // leverage
            uint256 entryPrice,
            uint256 currentPrice,
            ,  // unrealizedPnL
            ,  // liquidationPrice
               // marginRatio
        ) = perpsEngine.getPositionInfoById(hedge.perpsPositionId);
        
        if (size == 0) return collateral;
        
        // Calculate P&L (SHORT position)
        int256 priceDiff = int256(entryPrice) - int256(currentPrice);
        int256 pnl = (int256(size) * priceDiff) / int256(entryPrice);
        
        // Add P&L to collateral
        if (pnl >= 0) {
            return collateral + uint256(pnl);
        } else {
            uint256 loss = uint256(-pnl);
            return collateral > loss ? collateral - loss : 0;
        }
    }
    
    /**
     * @notice Get user's hedge position details
     */
    function getUserHedgeInfo(address user) external view returns (
        bool isActive,
        uint256 hedgedAmount,
        uint256 entryPrice,
        uint256 currentPrice,
        int256 pnl,
        uint256 effectiveCollateral
    ) {
        UserHedge memory hedge = userHedges[user];
        isActive = hedge.isActive;
        hedgedAmount = hedge.hedgedAmount;
        entryPrice = hedge.entryPrice;
        
        if (!isActive || address(perpsEngine) == address(0)) {
            return (false, 0, 0, 0, 0, userCollateral[user]);
        }
        
        // Get position info from perps engine
        (
            ,  // isLong
            uint256 size,
            ,  // collateral
            ,  // leverage
            uint256 posEntryPrice,
            uint256 posCurrentPrice,
            ,  // unrealizedPnL
            ,  // liquidationPrice
               // marginRatio
        ) = perpsEngine.getPositionInfoById(hedge.perpsPositionId);
        
        currentPrice = posCurrentPrice;
        
        if (size > 0) {
            int256 priceDiff = int256(posEntryPrice) - int256(currentPrice);
            pnl = (int256(size) * priceDiff) / int256(posEntryPrice);
        } else {
            pnl = 0;
        }
        
        effectiveCollateral = getEffectiveCollateral(user);
    }
    
    /**
     * @notice Helper to convert wei to HBAR for display
     */
    function weiToHbar(uint256 weiAmount) public pure returns (uint256) {
        return weiAmount / 1e18;
    }
    
    /**
     * @notice Helper to convert wei to tinybars
     */
    function weiToTinybars(uint256 weiAmount) public pure returns (uint256) {
        return weiAmount / WEI_PER_TINYBAR;
    }
    
    /**
     * @notice Fund perps vault for hedging operations
     * @dev Admin can pre-fund the perps vault so it has liquidity for opening hedge positions
     */
    function fundPerpsVault() external payable onlyAdmin {
        require(address(perpsVault) != address(0), "Perps vault not set");
        require(msg.value > 0, "Must send HBAR");
        perpsVault.depositCollateral{value: msg.value}();
    }
    
    // Receive HBAR
    receive() external payable {
        // msg.value is in tinybars, convert to wei
        uint256 weiAmount = msg.value * WEI_PER_TINYBAR;
        userCollateral[msg.sender] += weiAmount;
        oracle.depositCollateral{value: msg.value}();
        emit Deposit(msg.sender, weiAmount);
    }
}
