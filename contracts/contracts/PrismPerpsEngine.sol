// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PrismPerpsVault.sol";
import "./interfaces/IPriceOracle.sol";

/**
 * @title PrismPerpsEngine
 * @notice Handles perpetual futures positions for HBAR/USD
 * @dev Manages position opening, closing, liquidation, and PnL calculations
 */
contract PrismPerpsEngine {
    address public admin;
    PrismPerpsVault public vault;
    IPriceOracle public priceOracle;
    
    struct Position {
        bytes32 id;               // Unique position ID
        address owner;            // Position owner
        bool isLong;              // true = long, false = short
        uint256 size;             // Position size in HBAR (wei)
        uint256 collateral;       // Margin in HBAR (wei)
        uint256 leverage;         // 1x - 10x
        uint256 entryPrice;       // HBAR/USD price at entry (8 decimals)
        uint256 timestamp;        // When opened
        uint256 lastFundingTime;  // Last funding payment
        bool isVaultHedge;        // Flag for vault hedge positions
    }
    
    // Position ID => Position
    mapping(bytes32 => Position) public positions;
    
    // User => Position IDs
    mapping(address => bytes32[]) public userPositions;
    
    // Position counter for unique IDs
    uint256 private positionNonce;
    
    // Open interest tracking
    uint256 public totalLongOI;   // Total long open interest
    uint256 public totalShortOI;  // Total short open interest
    
    // Configuration
    uint256 public constant MAX_LEVERAGE = 10;
    uint256 public constant MIN_LEVERAGE = 1;
    uint256 public constant MAINTENANCE_MARGIN = 500;  // 5% in basis points
    uint256 public constant LIQUIDATION_FEE = 200;     // 2% in basis points
    uint256 public constant TRADING_FEE = 10;          // 0.1% in basis points
    uint256 public constant FUNDING_RATE = 1;          // 0.01% per hour in basis points
    
    // Limits
    uint256 public maxPositionSize = 10000 * 10**18;   // 10k HBAR
    uint256 public maxLongOI = 100000 * 10**18;        // 100k HBAR
    uint256 public maxShortOI = 100000 * 10**18;       // 100k HBAR
    
    // Constants
    uint256 public constant WEI_PER_TINYBAR = 10_000_000_000;
    
    // Events
    event PositionOpened(address indexed user, bytes32 indexed positionId, bool isLong, uint256 size, uint256 collateral, uint256 leverage, uint256 entryPrice);
    event PositionClosed(address indexed user, bytes32 indexed positionId, int256 pnl, uint256 exitPrice);
    event PositionLiquidated(address indexed user, bytes32 indexed positionId, address indexed liquidator, uint256 reward);
    event FundingPaid(address indexed user, bytes32 indexed positionId, uint256 amount);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    constructor(address _vault, address _priceOracle) {
        admin = msg.sender;
        vault = PrismPerpsVault(_vault);
        priceOracle = IPriceOracle(_priceOracle);
    }
    
    /**
     * @notice Generate unique position ID
     */
    function _generatePositionId(address user) internal returns (bytes32) {
        return keccak256(abi.encodePacked(user, positionNonce++, block.timestamp));
    }
    
    /**
     * @notice Open a perpetual position
     * @param isLong true for long, false for short
     * @param collateralAmount Amount of HBAR to use as margin (wei)
     * @param leverage Leverage multiplier (1-10)
     * @param isVaultHedge Flag for vault hedge positions
     * @return positionId Unique position ID
     */
    function openPosition(
        bool isLong,
        uint256 collateralAmount,
        uint256 leverage,
        bool isVaultHedge
    ) external returns (bytes32 positionId) {
        require(leverage >= MIN_LEVERAGE && leverage <= MAX_LEVERAGE, "Invalid leverage");
        require(collateralAmount > 0, "Collateral must be > 0");
        
        // Generate unique position ID
        positionId = _generatePositionId(msg.sender);
        
        // Calculate position size
        uint256 positionSize = collateralAmount * leverage;
        require(positionSize <= maxPositionSize, "Position too large");
        
        // Check OI limits
        if (isLong) {
            require(totalLongOI + positionSize <= maxLongOI, "Max long OI reached");
            totalLongOI += positionSize;
        } else {
            require(totalShortOI + positionSize <= maxShortOI, "Max short OI reached");
            totalShortOI += positionSize;
        }
        
        // Get current price
        uint256 currentPrice = priceOracle.getPrice("HBAR");
        
        // Calculate and collect trading fee
        uint256 tradingFee = (positionSize * TRADING_FEE) / 10000;
        require(collateralAmount > tradingFee, "Collateral too small for fees");
        
        uint256 netCollateral = collateralAmount - tradingFee;
        
        // Lock collateral in vault
        vault.lockCollateral(msg.sender, collateralAmount);
        
        // Create position
        positions[positionId] = Position({
            id: positionId,
            owner: msg.sender,
            isLong: isLong,
            size: positionSize,
            collateral: netCollateral,
            leverage: leverage,
            entryPrice: currentPrice,
            timestamp: block.timestamp,
            lastFundingTime: block.timestamp,
            isVaultHedge: isVaultHedge
        });
        
        // Add to user's position list
        userPositions[msg.sender].push(positionId);
        
        emit PositionOpened(msg.sender, positionId, isLong, positionSize, netCollateral, leverage, currentPrice);
    }
    
    /**
     * @notice Close a specific position by ID
     * @param positionId The position ID to close
     */
    function closePosition(bytes32 positionId) external {
        Position storage pos = positions[positionId];
        require(pos.size > 0, "Position not found");
        require(pos.owner == msg.sender, "Not position owner");
        
        // Get current price
        uint256 currentPrice = priceOracle.getPrice("HBAR");
        
        // Apply funding
        _applyFunding(positionId);
        
        // Calculate PnL
        int256 pnl = _calculatePnL(pos, currentPrice);
        
        // Calculate trading fee
        uint256 tradingFee = (pos.size * TRADING_FEE) / 10000;
        pnl -= int256(tradingFee);
        
        // Update OI
        if (pos.isLong) {
            totalLongOI -= pos.size;
        } else {
            totalShortOI -= pos.size;
        }
        
        // Calculate original locked amount (before funding was applied)
        // We need to unlock the original amount, not the current collateral which may have increased from funding
        uint256 unlockAmount = pos.collateral + tradingFee;
        
        // Get current locked amount to ensure we don't try to unlock more than what's locked
        uint256 currentLocked = vault.getTotalBalance(msg.sender) - vault.getAvailableBalance(msg.sender);
        if (unlockAmount > currentLocked) {
            unlockAmount = currentLocked; // Cap at what's actually locked
        }
        
        // Unlock collateral
        vault.unlockCollateral(msg.sender, unlockAmount);
        
        // Apply PnL (includes any funding gains)
        vault.applyPnL(msg.sender, pnl);
        
        emit PositionClosed(msg.sender, positionId, pnl, currentPrice);
        
        // Remove from user's position list
        _removePositionFromUser(msg.sender, positionId);
        
        // Delete position
        delete positions[positionId];
    }
    
    /**
     * @notice Remove position ID from user's list
     */
    function _removePositionFromUser(address user, bytes32 positionId) internal {
        bytes32[] storage userPos = userPositions[user];
        for (uint256 i = 0; i < userPos.length; i++) {
            if (userPos[i] == positionId) {
                userPos[i] = userPos[userPos.length - 1];
                userPos.pop();
                break;
            }
        }
    }
    
    /**
     * @notice Liquidate an undercollateralized position
     * @param positionId The position ID to liquidate
     */
    function liquidate(bytes32 positionId) external {
        Position storage pos = positions[positionId];
        require(pos.size > 0, "Position not found");
        
        // Check if liquidatable
        uint256 currentPrice = priceOracle.getPrice("HBAR");
        require(_isLiquidatable(pos, currentPrice), "Position not liquidatable");
        
        // Calculate PnL
        int256 pnl = _calculatePnL(pos, currentPrice);
        
        // Calculate liquidation reward
        uint256 liquidationReward = (pos.collateral * LIQUIDATION_FEE) / 10000;
        
        // Update OI
        if (pos.isLong) {
            totalLongOI -= pos.size;
        } else {
            totalShortOI -= pos.size;
        }
        
        // Unlock collateral
        vault.unlockCollateral(pos.owner, pos.collateral);
        
        // Apply PnL (will be negative)
        vault.applyPnL(pos.owner, pnl);
        
        // Pay liquidator
        vault.applyPnL(msg.sender, int256(liquidationReward));
        
        emit PositionLiquidated(pos.owner, positionId, msg.sender, liquidationReward);
        
        // Remove from user's position list
        _removePositionFromUser(pos.owner, positionId);
        
        // Delete position
        delete positions[positionId];
    }
    
    /**
     * @notice Get all position IDs for a user
     */
    function getUserPositions(address user) external view returns (bytes32[] memory) {
        return userPositions[user];
    }
    
    /**
     * @notice Get position by ID
     */
    function getPositionById(bytes32 positionId) external view returns (Position memory) {
        return positions[positionId];
    }
    
    /**
     * @notice Get position info by ID
     */
    function getPositionInfoById(bytes32 positionId) external view returns (
        bool isLong,
        uint256 size,
        uint256 collateral,
        uint256 leverage,
        uint256 entryPrice,
        uint256 currentPrice,
        int256 unrealizedPnL,
        uint256 liquidationPrice,
        uint256 marginRatio
    ) {
        Position memory pos = positions[positionId];
        currentPrice = priceOracle.getPrice("HBAR");
        
        if (pos.size == 0) {
            return (false, 0, 0, 0, 0, currentPrice, 0, 0, 0);
        }
        
        unrealizedPnL = _calculatePnL(pos, currentPrice);
        liquidationPrice = _calculateLiquidationPrice(pos);
        marginRatio = _calculateMarginRatio(pos, currentPrice);
        
        return (
            pos.isLong,
            pos.size,
            pos.collateral,
            pos.leverage,
            pos.entryPrice,
            currentPrice,
            unrealizedPnL,
            liquidationPrice,
            marginRatio
        );
    }
    
    /**
     * @notice Get position info for a user (legacy - returns first position)
     * @dev Kept for backward compatibility
     */
    function getPositionInfo(address user) external view returns (
        bool isLong,
        uint256 size,
        uint256 collateral,
        uint256 leverage,
        uint256 entryPrice,
        uint256 currentPrice,
        int256 unrealizedPnL,
        uint256 liquidationPrice,
        uint256 marginRatio
    ) {
        bytes32[] memory userPos = userPositions[user];
        currentPrice = priceOracle.getPrice("HBAR");
        
        if (userPos.length == 0) {
            return (false, 0, 0, 0, 0, currentPrice, 0, 0, 0);
        }
        
        // Return first position for backward compatibility
        Position memory pos = positions[userPos[0]];
        
        unrealizedPnL = _calculatePnL(pos, currentPrice);
        liquidationPrice = _calculateLiquidationPrice(pos);
        marginRatio = _calculateMarginRatio(pos, currentPrice);
        
        return (
            pos.isLong,
            pos.size,
            pos.collateral,
            pos.leverage,
            pos.entryPrice,
            currentPrice,
            unrealizedPnL,
            liquidationPrice,
            marginRatio
        );
    }
    
    /**
     * @notice Calculate PnL for a position
     */
    function _calculatePnL(Position memory pos, uint256 currentPrice) internal pure returns (int256) {
        int256 priceDiff;
        
        if (pos.isLong) {
            // Long: profit when price rises
            priceDiff = int256(currentPrice) - int256(pos.entryPrice);
        } else {
            // Short: profit when price falls
            priceDiff = int256(pos.entryPrice) - int256(currentPrice);
        }
        
        // PnL = (priceDiff / entryPrice) * positionSize
        int256 pnl = (priceDiff * int256(pos.size)) / int256(pos.entryPrice);
        
        return pnl;
    }
    
    /**
     * @notice Calculate liquidation price
     */
    function _calculateLiquidationPrice(Position memory pos) internal pure returns (uint256) {
        // Liquidation when equity < maintenance margin
        // equity = collateral + PnL
        // maintenanceMargin = size * 5%
        
        uint256 maintenanceMargin = (pos.size * MAINTENANCE_MARGIN) / 10000;
        uint256 maxLoss = pos.collateral > maintenanceMargin ? pos.collateral - maintenanceMargin : 0;
        
        // Calculate price change that causes maxLoss
        uint256 priceChangePercent = (maxLoss * 10000) / pos.size;
        
        if (pos.isLong) {
            // Long liquidates when price drops
            uint256 priceDrop = (pos.entryPrice * priceChangePercent) / 10000;
            return pos.entryPrice > priceDrop ? pos.entryPrice - priceDrop : 0;
        } else {
            // Short liquidates when price rises
            uint256 priceRise = (pos.entryPrice * priceChangePercent) / 10000;
            return pos.entryPrice + priceRise;
        }
    }
    
    /**
     * @notice Calculate margin ratio
     */
    function _calculateMarginRatio(Position memory pos, uint256 currentPrice) internal pure returns (uint256) {
        int256 pnl = _calculatePnL(pos, currentPrice);
        
        int256 equity = int256(pos.collateral) + pnl;
        if (equity <= 0) return 0;
        
        uint256 maintenanceMargin = (pos.size * MAINTENANCE_MARGIN) / 10000;
        
        return (uint256(equity) * 10000) / maintenanceMargin;
    }
    
    /**
     * @notice Check if position is liquidatable
     */
    function _isLiquidatable(Position memory pos, uint256 currentPrice) internal pure returns (bool) {
        uint256 marginRatio = _calculateMarginRatio(pos, currentPrice);
        return marginRatio < 10000; // < 100%
    }
    
    /**
     * @notice Apply funding rate
     */
    function _applyFunding(bytes32 positionId) internal {
        Position storage pos = positions[positionId];
        
        uint256 timeElapsed = block.timestamp - pos.lastFundingTime;
        if (timeElapsed == 0) return;
        
        // Calculate funding payment
        uint256 fundingPayment = (pos.size * FUNDING_RATE * timeElapsed) / (10000 * 1 hours);
        
        if (pos.isLong) {
            // Longs pay funding
            if (pos.collateral > fundingPayment) {
                pos.collateral -= fundingPayment;
            }
        } else {
            // Shorts receive funding (incentive for hedging)
            pos.collateral += fundingPayment;
        }
        
        pos.lastFundingTime = block.timestamp;
        emit FundingPaid(pos.owner, positionId, fundingPayment);
    }
    
    /**
     * @notice Update configuration (admin)
     */
    function setMaxPositionSize(uint256 _maxSize) external onlyAdmin {
        maxPositionSize = _maxSize;
    }
    
    function setMaxOI(uint256 _maxLong, uint256 _maxShort) external onlyAdmin {
        maxLongOI = _maxLong;
        maxShortOI = _maxShort;
    }
    
    /**
     * @notice Open position for vault hedging (called by perps vault)
     * @dev This bypasses the normal lockCollateral flow since the vault already locked it
     */
    function openPositionForVault(
        address vaultAddress,
        bool isLong,
        uint256 collateralAmount,
        uint256 leverage
    ) external returns (bytes32 positionId) {
        require(msg.sender == address(vault), "Only perps vault");
        require(leverage >= MIN_LEVERAGE && leverage <= MAX_LEVERAGE, "Invalid leverage");
        require(collateralAmount > 0, "Collateral must be > 0");
        
        // Generate unique position ID for the vault
        positionId = keccak256(abi.encodePacked(vaultAddress, block.timestamp, block.number, userPositions[vaultAddress].length));
        
        // Calculate position size
        uint256 positionSize = collateralAmount * leverage;
        require(positionSize <= maxPositionSize, "Position too large");
        
        // Check OI limits
        if (isLong) {
            require(totalLongOI + positionSize <= maxLongOI, "Max long OI reached");
            totalLongOI += positionSize;
        } else {
            require(totalShortOI + positionSize <= maxShortOI, "Max short OI reached");
            totalShortOI += positionSize;
        }
        
        // Get current price
        uint256 currentPrice = priceOracle.getPrice("HBAR");
        
        // Calculate and collect trading fee
        uint256 tradingFee = (positionSize * TRADING_FEE) / 10000;
        require(collateralAmount > tradingFee, "Collateral too small for fees");
        
        uint256 netCollateral = collateralAmount - tradingFee;
        
        // Note: Collateral already locked by perps vault, so we skip vault.lockCollateral()
        
        // Create position
        positions[positionId] = Position({
            id: positionId,
            owner: vaultAddress,
            isLong: isLong,
            size: positionSize,
            collateral: netCollateral,
            leverage: leverage,
            entryPrice: currentPrice,
            timestamp: block.timestamp,
            lastFundingTime: block.timestamp,
            isVaultHedge: true
        });
        
        // Add to vault's position list
        userPositions[vaultAddress].push(positionId);
        
        emit PositionOpened(vaultAddress, positionId, isLong, positionSize, netCollateral, leverage, currentPrice);
    }
}
