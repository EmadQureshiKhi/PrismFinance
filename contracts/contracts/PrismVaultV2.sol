// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PrismReserveOracle.sol";
import "./interfaces/IPriceOracle.sol";

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
        
        // Note: Oracle tracks collateral, vault tracks synthetic value
        // No need to update oracle for every mint/burn
        
        emit Mint(msg.sender, token, amount);
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
        
        // Step 1: Deposit collateral
        uint256 weiAmount = msg.value * WEI_PER_TINYBAR;
        userCollateral[msg.sender] += weiAmount;
        oracle.depositCollateral{value: msg.value}();
        emit Deposit(msg.sender, weiAmount);
        
        // Step 2: Mint tokens (in same transaction)
        require(_checkUserHealth(msg.sender, 0, mintAmount, token), "Insufficient collateral");
        positions[msg.sender][token] += mintAmount;
        totalMinted[token] += mintAmount;
        emit Mint(msg.sender, token, mintAmount);
    }
    
    /**
     * @notice Burn synthetic tokens
     */
    function burn(string memory token, uint256 amount) external {
        require(amount <= positions[msg.sender][token], "Insufficient position");
        
        positions[msg.sender][token] -= amount;
        totalMinted[token] -= amount;
        
        // Note: Oracle tracks collateral, vault tracks synthetic value
        
        emit Burn(msg.sender, token, amount);
    }
    
    /**
     * @notice Burn tokens and withdraw HBAR in one atomic transaction
     * @param token Token symbol to burn
     * @param burnAmount Amount to burn (in wei)
     * @param withdrawAmount Amount to withdraw (in wei)
     */
    function burnAndWithdraw(string memory token, uint256 burnAmount, uint256 withdrawAmount) external {
        require(burnAmount > 0 || withdrawAmount > 0, "Must burn or withdraw");
        
        // Step 1: Burn tokens
        if (burnAmount > 0) {
            require(burnAmount <= positions[msg.sender][token], "Insufficient position");
            positions[msg.sender][token] -= burnAmount;
            totalMinted[token] -= burnAmount;
            emit Burn(msg.sender, token, burnAmount);
        }
        
        // Step 2: Withdraw collateral (in same transaction)
        if (withdrawAmount > 0) {
            require(withdrawAmount <= userCollateral[msg.sender], "Insufficient collateral");
            require(_checkUserHealth(msg.sender, withdrawAmount, 0, ""), "Would break collateral ratio");
            userCollateral[msg.sender] -= withdrawAmount;
            uint256 tinybars = withdrawAmount / WEI_PER_TINYBAR;
            oracle.withdrawForVault(payable(msg.sender), tinybars);
            emit Withdraw(msg.sender, withdrawAmount);
        }
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
     * @notice Get user position info
     */
    function getUserPosition(address user) external view returns (
        uint256 collateral,
        uint256 debtValue,
        uint256 ratio,
        bool healthy
    ) {
        collateral = userCollateral[user];
        debtValue = getUserDebtValue(user);
        ratio = _getUserCollateralRatio(user);
        healthy = ratio >= MIN_COLLATERAL_RATIO;
        
        return (collateral, debtValue, ratio, healthy);
    }
    
    /**
     * @notice Get maximum amount user can mint for a given token
     * @param user User address
     * @param tokenSymbol Token symbol (e.g., "pUSD")
     * @return maxAmount Maximum mintable amount (in wei, 18 decimals)
     */
    function getMaxMintable(address user, string memory tokenSymbol) external view returns (uint256) {
        uint256 collateral = userCollateral[user];
        uint256 currentDebt = getUserDebtValue(user);
        
        // Max debt = collateral / (MIN_COLLATERAL_RATIO / 100)
        // e.g., 100 HBAR / 1.5 = 66.67 HBAR worth of debt
        uint256 maxTotalDebt = (collateral * 100) / MIN_COLLATERAL_RATIO;
        
        if (maxTotalDebt <= currentDebt) return 0;
        
        uint256 availableDebtInHbar = maxTotalDebt - currentDebt;
        
        // Convert available HBAR debt to token amount
        // Remove 'p' prefix from tokenSymbol
        string memory assetSymbol = _removePPrefix(tokenSymbol);
        uint256 hbarPrice = priceOracle.getPrice("HBAR");
        uint256 assetPrice = priceOracle.getPrice(assetSymbol);
        
        // availableDebtInHbar * hbarPrice / assetPrice
        return (availableDebtInHbar * hbarPrice) / assetPrice;
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
    
    function _updateOracleSyntheticValue() internal {
        // Calculate total synthetic value across all tokens (in wei)
        uint256 totalValue = 0;
        
        totalValue += totalMinted["pUSD"];
        totalValue += totalMinted["pEUR"];
        totalValue += totalMinted["pGBP"];
        totalValue += totalMinted["pJPY"];
        totalValue += totalMinted["pHKD"];
        totalValue += totalMinted["pAED"];
        totalValue += totalMinted["pTSLA"];
        totalValue += totalMinted["pAAPL"];
        totalValue += totalMinted["pTBILL"];
        totalValue += totalMinted["pGOLD"];
        totalValue += totalMinted["pSPY"];
        totalValue += totalMinted["pBTC"];
        totalValue += totalMinted["pETH"];
        
        // Convert to tinybars for oracle
        uint256 tinybars = totalValue / WEI_PER_TINYBAR;
        
        // Update oracle (oracle expects tinybars)
        oracle.updateSyntheticValue(tinybars);
    }
    
    /**
     * @notice Emergency withdraw (admin only)
     */
    function emergencyWithdraw(address payable recipient, uint256 amount) external onlyAdmin {
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");
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
    
    // Receive HBAR
    receive() external payable {
        // msg.value is in tinybars, convert to wei
        uint256 weiAmount = msg.value * WEI_PER_TINYBAR;
        userCollateral[msg.sender] += weiAmount;
        oracle.depositCollateral{value: msg.value}();
        emit Deposit(msg.sender, weiAmount);
    }
}
