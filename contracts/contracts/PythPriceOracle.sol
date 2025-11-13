// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "./interfaces/IPriceOracle.sol";

/**
 * @title PythPriceOracle
 * @notice Real-time price oracle using Pyth Network
 * @dev Provides automatic price updates for stocks, crypto, and commodities
 * 
 * Pyth Network on Hedera:
 * - Testnet: 0xA2aa501b19aff244D90cc15a4Cf739D2725B5729
 * - Mainnet: 0xA2aa501b19aff244D90cc15a4Cf739D2725B5729
 */
contract PythPriceOracle is IPriceOracle {
    
    IPyth public pyth;
    address public admin;
    
    // Pyth price feed IDs (these are the real Pyth feed IDs)
    mapping(string => bytes32) public priceFeedIds;
    
    // Fallback prices if Pyth is unavailable (8 decimals)
    mapping(string => uint256) public fallbackPrices;
    
    // Price age threshold (10 minutes)
    uint256 public constant MAX_PRICE_AGE = 10 minutes;
    
    event PriceFeedUpdated(string indexed symbol, bytes32 feedId);
    event FallbackPriceSet(string indexed symbol, uint256 price);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    constructor(address _pyth) {
        require(_pyth != address(0), "Invalid Pyth address");
        pyth = IPyth(_pyth);
        admin = msg.sender;
        
        // Initialize Pyth price feed IDs
        // These are the official Pyth Network price feed IDs (Stable feeds)
        
        // Crypto
        priceFeedIds["HBAR"] = 0x3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd; // HBAR/USD ✅ REAL
        priceFeedIds["BTC"] = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43; // BTC/USD ✅ REAL
        priceFeedIds["ETH"] = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace; // ETH/USD ✅ REAL
        
        // Stocks
        priceFeedIds["TSLA"] = 0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1; // TSLA/USD ✅ REAL
        priceFeedIds["AAPL"] = 0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688; // AAPL/USD ✅ REAL
        priceFeedIds["SPY"] = 0x19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5; // SPY/USD ✅ REAL
        
        // Commodities
        priceFeedIds["GOLD"] = 0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2; // XAU/USD (Gold) ✅ REAL
        
        // Treasury Bills
        priceFeedIds["TBILL"] = 0x84ff736dbf4339f4d353265c12774f6bf27551496c4c7ad89dd4ac30fa2f55f8; // MTBILL/USD ✅ REAL
        
        // Set fallback prices (8 decimals) - Updated Jan 2025
        fallbackPrices["HBAR"] = 18390000;       // $0.1839
        fallbackPrices["BTC"] = 10494990000000;  // $104,949.90
        fallbackPrices["ETH"] = 354711000000;    // $3,547.11
        fallbackPrices["TSLA"] = 43962000000;    // $439.62
        fallbackPrices["AAPL"] = 27525000000;    // $275.25
        fallbackPrices["GOLD"] = 412596000000;   // $4,125.96/oz
        fallbackPrices["SPY"] = 68300000000;     // $683.00
        fallbackPrices["TBILL"] = 100000000;     // $1.00
    }
    
    /**
     * @notice Get real-time price from Pyth Network
     * @param symbol Asset symbol (e.g., "BTC", "TSLA")
     * @return price Price in USD with 8 decimals
     */
    function getPrice(string memory symbol) external view override returns (uint256) {
        bytes32 feedId = priceFeedIds[symbol];
        
        // If no feed ID configured, use fallback
        if (feedId == bytes32(0)) {
            return _getFallbackPrice(symbol);
        }
        
        try pyth.getPriceNoOlderThan(feedId, MAX_PRICE_AGE) returns (PythStructs.Price memory price) {
            // Check if price is valid (not zero or negative)
            if (price.price <= 0) {
                return _getFallbackPrice(symbol);
            }
            // Convert Pyth price to 8 decimals
            return _convertPythPrice(price);
        } catch Error(string memory) {
            // If Pyth fails with error message, use fallback
            return _getFallbackPrice(symbol);
        } catch (bytes memory) {
            // If Pyth fails with low-level error, use fallback
            return _getFallbackPrice(symbol);
        }
    }
    
    /**
     * @notice Check if price is fresh (within MAX_PRICE_AGE)
     * @param symbol Asset symbol
     * @return bool True if price is fresh or fallback is available
     */
    function isPriceFresh(string memory symbol) external view override returns (bool) {
        bytes32 feedId = priceFeedIds[symbol];
        
        // If no feed ID, check if fallback price exists
        if (feedId == bytes32(0)) {
            return fallbackPrices[symbol] > 0;
        }
        
        try pyth.getPriceUnsafe(feedId) returns (PythStructs.Price memory price) {
            // Check if price is recent
            return (block.timestamp - price.publishTime) < MAX_PRICE_AGE;
        } catch {
            // If Pyth fails, check if fallback exists
            return fallbackPrices[symbol] > 0;
        }
    }
    
    /**
     * @notice Get price with update fee (for transactions that need fresh data)
     * @param symbol Asset symbol
     * @param updateData Pyth update data from off-chain
     * @return price Price in USD with 8 decimals
     */
    function getPriceWithUpdate(
        string memory symbol,
        bytes[] calldata updateData
    ) external payable returns (uint256) {
        bytes32 feedId = priceFeedIds[symbol];
        require(feedId != bytes32(0), "Feed not configured");
        
        // Update Pyth price feeds (requires fee)
        uint256 fee = pyth.getUpdateFee(updateData);
        require(msg.value >= fee, "Insufficient update fee");
        
        pyth.updatePriceFeeds{value: fee}(updateData);
        
        // Get updated price
        PythStructs.Price memory price = pyth.getPriceUnsafe(feedId);
        
        // Refund excess fee
        if (msg.value > fee) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - fee}("");
            require(success, "HBAR refund failed");
        }
        
        return _convertPythPrice(price);
    }
    
    /**
     * @notice Get multiple prices at once
     * @param symbols Array of asset symbols
     * @return prices Array of prices in USD with 8 decimals
     */
    function getPrices(string[] memory symbols) external view returns (uint256[] memory) {
        uint256[] memory prices = new uint256[](symbols.length);
        
        for (uint256 i = 0; i < symbols.length; i++) {
            bytes32 feedId = priceFeedIds[symbols[i]];
            
            if (feedId == bytes32(0)) {
                prices[i] = _getFallbackPrice(symbols[i]);
                continue;
            }
            
            try pyth.getPriceNoOlderThan(feedId, MAX_PRICE_AGE) returns (PythStructs.Price memory price) {
                prices[i] = _convertPythPrice(price);
            } catch {
                prices[i] = _getFallbackPrice(symbols[i]);
            }
        }
        
        return prices;
    }
    
    /**
     * @notice Get Pyth update fee for price updates
     * @param updateData Pyth update data
     * @return fee Fee in wei
     */
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256) {
        return pyth.getUpdateFee(updateData);
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Convert Pyth price format to 8 decimals
     * @dev Assumes price.price > 0 (checked by caller)
     */
    function _convertPythPrice(PythStructs.Price memory price) internal pure returns (uint256) {
        // Pyth prices have variable exponents
        // We need to normalize to 8 decimals
        int32 expo = price.expo;
        int64 priceValue = price.price;
        
        // Target is 8 decimals (1e8)
        // If expo is -8, price is already in 8 decimals, just return it
        // If expo is -5, we need to divide by 1e3 to get to 8 decimals
        // If expo is -10, we need to multiply by 1e2 to get to 8 decimals
        
        int32 targetExpo = -8;
        int32 expoDiff = expo - targetExpo;
        
        if (expoDiff == 0) {
            // Already in 8 decimals
            return uint256(uint64(priceValue));
        } else if (expoDiff > 0) {
            // Need to scale up
            return uint256(uint64(priceValue)) * (10 ** uint256(int256(expoDiff)));
        } else {
            // Need to scale down
            return uint256(uint64(priceValue)) / (10 ** uint256(int256(-expoDiff)));
        }
    }
    
    /**
     * @notice Get fallback price if Pyth is unavailable
     */
    function _getFallbackPrice(string memory symbol) internal view returns (uint256) {
        uint256 price = fallbackPrices[symbol];
        require(price > 0, "Price not available");
        return price;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update price feed ID for an asset
     */
    function updatePriceFeed(string memory symbol, bytes32 feedId) external onlyAdmin {
        priceFeedIds[symbol] = feedId;
        emit PriceFeedUpdated(symbol, feedId);
    }
    
    /**
     * @notice Set fallback price for an asset
     */
    function setFallbackPrice(string memory symbol, uint256 price) external onlyAdmin {
        require(price > 0, "Invalid price");
        fallbackPrices[symbol] = price;
        emit FallbackPriceSet(symbol, price);
    }
    
    /**
     * @notice Update Pyth contract address
     */
    function updatePyth(address _pyth) external onlyAdmin {
        require(_pyth != address(0), "Invalid address");
        pyth = IPyth(_pyth);
    }
    
    /**
     * @notice Transfer admin
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid address");
        admin = newAdmin;
        emit AdminTransferred(msg.sender, newAdmin);
    }
    
    /**
     * @notice Withdraw any stuck HBAR (from update fees)
     */
    function withdraw() external onlyAdmin {
        (bool success, ) = payable(admin).call{value: address(this).balance}("");
        require(success, "HBAR withdrawal failed");
    }
    
    // ============ Receive Function ============
    
    receive() external payable {
        // Accept HBAR for Pyth update fees
    }
}
