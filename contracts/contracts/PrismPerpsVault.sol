// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PrismPerpsEngine.sol";

/**
 * @title PrismPerpsVault
 * @notice Manages HBAR collateral for perpetual futures trading
 * @dev Handles deposits, withdrawals, and collateral locking for positions
 */
contract PrismPerpsVault {
    address public admin;
    PrismPerpsEngine public perpsEngine;
    
    // User balances
    mapping(address => uint256) public userCollateral;
    mapping(address => uint256) public lockedCollateral;
    
    // Protocol reserves
    uint256 public totalCollateral;
    uint256 public protocolReserve;
    
    // Constants
    uint256 public constant WEI_PER_TINYBAR = 10_000_000_000;
    
    // Events
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event CollateralLocked(address indexed user, uint256 amount);
    event CollateralUnlocked(address indexed user, uint256 amount);
    event ProtocolReserveFunded(uint256 amount);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    modifier onlyEngine() {
        require(msg.sender == address(perpsEngine), "Only engine");
        _;
    }
    
    constructor() {
        admin = msg.sender;
    }
    
    /**
     * @notice Set perps engine address
     */
    function setPerpsEngine(address _engine) external onlyAdmin {
        perpsEngine = PrismPerpsEngine(_engine);
    }
    
    /**
     * @notice Deposit HBAR as collateral
     */
    function depositCollateral() external payable {
        require(msg.value > 0, "Must deposit HBAR");
        
        // msg.value is in tinybars on Hedera, convert to wei for internal accounting
        uint256 weiAmount = msg.value * WEI_PER_TINYBAR;
        userCollateral[msg.sender] += weiAmount;
        totalCollateral += weiAmount;
        
        emit Deposit(msg.sender, weiAmount);
    }
    
    /**
     * @notice Withdraw HBAR collateral
     */
    function withdrawCollateral(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(getAvailableBalance(msg.sender) >= amount, "Insufficient available balance");
        
        userCollateral[msg.sender] -= amount;
        totalCollateral -= amount;
        
        uint256 tinybars = amount / WEI_PER_TINYBAR;
        (bool success, ) = msg.sender.call{value: tinybars}("");
        require(success, "Transfer failed");
        
        emit Withdraw(msg.sender, amount);
    }
    
    /**
     * @notice Get user's available balance (not locked in positions)
     */
    function getAvailableBalance(address user) public view returns (uint256) {
        return userCollateral[user] - lockedCollateral[user];
    }
    
    /**
     * @notice Get user's total balance
     */
    function getTotalBalance(address user) external view returns (uint256) {
        return userCollateral[user];
    }
    
    /**
     * @notice Lock collateral for a position (called by engine)
     */
    function lockCollateral(address user, uint256 amount) external onlyEngine {
        require(getAvailableBalance(user) >= amount, "Insufficient available balance");
        
        lockedCollateral[user] += amount;
        emit CollateralLocked(user, amount);
    }
    
    /**
     * @notice Unlock collateral when position closes (called by engine)
     */
    function unlockCollateral(address user, uint256 amount) external onlyEngine {
        require(lockedCollateral[user] >= amount, "Insufficient locked collateral");
        
        lockedCollateral[user] -= amount;
        emit CollateralUnlocked(user, amount);
    }
    
    /**
     * @notice Apply PnL to user's collateral (called by engine)
     */
    function applyPnL(address user, int256 pnl) external onlyEngine {
        if (pnl > 0) {
            // Profit: add to user balance
            uint256 profit = uint256(pnl);
            userCollateral[user] += profit;
            totalCollateral += profit;
            
            // Protocol pays from reserve
            require(protocolReserve >= profit, "Insufficient protocol reserve");
            protocolReserve -= profit;
        } else if (pnl < 0) {
            // Loss: subtract from user balance
            uint256 loss = uint256(-pnl);
            require(userCollateral[user] >= loss, "Insufficient user balance");
            
            userCollateral[user] -= loss;
            totalCollateral -= loss;
            
            // Protocol receives the loss
            protocolReserve += loss;
        }
    }
    
    /**
     * @notice Fund protocol reserve (admin)
     */
    function fundProtocolReserve() external payable onlyAdmin {
        uint256 weiAmount = msg.value * WEI_PER_TINYBAR;
        protocolReserve += weiAmount;
        emit ProtocolReserveFunded(weiAmount);
    }
    
    /**
     * @notice Get protocol reserve balance
     */
    function getProtocolReserve() external view returns (uint256) {
        return protocolReserve;
    }
    
    /**
     * @notice Open position for vault hedging (called by PrismVaultV2)
     * @dev This allows the vault to open positions using its deposited collateral
     */
    function openPositionForVault(
        bool isLong,
        uint256 collateralAmount,
        uint256 leverage
    ) external returns (bytes32) {
        require(collateralAmount > 0, "Collateral must be > 0");
        require(getAvailableBalance(msg.sender) >= collateralAmount, "Insufficient balance");
        
        // Calculate what will actually be locked (after trading fee)
        uint256 positionSize = collateralAmount * leverage;
        uint256 tradingFee = (positionSize * 10) / 10000; // 0.1% fee
        uint256 actualLocked = collateralAmount; // Lock the full amount including fee
        
        // Lock collateral for the vault (msg.sender)
        lockedCollateral[msg.sender] += actualLocked;
        emit CollateralLocked(msg.sender, actualLocked);
        
        // Call engine to open position
        return perpsEngine.openPositionForVault(msg.sender, isLong, collateralAmount, leverage);
    }
}
