// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./interfaces/IPriceOracle.sol";

/**
 * @title AssetOracleManager
 * @notice Manages price feeds from off-chain Pyth oracle bridge for synthetic assets
 * @dev Verifies signed price updates and stores latest prices
 * @dev Implements IPriceOracle interface for compatibility with PrismAssetExchange
 */
contract AssetOracleManager is IPriceOracle {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice Oracle address that signs price updates
    address public oracleAddress;

    /// @notice Owner address (for emergency functions)
    address public owner;

    /// @notice Maximum age for oracle prices (2 minutes)
    uint256 public constant MAX_ORACLE_AGE = 120;

    /// @notice Maximum price deviation allowed (20%)
    uint256 public constant MAX_PRICE_DEVIATION = 20;

    /// @notice Price data for each asset
    struct PriceData {
        uint256 price;          // Price with 8 decimals
        uint256 timestamp;      // Price timestamp from oracle
        uint256 lastUpdate;     // Block timestamp when updated
    }

    /// @notice Mapping of symbol to price data
    mapping(string => PriceData) public prices;

    /// @notice Emergency pause flag
    bool public paused;

    // ============================================================================
    // EVENTS
    // ============================================================================

    event PriceUpdated(
        string indexed symbol,
        uint256 price,
        uint256 timestamp
    );

    event PriceDeviationTooHigh(
        string indexed symbol,
        uint256 newPrice,
        uint256 lastPrice,
        uint256 deviation
    );

    event OracleAddressUpdated(
        address indexed oldOracle,
        address indexed newOracle
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
        require(!paused, "Contract is paused");
        _;
    }

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    /**
     * @notice Initialize the AssetOracleManager
     * @param _oracleAddress Address that will sign price updates
     */
    constructor(address _oracleAddress) {
        require(_oracleAddress != address(0), "Invalid oracle address");
        oracleAddress = _oracleAddress;
        owner = msg.sender;
    }

    // ============================================================================
    // EXTERNAL FUNCTIONS
    // ============================================================================

    /**
     * @notice Push new price update from oracle bridge
     * @param symbol Asset symbol (e.g., "HBAR", "BTC", "TSLA")
     * @param price Price with 8 decimals
     * @param timestamp Price timestamp
     * @param signature ECDSA signature from oracle
     */
    function pushPrice(
        string calldata symbol,
        uint256 price,
        uint256 timestamp,
        bytes calldata signature
    ) external whenNotPaused {
        // 1. Verify signature
        require(
            verifySignature(symbol, price, timestamp, signature),
            "Invalid signature"
        );

        // 2. Check timestamp freshness (prevent stale data)
        require(
            block.timestamp - timestamp < MAX_ORACLE_AGE,
            "Price too old"
        );
        
        // 3. Check timestamp is newer (prevent replay attacks)
        require(
            timestamp > prices[symbol].lastUpdate,
            "Timestamp not newer"
        );

        // 4. Sanity check: price deviation
        uint256 lastPrice = prices[symbol].price;
        if (lastPrice > 0) {
            uint256 deviation = _calculateDeviation(price, lastPrice);
            if (deviation >= MAX_PRICE_DEVIATION) {
                // Price deviation too high - DO NOT update
                emit PriceDeviationTooHigh(symbol, price, lastPrice, deviation);
                revert("Price deviation too high - requires manual review");
            }
        }

        // 5. Update price
        prices[symbol] = PriceData({
            price: price,
            timestamp: timestamp,
            lastUpdate: block.timestamp
        });

        emit PriceUpdated(symbol, price, timestamp);
    }

    /**
     * @notice Get latest price for an asset (IPriceOracle interface)
     * @param symbol Asset symbol (e.g., "HBAR", "BTC")
     * @return price Latest price with 8 decimals
     */
    function getPrice(string memory symbol)
        external
        view
        override
        returns (uint256 price)
    {
        require(prices[symbol].price > 0, "Price not set");
        require(!isStale(symbol), "Price is stale");
        return prices[symbol].price;
    }

    /**
     * @notice Check if price is fresh (IPriceOracle interface)
     * @param symbol Asset symbol
     * @return True if price is fresh
     */
    function isPriceFresh(string memory symbol)
        external
        view
        override
        returns (bool)
    {
        return !isStale(symbol);
    }

    /**
     * @notice Get price with timestamp
     * @param symbol Asset symbol
     * @return price Latest price
     * @return timestamp Price timestamp
     */
    function getPriceWithTimestamp(string memory symbol)
        external
        view
        returns (uint256 price, uint256 timestamp)
    {
        require(prices[symbol].price > 0, "Price not set");
        require(!isStale(symbol), "Price is stale");
        return (prices[symbol].price, prices[symbol].timestamp);
    }

    /**
     * @notice Check if price is stale
     * @param symbol Asset symbol
     * @return True if price is stale
     */
    function isStale(string memory symbol) public view returns (bool) {
        if (prices[symbol].lastUpdate == 0) return true;
        return block.timestamp - prices[symbol].lastUpdate > MAX_ORACLE_AGE;
    }

    /**
     * @notice Verify oracle signature
     * @param symbol Asset symbol
     * @param price Price value
     * @param timestamp Price timestamp
     * @param signature ECDSA signature
     * @return True if signature is valid
     */
    function verifySignature(
        string calldata symbol,
        uint256 price,
        uint256 timestamp,
        bytes calldata signature
    ) public view returns (bool) {
        // Recreate message hash
        bytes32 messageHash = keccak256(
            abi.encodePacked(symbol, price, timestamp)
        );

        // Add Ethereum signed message prefix
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();

        // Recover signer
        address signer = ethSignedMessageHash.recover(signature);

        // Verify signer is oracle
        return signer == oracleAddress;
    }

    /**
     * @notice Get multiple prices at once
     * @param symbols Array of asset symbols
     * @return priceList Array of prices (8 decimals each)
     */
    function getPrices(string[] memory symbols)
        external
        view
        returns (uint256[] memory priceList)
    {
        priceList = new uint256[](symbols.length);
        
        for (uint256 i = 0; i < symbols.length; i++) {
            require(prices[symbols[i]].price > 0, "Price not set");
            require(!isStale(symbols[i]), "Price is stale");
            priceList[i] = prices[symbols[i]].price;
        }
        
        return priceList;
    }

    // ============================================================================
    // OWNER FUNCTIONS
    // ============================================================================

    /**
     * @notice Update oracle address
     * @param newOracle New oracle address
     */
    function updateOracleAddress(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid address");
        address oldOracle = oracleAddress;
        oracleAddress = newOracle;
        emit OracleAddressUpdated(oldOracle, newOracle);
    }

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

    /**
     * @notice Manual price update (emergency only)
     * @param symbol Asset symbol
     * @param price Price with 8 decimals
     */
    function emergencySetPrice(string calldata symbol, uint256 price) external onlyOwner {
        require(price > 0, "Invalid price");
        
        prices[symbol] = PriceData({
            price: price,
            timestamp: block.timestamp,
            lastUpdate: block.timestamp
        });
        
        emit PriceUpdated(symbol, price, block.timestamp);
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /**
     * @notice Calculate price deviation percentage
     * @param newPrice New price
     * @param oldPrice Old price
     * @return Deviation percentage (0-100)
     */
    function _calculateDeviation(uint256 newPrice, uint256 oldPrice)
        internal
        pure
        returns (uint256)
    {
        if (oldPrice == 0) return 0;
        
        uint256 diff = newPrice > oldPrice
            ? newPrice - oldPrice
            : oldPrice - newPrice;
        
        return (diff * 100) / oldPrice;
    }
}
