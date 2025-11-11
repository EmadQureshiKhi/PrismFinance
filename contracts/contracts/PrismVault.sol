// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PrismReserveOracle.sol";

/**
 * @title PrismVault
 * @notice Main vault for minting/burning synthetic assets backed by HBAR collateral
 * @dev Integrates with PrismReserveOracle for collateral management
 */
contract PrismVault {
    // State variables
    address public admin;
    PrismReserveOracle public oracle;
    
    // Hedera token IDs (stored as addresses for EVM compatibility)
    mapping(string => address) public tokenAddresses;
    
    // User positions: user => token => amount
    mapping(address => mapping(string => uint256)) public positions;
    
    // Total minted per token
    mapping(string => uint256) public totalMinted;
    
    // Collateral per user
    mapping(address => uint256) public userCollateral;
    
    // Constants
    uint256 public constant MIN_COLLATERAL_RATIO = 150; // 150%
    uint256 public constant LIQUIDATION_RATIO = 130; // 130%
    uint256 public constant LIQUIDATION_PENALTY = 10; // 10%
    
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
    
    constructor(address _oracle) {
        admin = msg.sender;
        oracle = PrismReserveOracle(payable(_oracle));
    }
    
    /**
     * @notice Register a token address
     */
    function registerToken(string memory symbol, address tokenAddress) external onlyAdmin {
        tokenAddresses[symbol] = tokenAddress;
    }
    
    /**
     * @notice Deposit HBAR collateral
     */
    function depositCollateral() external payable {
        require(msg.value > 0, "Must deposit HBAR");
        userCollateral[msg.sender] += msg.value;
        
        // Forward to oracle
        oracle.depositCollateral{value: msg.value}();
        
        emit Deposit(msg.sender, msg.value);
    }
    
    /**
     * @notice Withdraw HBAR collateral
     */
    function withdrawCollateral(uint256 amount) external {
        require(amount <= userCollateral[msg.sender], "Insufficient collateral");
        require(_checkUserHealth(msg.sender, amount, 0, ""), "Would break collateral ratio");
        
        userCollateral[msg.sender] -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdraw(msg.sender, amount);
    }
    
    /**
     * @notice Mint synthetic tokens
     * @param token Token symbol (e.g., "pUSD", "pBTC")
     * @param amount Amount to mint (in token decimals)
     */
    function mint(string memory token, uint256 amount) external {
        require(tokenAddresses[token] != address(0), "Token not registered");
        require(amount > 0, "Amount must be > 0");
        require(_checkUserHealth(msg.sender, 0, amount, token), "Insufficient collateral");
        
        positions[msg.sender][token] += amount;
        totalMinted[token] += amount;
        
        // Update oracle synthetic value
        _updateOracleSyntheticValue();
        
        emit Mint(msg.sender, token, amount);
    }
    
    /**
     * @notice Burn synthetic tokens
     */
    function burn(string memory token, uint256 amount) external {
        require(amount <= positions[msg.sender][token], "Insufficient position");
        
        positions[msg.sender][token] -= amount;
        totalMinted[token] -= amount;
        
        // Update oracle synthetic value
        _updateOracleSyntheticValue();
        
        emit Burn(msg.sender, token, amount);
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
     * @notice Get user's total debt value in HBAR
     */
    function getUserDebtValue(address user) public view returns (uint256) {
        // For now, simplified: 1:1 with HBAR
        // In production, would use price oracles
        uint256 totalDebt = 0;
        
        // Sum all token positions
        // Note: This is simplified - in production you'd iterate through registered tokens
        totalDebt += positions[user]["pUSD"];
        totalDebt += positions[user]["pEUR"];
        totalDebt += positions[user]["pGBP"];
        totalDebt += positions[user]["pBTC"];
        totalDebt += positions[user]["pETH"];
        
        return totalDebt;
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
     * @notice Get total vault stats
     */
    function getVaultStats() external view returns (
        uint256 totalCollateral,
        uint256 totalDebt,
        uint256 globalRatio
    ) {
        (uint256 oracleCollateral, uint256 syntheticValue, uint256 ratio, , ) = oracle.getInfo();
        return (oracleCollateral, syntheticValue, ratio);
    }
    
    // Internal functions
    
    function _getUserCollateralRatio(address user) internal view returns (uint256) {
        uint256 debt = getUserDebtValue(user);
        if (debt == 0) return type(uint256).max;
        
        return (userCollateral[user] * 100) / debt;
    }
    
    function _checkUserHealth(
        address user,
        uint256 withdrawAmount,
        uint256 mintAmount,
        string memory token
    ) internal view returns (bool) {
        uint256 newCollateral = userCollateral[user] - withdrawAmount;
        uint256 newDebt = getUserDebtValue(user) + mintAmount;
        
        if (newDebt == 0) return true;
        
        uint256 newRatio = (newCollateral * 100) / newDebt;
        return newRatio >= MIN_COLLATERAL_RATIO;
    }
    
    function _updateOracleSyntheticValue() internal {
        // Calculate total synthetic value across all tokens
        uint256 totalValue = 0;
        
        // Simplified: sum all minted tokens
        // In production, would use price feeds
        totalValue += totalMinted["pUSD"];
        totalValue += totalMinted["pEUR"];
        totalValue += totalMinted["pGBP"];
        totalValue += totalMinted["pBTC"];
        totalValue += totalMinted["pETH"];
        
        oracle.updateSyntheticValue(totalValue);
    }
    
    /**
     * @notice Emergency withdraw (admin only)
     */
    function emergencyWithdraw(address payable recipient, uint256 amount) external onlyAdmin {
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");
    }
    
    // Receive HBAR
    receive() external payable {
        userCollateral[msg.sender] += msg.value;
        oracle.depositCollateral{value: msg.value}();
        emit Deposit(msg.sender, msg.value);
    }
}
