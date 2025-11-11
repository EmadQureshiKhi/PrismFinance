// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPriceOracle
 * @notice Interface for price oracle (Chainlink/Pyth compatible)
 */
interface IPriceOracle {
    /**
     * @notice Get price of an asset in USD (8 decimals)
     * @param symbol Asset symbol (e.g., "HBAR", "BTC", "ETH")
     * @return price Price in USD with 8 decimals (e.g., 20000000 = $0.20)
     */
    function getPrice(string memory symbol) external view returns (uint256 price);
    
    /**
     * @notice Check if price data is fresh (not stale)
     * @param symbol Asset symbol
     * @return bool True if price is fresh
     */
    function isPriceFresh(string memory symbol) external view returns (bool);
}
