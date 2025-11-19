// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IOracleManager {
    function getPrice(bytes32 pair) external view returns (uint256 price, uint256 timestamp);
}

/**
 * @title FxPool
 * @notice Stableswap AMM with oracle-driven virtual reserves
 * @dev Core innovation: Real reserves stay constant, virtual reserves shift with oracle
 */
contract FxPool is ERC20, ReentrancyGuard {
    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice Token addresses
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;
    
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
    uint256 public constant A = 100;  // Amplification coefficient
    uint256 public constant FEE_BPS = 30;  // 0.3% = 30 basis points
    uint256 public constant MIN_LIQUIDITY = 1000;  // Minimum liquidity lock
    
    /// @notice Trade limits
    uint256 public constant MIN_TRADE_SIZE = 1e15;  // 0.001 token minimum
    uint256 public constant MAX_TRADE_PERCENT = 10;  // 10% of virtual reserves max
    uint256 public constant MAX_PRICE_AGE = 300;  // 5 minutes max oracle age
    
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
        
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
        oracleManager = IOracleManager(_oracleManager);
        pairHash = keccak256(abi.encodePacked(_pairName));
        owner = msg.sender;
    }
    
    // ============================================================================
    // LIQUIDITY FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Add liquidity to pool
     * @param amountA Amount of tokenA to add
     * @param amountB Amount of tokenB to add
     * @return lpTokens Amount of LP tokens minted
     */
    function addLiquidity(
        uint256 amountA,
        uint256 amountB
    ) external nonReentrant whenNotPaused returns (uint256 lpTokens) {
        require(amountA > 0 && amountB > 0, "Invalid amounts");
        
        // Update oracle price and virtual reserves
        _updateVirtualReserves();
        
        // Calculate LP tokens to mint
        uint256 totalSupply = totalSupply();
        
        if (totalSupply == 0) {
            // First liquidity provider
            lpTokens = sqrt(amountA * amountB);
            require(lpTokens > MIN_LIQUIDITY, "Insufficient liquidity");
            
            // Lock minimum liquidity (burn to address(1) to prevent manipulation)
            _mint(address(1), MIN_LIQUIDITY);
            lpTokens = lpTokens - MIN_LIQUIDITY;
        } else {
            // Subsequent liquidity providers
            // Use virtual reserves for ratio
            uint256 lpFromA = (amountA * totalSupply) / virtualReserveA;
            uint256 lpFromB = (amountB * totalSupply) / virtualReserveB;
            lpTokens = lpFromA < lpFromB ? lpFromA : lpFromB;
        }
        
        require(lpTokens > 0, "Insufficient LP tokens");
        
        // Transfer tokens from user
        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);
        
        // Update real reserves
        realReserveA += amountA;
        realReserveB += amountB;
        
        // Update virtual reserves
        _updateVirtualReserves();
        
        // Mint LP tokens
        _mint(msg.sender, lpTokens);
        
        emit LiquidityAdded(msg.sender, amountA, amountB, lpTokens);
        
        return lpTokens;
    }
    
    /**
     * @notice Remove liquidity from pool
     * @param lpTokens Amount of LP tokens to burn
     * @return amountA Amount of tokenA returned
     * @return amountB Amount of tokenB returned
     */
    function removeLiquidity(
        uint256 lpTokens
    ) external nonReentrant returns (uint256 amountA, uint256 amountB) {
        require(lpTokens > 0, "Invalid amount");
        require(balanceOf(msg.sender) >= lpTokens, "Insufficient LP tokens");
        
        // Update oracle price and virtual reserves
        _updateVirtualReserves();
        
        // Calculate amounts to return (proportional to real reserves)
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
        
        // Transfer tokens to user
        tokenA.transfer(msg.sender, amountA);
        tokenB.transfer(msg.sender, amountB);
        
        emit LiquidityRemoved(msg.sender, amountA, amountB, lpTokens);
        
        return (amountA, amountB);
    }
    
    // ============================================================================
    // SWAP FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Swap tokens using virtual reserves
     * @param tokenIn Address of input token
     * @param amountIn Amount of input token
     * @param minAmountOut Minimum output amount (slippage protection)
     * @return amountOut Amount of output token
     */
    function swap(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        require(amountIn >= MIN_TRADE_SIZE, "Trade too small");
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB), "Invalid token");
        
        // Update oracle price and virtual reserves
        _updateVirtualReserves();
        
        bool isTokenA = tokenIn == address(tokenA);
        
        // Check trade size limit
        uint256 maxTrade = isTokenA 
            ? (virtualReserveA * MAX_TRADE_PERCENT) / 100
            : (virtualReserveB * MAX_TRADE_PERCENT) / 100;
        require(amountIn <= maxTrade, "Trade too large");
        
        // Calculate output using stableswap curve on VIRTUAL reserves
        amountOut = _calculateSwapOutput(amountIn, isTokenA);
        
        // Apply fee
        uint256 fee = (amountOut * FEE_BPS) / 10000;
        amountOut = amountOut - fee;
        
        // Slippage protection
        require(amountOut >= minAmountOut, "Slippage exceeded");
        
        // Update REAL reserves
        if (isTokenA) {
            realReserveA += amountIn;
            realReserveB -= amountOut;
            accumulatedFeesB += fee;
        } else {
            realReserveB += amountIn;
            realReserveA -= amountOut;
            accumulatedFeesA += fee;
        }
        
        // Update VIRTUAL reserves
        _updateVirtualReserves();
        
        // Transfer tokens
        if (isTokenA) {
            tokenA.transferFrom(msg.sender, address(this), amountIn);
            tokenB.transfer(msg.sender, amountOut);
        } else {
            tokenB.transferFrom(msg.sender, address(this), amountIn);
            tokenA.transfer(msg.sender, amountOut);
        }
        
        emit SwapExecuted(msg.sender, tokenIn, amountIn, amountOut, fee);
        
        return amountOut;
    }
    
    /**
     * @notice Calculate swap output using simplified stableswap curve
     * @param amountIn Amount of input token
     * @param isTokenA True if swapping tokenA for tokenB
     * @return amountOut Amount of output token (before fees)
     */
    function _calculateSwapOutput(
        uint256 amountIn,
        bool isTokenA
    ) internal view returns (uint256 amountOut) {
        // Simplified stableswap: dx = (virtualA / virtualB) * dy
        // CRITICAL: Use 1e18 scaling to prevent precision loss
        
        if (isTokenA) {
            // Swapping A for B
            amountOut = (virtualReserveB * 1e18 / virtualReserveA) * amountIn / 1e18;
        } else {
            // Swapping B for A
            amountOut = (virtualReserveA * 1e18 / virtualReserveB) * amountIn / 1e18;
        }
        
        return amountOut;
    }
    
    // ============================================================================
    // ORACLE INTEGRATION
    // ============================================================================
    
    /**
     * @notice Update virtual reserves based on oracle price
     * @dev Called automatically on every swap and liquidity operation
     */
    function _updateVirtualReserves() internal {
        // Get latest oracle price
        (uint256 price, uint256 timestamp) = oracleManager.getPrice(pairHash);
        
        // Validate price freshness
        require(block.timestamp - timestamp < MAX_PRICE_AGE, "Oracle price too old");
        
        // Update oracle price
        oraclePrice = price;
        lastOracleUpdate = timestamp;
        
        // Guard against overflow for large pools
        require(realReserveA <= 1e40 && realReserveB <= 1e40, "Reserves too large");
        
        // Calculate constant product
        uint256 k = realReserveA * realReserveB;
        
        // Calculate virtual reserves that maintain k and match oracle
        // Formula: virtualA = sqrt(k * price), virtualB = sqrt(k / price)
        // CRITICAL: price is in 18 decimals
        virtualReserveA = sqrt((k * oraclePrice) / 1e18);
        virtualReserveB = sqrt((k * 1e18) / oraclePrice);
        
        emit VirtualReservesUpdated(virtualReserveA, virtualReserveB, oraclePrice);
    }
    
    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Get current virtual reserves
     */
    function getVirtualReserves() external view returns (uint256, uint256) {
        return (virtualReserveA, virtualReserveB);
    }
    
    /**
     * @notice Get current real reserves
     */
    function getRealReserves() external view returns (uint256, uint256) {
        return (realReserveA, realReserveB);
    }
    
    /**
     * @notice Calculate swap output (view function for UI)
     */
    function calculateSwapOutput(
        address tokenIn,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB), "Invalid token");
        
        bool isTokenA = tokenIn == address(tokenA);
        amountOut = _calculateSwapOutput(amountIn, isTokenA);
        
        // Apply fee
        uint256 fee = (amountOut * FEE_BPS) / 10000;
        amountOut = amountOut - fee;
        
        return amountOut;
    }
    
    /**
     * @notice Get pool info for UI
     */
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
    
    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Emergency pause
     */
    function pause() external onlyOwner {
        paused = true;
        emit EmergencyPause(true);
    }
    
    /**
     * @notice Unpause
     */
    function unpause() external onlyOwner {
        paused = false;
        emit EmergencyPause(false);
    }
    
    // ============================================================================
    // INTERNAL HELPERS
    // ============================================================================
    
    /**
     * @notice Babylonian square root
     */
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
