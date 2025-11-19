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
 * @title FxPoolHBAR
 * @notice Stableswap AMM for HBAR/Token pairs
 * @dev Special pool for HBAR paired with HTS tokens
 */
contract FxPoolHBAR is ERC20, ReentrancyGuard {
    // HTS Precompile address
    address constant HTS_PRECOMPILE = address(0x167);
    IHederaTokenService internal HTS;
    
    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice Token address (HBAR is native, so only one token)
    address public immutable token;
    
    /// @notice Oracle manager
    IOracleManager public immutable oracleManager;
    bytes32 public immutable pairHash;
    
    /// @notice Real reserves (actual balances in pool)
    uint256 public realReserveHBAR;
    uint256 public realReserveToken;
    
    /// @notice Virtual reserves (oracle-adjusted for swaps)
    uint256 public virtualReserveHBAR;
    uint256 public virtualReserveToken;
    
    /// @notice Hardcoded HBAR price (USD per HBAR in 18 decimals)
    /// @dev 0.1541 USD per HBAR = 154100000000000000 (0.1541 * 1e18)
    uint256 public constant HBAR_PRICE_USD = 154100000000000000;
    
    /// @notice Pool parameters
    uint256 public constant A = 100;
    uint256 public constant FEE_BPS = 30;  // 0.3%
    uint256 public constant MIN_LIQUIDITY = 1000;
    
    /// @notice Trade limits
    uint256 public constant MIN_TRADE_SIZE = 1e6;
    uint256 public constant MAX_TRADE_PERCENT = 10;
    
    /// @notice Fee accumulation
    uint256 public accumulatedFeesHBAR;
    uint256 public accumulatedFeesToken;
    
    /// @notice Emergency controls
    bool public paused;
    address public owner;
    
    // ============================================================================
    // EVENTS
    // ============================================================================
    
    event SwapExecuted(
        address indexed user,
        bool isHBARIn,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );
    
    event LiquidityAdded(
        address indexed provider,
        uint256 amountHBAR,
        uint256 amountToken,
        uint256 lpTokens
    );
    
    event LiquidityRemoved(
        address indexed provider,
        uint256 amountHBAR,
        uint256 amountToken,
        uint256 lpTokens
    );
    
    event VirtualReservesUpdated(
        uint256 virtualReserveHBAR,
        uint256 virtualReserveToken
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
        address _token,
        address _oracleManager,
        string memory _pairName
    ) ERC20(
        string(abi.encodePacked("FxSwap LP ", _pairName)),
        string(abi.encodePacked("FXS-", _pairName))
    ) {
        require(_token != address(0), "Invalid token");
        
        token = _token;
        oracleManager = IOracleManager(_oracleManager);
        pairHash = keccak256(abi.encodePacked(_pairName));
        owner = msg.sender;
        
        HTS = IHederaTokenService(HTS_PRECOMPILE);
    }
    
    // ============================================================================
    // LIQUIDITY FUNCTIONS
    // ============================================================================
    
    function addLiquidity(
        uint256 amountToken
    ) external payable nonReentrant whenNotPaused returns (uint256 lpTokens) {
        uint256 amountHBAR = msg.value;
        require(amountHBAR > 0, "No HBAR sent");
        require(amountToken > 0, "Invalid token amount");
        
        uint256 _totalSupply = totalSupply();
        
        if (_totalSupply == 0) {
            // First liquidity
            lpTokens = sqrt(amountHBAR * amountToken);
            require(lpTokens > MIN_LIQUIDITY, "Insufficient liquidity");
            
            _mint(address(1), MIN_LIQUIDITY);
            lpTokens = lpTokens - MIN_LIQUIDITY;
            
            // Set initial reserves
            realReserveHBAR = amountHBAR;
            realReserveToken = amountToken;
            
            // Calculate virtual reserves based on HBAR price
            _updateVirtualReserves();
        } else {
            // Update virtual reserves
            _updateVirtualReserves();
            
            require(virtualReserveHBAR > 0 && virtualReserveToken > 0, "No liquidity");
            
            // Check ratio deviation
            uint256 ratioHBAR = (amountHBAR * 1e18) / realReserveHBAR;
            uint256 ratioToken = (amountToken * 1e18) / realReserveToken;
            
            uint256 deviation = ratioHBAR > ratioToken 
                ? ((ratioHBAR - ratioToken) * 100) / ratioToken
                : ((ratioToken - ratioHBAR) * 100) / ratioHBAR;
            
            require(deviation < 2, "Liquidity ratio mismatch (>2%)");
            
            uint256 lpFromHBAR = (amountHBAR * _totalSupply) / realReserveHBAR;
            uint256 lpFromToken = (amountToken * _totalSupply) / realReserveToken;
            lpTokens = lpFromHBAR < lpFromToken ? lpFromHBAR : lpFromToken;
            
            // Update reserves
            realReserveHBAR += amountHBAR;
            realReserveToken += amountToken;
            _updateVirtualReserves();
        }
        
        require(lpTokens > 0, "Insufficient LP tokens");
        
        _mint(msg.sender, lpTokens);
        
        emit LiquidityAdded(msg.sender, amountHBAR, amountToken, lpTokens);
        
        return lpTokens;
    }
    
    function removeLiquidity(
        uint256 lpTokens
    ) external nonReentrant returns (uint256 amountHBAR, uint256 amountToken) {
        require(lpTokens > 0, "Invalid amount");
        require(balanceOf(msg.sender) >= lpTokens, "Insufficient LP tokens");
        
        _updateVirtualReserves();
        
        uint256 _totalSupply = totalSupply();
        amountHBAR = (lpTokens * realReserveHBAR) / _totalSupply;
        amountToken = (lpTokens * realReserveToken) / _totalSupply;
        
        require(amountHBAR > 0 && amountToken > 0, "Insufficient liquidity");
        
        _burn(msg.sender, lpTokens);
        
        realReserveHBAR -= amountHBAR;
        realReserveToken -= amountToken;
        
        _updateVirtualReserves();
        
        // Transfer HBAR
        payable(msg.sender).transfer(amountHBAR);
        
        // Transfer token using HTS
        _htsTransfer(token, msg.sender, amountToken);
        
        emit LiquidityRemoved(msg.sender, amountHBAR, amountToken, lpTokens);
        
        return (amountHBAR, amountToken);
    }
    
    // ============================================================================
    // SWAP FUNCTIONS
    // ============================================================================
    
    function swap(
        bool isHBARIn,
        uint256 minAmountOut
    ) external payable nonReentrant whenNotPaused returns (uint256 amountOut) {
        uint256 amountIn = isHBARIn ? msg.value : 0;
        
        require(amountIn >= MIN_TRADE_SIZE || !isHBARIn, "Trade too small");
        
        _updateVirtualReserves();
        
        uint256 maxTrade = isHBARIn 
            ? (virtualReserveHBAR * MAX_TRADE_PERCENT) / 100
            : (virtualReserveToken * MAX_TRADE_PERCENT) / 100;
        require(amountIn <= maxTrade, "Trade exceeds 10% of pool");
        
        amountOut = _calculateSwapOutput(amountIn, isHBARIn);
        
        uint256 fee = (amountOut * FEE_BPS) / 10000;
        amountOut = amountOut - fee;
        
        require(amountOut >= minAmountOut, "Slippage exceeded");
        
        uint256 reserveOut = isHBARIn ? realReserveToken : realReserveHBAR;
        require(reserveOut > amountOut, "Insufficient liquidity");
        
        if (isHBARIn) {
            realReserveHBAR += amountIn;
            realReserveToken -= amountOut;
            accumulatedFeesToken += fee;
            
            _htsTransfer(token, msg.sender, amountOut);
        } else {
            realReserveToken += amountIn;
            realReserveHBAR -= amountOut;
            accumulatedFeesHBAR += fee;
            
            payable(msg.sender).transfer(amountOut);
        }
        
        _updateVirtualReserves();
        
        emit SwapExecuted(msg.sender, isHBARIn, amountIn, amountOut, fee);
        
        return amountOut;
    }
    
    function _calculateSwapOutput(
        uint256 amountIn,
        bool isHBARIn
    ) internal view returns (uint256 amountOut) {
        require(virtualReserveHBAR > 0 && virtualReserveToken > 0, "Invalid virtual reserves");
        
        uint256 baseOutput;
        if (isHBARIn) {
            baseOutput = (virtualReserveToken * 1e18 / virtualReserveHBAR) * amountIn / 1e18;
        } else {
            baseOutput = (virtualReserveHBAR * 1e18 / virtualReserveToken) * amountIn / 1e18;
        }
        
        uint256 amplifiedOutput = baseOutput + (baseOutput * A / 10000);
        
        return amplifiedOutput;
    }
    
    // ============================================================================
    // HTS HELPER FUNCTIONS
    // ============================================================================
    
    function _htsTransfer(address _token, address to, uint256 amount) internal {
        require(amount <= uint256(uint64(type(int64).max)), "Too large");

        IHederaTokenService.AccountAmount memory sender = IHederaTokenService.AccountAmount({
            accountID: address(this),
            amount: -int64(int256(amount)),
            isApproval: false
        });

        IHederaTokenService.AccountAmount memory receiver = IHederaTokenService.AccountAmount({
            accountID: to,
            amount: int64(int256(amount)),
            isApproval: false
        });

        IHederaTokenService.TokenTransferList[] memory tokenTransfers = new IHederaTokenService.TokenTransferList[](1);
        tokenTransfers[0].token = _token;
        tokenTransfers[0].transfers = new IHederaTokenService.AccountAmount[](2);
        tokenTransfers[0].transfers[0] = sender;
        tokenTransfers[0].transfers[1] = receiver;
        tokenTransfers[0].nftTransfers = new IHederaTokenService.NftTransfer[](0);

        IHederaTokenService.TransferList memory hbarList = IHederaTokenService.TransferList({
            transfers: new IHederaTokenService.AccountAmount[](0)
        });

        int32 rc = HTS.cryptoTransfer(hbarList, tokenTransfers);
        require(rc == HederaResponseCodes.SUCCESS, "HTS transfer failed");
    }
    
    // ============================================================================
    // ORACLE INTEGRATION
    // ============================================================================
    
    function _updateVirtualReserves() internal {
        // Use hardcoded HBAR price: 1 HBAR = 0.1541 USD = 0.1541 pUSD
        // HBAR_PRICE_USD = 0.1541 * 1e18
        
        if (realReserveHBAR == 0 || realReserveToken == 0) {
            virtualReserveHBAR = realReserveHBAR;
            virtualReserveToken = realReserveToken;
            return;
        }
        
        // We want: virtualReserveHBAR * HBAR_PRICE_USD / 1e18 = virtualReserveToken
        // And maintain: k = realReserveHBAR * realReserveToken
        
        uint256 k = realReserveHBAR * realReserveToken;
        
        // From: vH * price / 1e18 = vT and vH * vT = k
        // We get: vH * (vH * price / 1e18) = k
        // So: vH^2 = k * 1e18 / price
        // Therefore: vH = sqrt(k * 1e18 / price)
        
        virtualReserveHBAR = sqrt((k * 1e18) / HBAR_PRICE_USD);
        
        // And: vT = vH * price / 1e18
        virtualReserveToken = (virtualReserveHBAR * HBAR_PRICE_USD) / 1e18;
        
        emit VirtualReservesUpdated(virtualReserveHBAR, virtualReserveToken);
    }
    
    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================
    
    function getVirtualReserves() external view returns (uint256, uint256) {
        return (virtualReserveHBAR, virtualReserveToken);
    }
    
    function getRealReserves() external view returns (uint256, uint256) {
        return (realReserveHBAR, realReserveToken);
    }
    
    function getExchangeRate() external view returns (uint256) {
        require(virtualReserveHBAR > 0, "No liquidity");
        return (virtualReserveToken * 1e18) / virtualReserveHBAR;
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
    
    // Allow contract to receive HBAR
    receive() external payable {}
}
