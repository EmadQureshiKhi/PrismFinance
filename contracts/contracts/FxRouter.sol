// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./hedera/IHederaTokenService.sol";
import "./hedera/HederaResponseCodes.sol";

interface IFxPool {
    function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut) external returns (uint256);
    function getAmountOut(address tokenIn, uint256 amountIn) external view returns (uint256);
}

interface IFxPoolHBAR {
    function swap(bool isHBARIn, uint256 minAmountOut) external payable returns (uint256);
}

/**
 * @title FxRouter
 * @notice Router for multi-hop swaps in a single transaction
 * @dev Handles routing through pUSD hub and HBAR swaps
 */
contract FxRouter {
    // HTS Precompile
    address constant HTS_PRECOMPILE = address(0x167);
    IHederaTokenService internal HTS;
    
    address public immutable owner;
    
    // Special addresses
    address public constant HBAR_ADDRESS = address(0);
    address public immutable pUSD;
    address public immutable hbarPool;
    
    event MultiHopSwap(
        address indexed user,
        address[] path,
        uint256 amountIn,
        uint256 amountOut
    );
    
    constructor(address _pUSD, address _hbarPool) {
        pUSD = _pUSD;
        hbarPool = _hbarPool;
        owner = msg.sender;
        HTS = IHederaTokenService(HTS_PRECOMPILE);
    }
    
    /**
     * @notice Execute multi-hop swap through pUSD
     * @param pools Array of pool addresses [pool1, pool2]
     * @param tokens Array of token addresses [tokenIn, pUSD, tokenOut]
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum output amount (slippage protection)
     * @return amountOut Final output amount
     */
    function multiHopSwap(
        address[] calldata pools,
        address[] calldata tokens,
        uint256 amountIn,
        uint256 minAmountOut
    ) external payable returns (uint256 amountOut) {
        require(pools.length >= 1 && pools.length <= 2, "Invalid path length");
        require(tokens.length == pools.length + 1, "Tokens/pools mismatch");
        
        amountOut = amountIn;
        
        // Execute each hop
        for (uint i = 0; i < pools.length; i++) {
            address tokenIn = tokens[i];
            address tokenOut = tokens[i + 1];
            address pool = pools[i];
            
            // Handle HBAR swaps specially
            if (tokenIn == HBAR_ADDRESS) {
                // HBAR → pUSD
                require(msg.value == amountIn, "Incorrect HBAR amount");
                amountOut = IFxPoolHBAR(pool).swap{value: amountIn}(
                    true,
                    i == pools.length - 1 ? minAmountOut : 0
                );
            } else if (tokenOut == HBAR_ADDRESS) {
                // pUSD → HBAR
                // Transfer pUSD to HBAR pool
                _htsTransferFrom(tokenIn, msg.sender, pool, amountOut);
                
                amountOut = IFxPoolHBAR(pool).swap(
                    false,
                    i == pools.length - 1 ? minAmountOut : 0
                );
                
                // Transfer HBAR to user
                payable(msg.sender).transfer(amountOut);
            } else {
                // HTS token swap
                // NOTE: Tokens are already in router (transferred by frontend before calling this)
                // Transfer tokens from router to pool
                _htsTransfer(tokenIn, pool, amountOut);
                
                // Execute swap
                amountOut = IFxPool(pool).swap(
                    tokenIn,
                    amountOut,
                    i == pools.length - 1 ? minAmountOut : 0
                );
            }
        }
        
        // Final slippage check
        require(amountOut >= minAmountOut, "Slippage exceeded");
        
        emit MultiHopSwap(msg.sender, tokens, amountIn, amountOut);
        
        return amountOut;
    }
    
    /**
     * @notice Get estimated output for multi-hop swap
     * @param pools Array of pool addresses
     * @param tokens Array of token addresses
     * @param amountIn Input amount
     * @return amountOut Estimated output amount
     */
    function getAmountOut(
        address[] calldata pools,
        address[] calldata tokens,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        amountOut = amountIn;
        
        for (uint i = 0; i < pools.length; i++) {
            amountOut = IFxPool(pools[i]).getAmountOut(tokens[i], amountOut);
        }
        
        return amountOut;
    }
    
    // HTS transfer from user to pool
    function _htsTransferFrom(address token, address from, address to, uint256 amount) internal {
        require(amount <= uint256(uint64(type(int64).max)), "Amount too large");

        IHederaTokenService.AccountAmount memory sender = IHederaTokenService.AccountAmount({
            accountID: from,
            amount: -int64(int256(amount)),
            isApproval: false
        });

        IHederaTokenService.AccountAmount memory receiver = IHederaTokenService.AccountAmount({
            accountID: to,
            amount: int64(int256(amount)),
            isApproval: false
        });

        IHederaTokenService.TokenTransferList[] memory tokenTransfers = new IHederaTokenService.TokenTransferList[](1);
        tokenTransfers[0].token = token;
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
    
    // HTS transfer from this contract
    function _htsTransfer(address token, address to, uint256 amount) internal {
        require(amount <= uint256(uint64(type(int64).max)), "Amount too large");

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
        tokenTransfers[0].token = token;
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
    
    // Allow contract to receive HBAR
    receive() external payable {}
}
