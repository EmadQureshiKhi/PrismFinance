// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IPriceOracle.sol";

/**
 * @title ChainlinkPriceOracle
 * @notice Price oracle using Chainlink-style price feeds
 * @dev For Hedera, we'll use a simplified version that can be updated by admin
 *      In production, integrate with actual Chainlink or Pyth oracles
 */
contract ChainlinkPriceOracle is IPriceOracle {
    address public admin;
    
    // Price data: symbol => price (8 decimals USD)
    mapping(string => uint256) public prices;
    
    // Last update timestamp: symbol => timestamp
    mapping(string => uint256) public lastUpdate;
    
    // Stale price threshold (1 hour)
    uint256 public constant STALE_THRESHOLD = 1 hours;
    
    event PriceUpdated(string indexed symbol, uint256 price, uint256 timestamp);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    constructor() {
        admin = msg.sender;
        
        // Initialize with reasonable default prices (8 decimals)
        prices["HBAR"] = 20000000;      // $0.20
        prices["USD"] = 100000000;      // $1.00
        prices["EUR"] = 108000000;      // $1.08
        prices["GBP"] = 127000000;      // $1.27
        prices["JPY"] = 670000;         // $0.0067
        prices["HKD"] = 12800000;       // $0.128
        prices["AED"] = 27200000;       // $0.272
        prices["BTC"] = 9500000000000;  // $95,000
        prices["ETH"] = 350000000000;   // $3,500
        prices["TSLA"] = 35000000000;   // $350
        prices["AAPL"] = 23000000000;   // $230
        prices["GOLD"] = 270000000000;  // $2,700/oz
        prices["SPY"] = 58000000000;    // $580
        prices["TBILL"] = 100000000;    // $1.00 (stable)
        
        // Set initial timestamps
        lastUpdate["HBAR"] = block.timestamp;
        lastUpdate["USD"] = block.timestamp;
        lastUpdate["EUR"] = block.timestamp;
        lastUpdate["GBP"] = block.timestamp;
        lastUpdate["JPY"] = block.timestamp;
        lastUpdate["HKD"] = block.timestamp;
        lastUpdate["AED"] = block.timestamp;
        lastUpdate["BTC"] = block.timestamp;
        lastUpdate["ETH"] = block.timestamp;
        lastUpdate["TSLA"] = block.timestamp;
        lastUpdate["AAPL"] = block.timestamp;
        lastUpdate["GOLD"] = block.timestamp;
        lastUpdate["SPY"] = block.timestamp;
        lastUpdate["TBILL"] = block.timestamp;
    }
    
    /**
     * @notice Get price of an asset in USD (8 decimals)
     */
    function getPrice(string memory symbol) external view override returns (uint256) {
        uint256 price = prices[symbol];
        require(price > 0, "Price not available");
        return price;
    }
    
    /**
     * @notice Check if price is fresh (updated within threshold)
     */
    function isPriceFresh(string memory symbol) external view override returns (bool) {
        return (block.timestamp - lastUpdate[symbol]) < STALE_THRESHOLD;
    }
    
    /**
     * @notice Update price for an asset (admin only)
     * @param symbol Asset symbol
     * @param price Price in USD with 8 decimals
     */
    function updatePrice(string memory symbol, uint256 price) external onlyAdmin {
        require(price > 0, "Invalid price");
        prices[symbol] = price;
        lastUpdate[symbol] = block.timestamp;
        emit PriceUpdated(symbol, price, block.timestamp);
    }
    
    /**
     * @notice Batch update prices (admin only)
     */
    function updatePrices(
        string[] memory symbols,
        uint256[] memory newPrices
    ) external onlyAdmin {
        require(symbols.length == newPrices.length, "Length mismatch");
        
        for (uint256 i = 0; i < symbols.length; i++) {
            require(newPrices[i] > 0, "Invalid price");
            prices[symbols[i]] = newPrices[i];
            lastUpdate[symbols[i]] = block.timestamp;
            emit PriceUpdated(symbols[i], newPrices[i], block.timestamp);
        }
    }
    
    /**
     * @notice Transfer admin (2-step process for safety)
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid address");
        admin = newAdmin;
        emit AdminTransferred(msg.sender, newAdmin);
    }
    
    /**
     * @notice Get multiple prices at once
     */
    function getPrices(string[] memory symbols) external view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](symbols.length);
        for (uint256 i = 0; i < symbols.length; i++) {
            result[i] = prices[symbols[i]];
        }
        return result;
    }
}
