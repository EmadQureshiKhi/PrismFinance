// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./hedera/IHederaTokenService.sol";
import "./hedera/HederaResponseCodes.sol";

interface IOracleManager {
    function getPrice(bytes32 pair) external view returns (uint256 price, uint256 timestamp);
}

/**
 * @title FxPoolHTS
 * @notice Stableswap AMM with oracle-driven virtual reserves (HTS-compatible)
 * @dev Works with native Hedera Token Service (HTS) tokens
 */
contract FxPoolHTS is ERC20, ReentrancyGuard {
    // HTS Precompile address
    address constant HTS_PRECOMPILE = address(0x167);
    IHederaTokenService internal HTS;
    
    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice Token addresses
    address public immutable tokenA;
    address public immutable tokenB;
    
    /// @notice Oracle manager
    IOracleManager public immutable oracleManager;
    bytes32 public immutable pairHash;
    
    /// @notice Real reserves (actual tokens in pool)
    uint256 public realReserveA;
    uint256 public realReserveB;
    
    /// @notice Virtual reserves (oracle-adjusted for swaps)
    uint256 public virtualReserveA;
    uint256 public virtualReserveB;
    
    /// @notice Oracle price (tokenB per tokenA in 18 decimals)
    uint256 public oraclePrice;
    uint256 public lastOracleUpdate;
    
    /// @notice Pool parameters
    uint256 public constant A = 100;
    uint256 public constant FEE_BPS = 30;  // 0.3%
    uint256 public constant MIN_LIQUIDITY = 1000;
    
    /// @notice Trade limits
    uint256 public constant MIN_TRADE_SIZE = 1e6;  // 0.01 token (8 decimals)
    uint256 public constant MAX_TRADE_PERCENT = 10;
    uint256 public constant MAX_PRICE_AGE = 3600;  // 1 hour
    
    /// @notice Fee accumulation
    uint256 public accumulatedFeesA;
    uint256 public accumulatedFeesB;
    
    /// @notice Emergency controls
    bool public paused;
    address public owner;
    
    // ============================================================================
    // EVENTS
    // ============================================================================
    
    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );
    
    event LiquidityAdded(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 lpTokens
    );
    
    event LiquidityRemoved(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 lpTokens
    );
    
    event VirtualReservesUpdated(
        uint256 virtualReserveA,
        uint256 virtualReserveB,
        uint256 oraclePrice
    );
    
    event EmergencyPause(bool paused);
    
    // ============================================================================
    // MODIFIERS
    // ============================================================================
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Pool is paused");
        _;
    }
    
    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================
    
    constructor(
        address _tokenA,
        address _tokenB,
        address _oracleManager,
        string memory _pairName
    ) ERC20(
        string(abi.encodePacked("FxSwap LP ", _pairName)),
        string(abi.encodePacked("FXS-", _pairName))
    ) {
        require(_tokenA != address(0) && _tokenB != address(0), "Invalid tokens");
        require(_oracleManager != address(0), "Invalid oracle");
        
        tokenA = _tokenA;
        tokenB = _tokenB;
        oracleManager = IOracleManager(_oracleManager);
        pairHash = keccak256(abi.encodePacked(_pairName));
        owner = msg.sender;
        
        // Initialize HTS interface
        HTS = IHederaTokenService(HTS_PRECOMPILE);
        
        // Note: Token association is handled automatically via maxAutomaticTokenAssociations
        // set during contract deployment
    }
    
    // ============================================================================
    // LIQUIDITY FUNCTIONS
    // ============================================================================
    
    function addLiquidity(
        uint256 amountA,
        uint256 amountB
    ) external nonReentrant whenNotPaused returns (uint256 lpTokens) {
        require(amountA > 0 && amountB > 0, "Invalid amounts");
        
        // Update oracle price and virtual reserves
        _updateVirtualReserves();
        
        // Calculate LP tokens to mint
        uint256 _totalSupply = totalSupply();
        
        if (_totalSupply == 0) {
            // First liquidity provider
            lpTokens = sqrt(amountA * amountB);
            require(lpTokens > MIN_LIQUIDITY, "Insufficient liquidity");
            
            // Lock minimum liquidity
            _mint(address(1), MIN_LIQUIDITY);
            lpTokens = lpTokens - MIN_LIQUIDITY;
        } else {
            // Subsequent liquidity providers
            // Validate ratio matches virtual reserves (allow 2% deviation)
            if (virtualReserveA > 0 && virtualReserveB > 0) {
                uint256 ratioA = (amountA * 1e18) / virtualReserveA;
                uint256 ratioB = (amountB * 1e18) / virtualReserveB;
                
                uint256 deviation = ratioA > ratioB 
                    ? ((ratioA - ratioB) * 100) / ratioB
                    : ((ratioB - ratioA) * 100) / ratioA;
                
                require(deviation < 2, "Liquidity ratio mismatch (>2%)");
            }
            
            uint256 lpFromA = (amountA * _totalSupply) / virtualReserveA;
            uint256 lpFromB = (amountB * _totalSupply) / virtualReserveB;
            lpTokens = lpFromA < lpFromB ? lpFromA : lpFromB;
        }
        
        require(lpTokens > 0, "Insufficient LP tokens");
        
        // NOTE: Tokens must be sent to contract BEFORE calling this function
        // This is the Hedera-native pattern for HTS tokens
        
        // Update real reserves (tokens already received)
        realReserveA += amountA;
        realReserveB += amountB;
        
        // Update virtual reserves
        _updateVirtualReserves();
        
        // Mint LP tokens
        _mint(msg.sender, lpTokens);
        
        emit LiquidityAdded(msg.sender, amountA, amountB, lpTokens);
        
        return lpTokens;
    }
    
    function removeLiquidity(
        uint256 lpTokens
    ) external nonReentrant returns (uint256 amountA, uint256 amountB) {
        require(lpTokens > 0, "Invalid amount");
        require(balanceOf(msg.sender) >= lpTokens, "Insufficient LP tokens");
        
        // Update oracle price and virtual reserves
        _updateVirtualReserves();
        
        // Calculate amounts to return
        uint256 totalSupply = totalSupply();
        amountA = (lpTokens * realReserveA) / totalSupply;
        amountB = (lpTokens * realReserveB) / totalSupply;
        
        require(amountA > 0 && amountB > 0, "Insufficient liquidity");
        
        // Burn LP tokens
        _burn(msg.sender, lpTokens);
        
        // Update real reserves
        realReserveA -= amountA;
        realReserveB -= amountB;
        
        // Update virtual reserves
        _updateVirtualReserves();
        
        // Transfer tokens using HTS precompile
        _htsTransfer(tokenA, msg.sender, amountA);
        _htsTransfer(tokenB, msg.sender, amountB);
        
        emit LiquidityRemoved(msg.sender, amountA, amountB, lpTokens);
        
        return (amountA, amountB);
    }
    
    // ============================================================================
    // SWAP FUNCTIONS
    // ============================================================================
    
    function swap(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        require(amountIn >= MIN_TRADE_SIZE, "Trade too small");
        require(tokenIn == tokenA || tokenIn == tokenB, "Invalid token");
        
        bool isTokenA = tokenIn == tokenA;
        address tokenOut = isTokenA ? tokenB : tokenA;
        
        // Update virtual reserves from oracle
        _updateVirtualReserves();
        
        // Check trade size limits (max 10% of virtual reserves)
        uint256 maxTrade = isTokenA 
            ? (virtualReserveA * MAX_TRADE_PERCENT) / 100
            : (virtualReserveB * MAX_TRADE_PERCENT) / 100;
        require(amountIn <= maxTrade, "Trade exceeds 10% of pool");
        
        // Calculate output using stableswap curve + virtual reserves
        amountOut = _calculateSwapOutput(amountIn, isTokenA);
        
        // Apply fee
        uint256 fee = (amountOut * FEE_BPS) / 10000;
        amountOut = amountOut - fee;
        
        // Slippage protection
        require(amountOut >= minAmountOut, "Slippage exceeded");
        
        // Verify we have enough output tokens in real reserves
        uint256 reserveOut = isTokenA ? realReserveB : realReserveA;
        require(reserveOut > amountOut, "Insufficient liquidity");
        
        // NOTE: Input tokens must be sent to contract BEFORE calling this function
        // Update real reserves
        if (isTokenA) {
            realReserveA += amountIn;
            realReserveB -= amountOut;
            accumulatedFeesB += fee;
        } else {
            realReserveB += amountIn;
            realReserveA -= amountOut;
            accumulatedFeesA += fee;
        }
        
        // Update virtual reserves after trade
        _updateVirtualReserves();
        
        // Transfer output tokens to user
        _htsTransfer(tokenOut, msg.sender, amountOut);
        
        emit SwapExecuted(msg.sender, tokenIn, amountIn, amountOut, fee);
        
        return amountOut;
    }
    
    function _calculateSwapOutput(
        uint256 amountIn,
        bool isTokenA
    ) internal view returns (uint256 amountOut) {
        // Protect against division by zero
        require(virtualReserveA > 0 && virtualReserveB > 0, "Invalid virtual reserves");
        
        // Stableswap formula with amplification
        // Base output using virtual reserves
        uint256 baseOutput;
        if (isTokenA) {
            baseOutput = (virtualReserveB * 1e18 / virtualReserveA) * amountIn / 1e18;
        } else {
            baseOutput = (virtualReserveA * 1e18 / virtualReserveB) * amountIn / 1e18;
        }
        
        // Apply amplification for lower slippage
        // A = 100 means 1% amplification boost
        // This reduces slippage for stable pairs
        uint256 amplifiedOutput = baseOutput + (baseOutput * A / 10000);
        
        return amplifiedOutput;
    }
    
    // ============================================================================
    // HTS HELPER FUNCTIONS
    // ============================================================================
    
    function _htsTransfer(address token, address to, uint256 amount) internal {
        require(amount <= uint256(uint64(type(int64).max)), "Too large");

        // Create sender (contract sends negative)
        IHederaTokenService.AccountAmount memory sender = IHederaTokenService.AccountAmount({
            accountID: address(this),
            amount: -int64(int256(amount)),
            isApproval: false
        });

        // Create receiver (user receives positive)
        IHederaTokenService.AccountAmount memory receiver = IHederaTokenService.AccountAmount({
            accountID: to,
            amount: int64(int256(amount)),
            isApproval: false
        });

        // Create token transfer list with proper array initialization
        IHederaTokenService.TokenTransferList[] memory tokenTransfers = new IHederaTokenService.TokenTransferList[](1);
        tokenTransfers[0].token = token;
        tokenTransfers[0].transfers = new IHederaTokenService.AccountAmount[](2);
        tokenTransfers[0].transfers[0] = sender;
        tokenTransfers[0].transfers[1] = receiver;
        tokenTransfers[0].nftTransfers = new IHederaTokenService.NftTransfer[](0);

        // Empty HBAR transfer list
        IHederaTokenService.TransferList memory hbarList = IHederaTokenService.TransferList({
            transfers: new IHederaTokenService.AccountAmount[](0)
        });

        // Execute cryptoTransfer
        int32 rc = HTS.cryptoTransfer(hbarList, tokenTransfers);
        require(rc == HederaResponseCodes.SUCCESS, "HTS transfer failed");
    }
    
    // ============================================================================
    // ORACLE INTEGRATION
    // ============================================================================
    
    function _updateVirtualReserves() internal {
        (uint256 price, uint256 timestamp) = oracleManager.getPrice(pairHash);
        
        // Allow zero price/timestamp for first liquidity addition
        if (timestamp == 0 || price == 0) {
            // First liquidity - use real reserves as virtual reserves
            if (realReserveA > 0 && realReserveB > 0) {
                virtualReserveA = realReserveA;
                virtualReserveB = realReserveB;
                return;
            }
            // No reserves yet, skip update
            return;
        }
        
        // Check price freshness
        require(block.timestamp - timestamp < MAX_PRICE_AGE, "Oracle price too old");
        
        // Check price deviation (prevent oracle manipulation)
        if (oraclePrice > 0) {
            uint256 deviation = price > oraclePrice 
                ? ((price - oraclePrice) * 100) / oraclePrice
                : ((oraclePrice - price) * 100) / oraclePrice;
            
            require(deviation < 20, "Price deviation too high (>20%)");
        }
        
        // Update oracle price
        oraclePrice = price;
        lastOracleUpdate = timestamp;
        
        // Guard against overflow for large pools
        require(realReserveA <= 1e40 && realReserveB <= 1e40, "Reserves too large");
        
        uint256 k = realReserveA * realReserveB;
        
        // Handle first liquidity case
        if (k == 0) {
            virtualReserveA = realReserveA;
            virtualReserveB = realReserveB;
        } else {
            // Calculate virtual reserves that maintain k and match oracle
            // FIXED: Swapped formula to correct the inversion
            // For EUR/USD = 1.1587 (1 EUR = 1.1587 USD):
            // - virtualA (pUSD) should be SMALLER (USD worth less)
            // - virtualB (pEUR) should be LARGER (EUR worth more)
            // Formula: virtualA = sqrt(k / oraclePrice), virtualB = sqrt(k * oraclePrice)
            virtualReserveA = sqrt((k * 1e18) / oraclePrice);
            virtualReserveB = sqrt((k * oraclePrice) / 1e18);
        }
        
        emit VirtualReservesUpdated(virtualReserveA, virtualReserveB, oraclePrice);
    }
    
    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================
    
    function getVirtualReserves() external view returns (uint256, uint256) {
        return (virtualReserveA, virtualReserveB);
    }
    
    function getRealReserves() external view returns (uint256, uint256) {
        return (realReserveA, realReserveB);
    }
    
    // Get LP token value in terms of underlying tokens
    function getLPTokenValue(uint256 lpAmount) external view returns (uint256 valueA, uint256 valueB) {
        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) return (0, 0);
        
        valueA = (lpAmount * realReserveA) / _totalSupply;
        valueB = (lpAmount * realReserveB) / _totalSupply;
    }
    
    // Get user's pool share in basis points (10000 = 100%)
    function getPoolShare(address user) external view returns (uint256 shareInBasisPoints) {
        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) return 0;
        
        return (balanceOf(user) * 10000) / _totalSupply;
    }
    
    function calculateSwapOutput(
        address tokenIn,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        require(tokenIn == tokenA || tokenIn == tokenB, "Invalid token");
        
        bool isTokenA = tokenIn == tokenA;
        amountOut = _calculateSwapOutput(amountIn, isTokenA);
        
        uint256 fee = (amountOut * FEE_BPS) / 10000;
        amountOut = amountOut - fee;
        
        return amountOut;
    }
    
    function getPoolInfo() external view returns (
        uint256 _realReserveA,
        uint256 _realReserveB,
        uint256 _virtualReserveA,
        uint256 _virtualReserveB,
        uint256 _oraclePrice,
        uint256 _totalSupply,
        uint256 _feesA,
        uint256 _feesB
    ) {
        return (
            realReserveA,
            realReserveB,
            virtualReserveA,
            virtualReserveB,
            oraclePrice,
            totalSupply(),
            accumulatedFeesA,
            accumulatedFeesB
        );
    }
    
    function getExchangeRate() external view returns (uint256) {
        require(virtualReserveA > 0, "No liquidity");
        return (virtualReserveB * 1e18) / virtualReserveA;
    }
    
    function getPriceImpact(
        address tokenIn,
        uint256 amountIn
    ) external view returns (uint256 impactBps) {
        require(tokenIn == tokenA || tokenIn == tokenB, "Invalid token");
        require(virtualReserveA > 0 && virtualReserveB > 0, "No liquidity");
        
        bool isTokenA = tokenIn == tokenA;
        
        // Current exchange rate
        uint256 currentRate = isTokenA 
            ? (virtualReserveB * 1e18) / virtualReserveA
            : (virtualReserveA * 1e18) / virtualReserveB;
        
        // Calculate output
        uint256 amountOut = _calculateSwapOutput(amountIn, isTokenA);
        
        // Effective rate after trade
        uint256 effectiveRate = (amountOut * 1e18) / amountIn;
        
        // Price impact in basis points
        if (effectiveRate < currentRate) {
            impactBps = ((currentRate - effectiveRate) * 10000) / currentRate;
        } else {
            impactBps = 0;
        }
        
        return impactBps;
    }
    
    function maxTradeSize(bool isTokenA) external view returns (uint256) {
        return isTokenA 
            ? (virtualReserveA * MAX_TRADE_PERCENT) / 100
            : (virtualReserveB * MAX_TRADE_PERCENT) / 100;
    }
    
    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================
    
    function pause() external onlyOwner {
        paused = true;
        emit EmergencyPause(true);
    }
    
    function unpause() external onlyOwner {
        paused = false;
        emit EmergencyPause(false);
    }
    
    // ============================================================================
    // INTERNAL HELPERS
    // ============================================================================
    
    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        
        return y;
    }
}
