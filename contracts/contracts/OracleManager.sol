// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title OracleManager
 * @notice Manages price feeds from off-chain Chainlink oracle bridge
 * @dev Verifies signed price updates and stores latest prices
 */
contract OracleManager {
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

    /// @notice Price data for each pair
    struct PriceData {
        uint256 price;
        uint256 timestamp;
        uint256 lastUpdate;
    }

    /// @notice Mapping of pair hash to price data
    mapping(bytes32 => PriceData) public prices;

    /// @notice Emergency pause flag
    bool public paused;

    // ============================================================================
    // EVENTS
    // ============================================================================

    event PriceUpdated(
        bytes32 indexed pair,
        uint256 price,
        uint256 timestamp
    );

    event PriceDeviationTooHigh(
        bytes32 indexed pair,
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
     * @notice Initialize the OracleManager
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
     * @param pair Pair identifier (e.g., keccak256("EUR/USD"))
     * @param price Price with 18 decimals
     * @param timestamp Price timestamp
     * @param signature ECDSA signature from oracle
     */
    function pushPrice(
        bytes32 pair,
        uint256 price,
        uint256 timestamp,
        bytes calldata signature
    ) external whenNotPaused {
        // 1. Verify signature
        require(
            verifySignature(pair, price, timestamp, signature),
            "Invalid signature"
        );

        // 2. Check timestamp freshness (prevent stale data)
        require(
            block.timestamp - timestamp < MAX_ORACLE_AGE,
            "Price too old"
        );
        
        // 3. Check timestamp is newer (prevent replay attacks)
        require(
            timestamp > prices[pair].lastUpdate,
            "Timestamp not newer"
        );

        // 4. Sanity check: price deviation
        uint256 lastPrice = prices[pair].price;
        if (lastPrice > 0) {
            uint256 deviation = _calculateDeviation(price, lastPrice);
            if (deviation >= MAX_PRICE_DEVIATION) {
                // Price deviation too high - DO NOT update
                emit PriceDeviationTooHigh(pair, price, lastPrice, deviation);
                revert("Price deviation too high - requires manual review");
            }
        }

        // 5. Update price
        prices[pair] = PriceData({
            price: price,
            timestamp: timestamp,
            lastUpdate: block.timestamp
        });

        emit PriceUpdated(pair, price, timestamp);
    }

    /**
     * @notice Get latest price for a pair
     * @param pair Pair identifier
     * @return price Latest price
     * @return timestamp Price timestamp
     */
    function getPrice(bytes32 pair)
        external
        view
        returns (uint256 price, uint256 timestamp)
    {
        require(prices[pair].price > 0, "Price not set");
        require(!isStale(pair), "Price is stale");
        return (prices[pair].price, prices[pair].timestamp);
    }

    /**
     * @notice Check if price is stale
     * @param pair Pair identifier
     * @return True if price is stale
     */
    function isStale(bytes32 pair) public view returns (bool) {
        if (prices[pair].lastUpdate == 0) return true;
        return block.timestamp - prices[pair].lastUpdate > MAX_ORACLE_AGE;
    }

    /**
     * @notice Verify oracle signature
     * @param pair Pair identifier
     * @param price Price value
     * @param timestamp Price timestamp
     * @param signature ECDSA signature
     * @return True if signature is valid
     */
    function verifySignature(
        bytes32 pair,
        uint256 price,
        uint256 timestamp,
        bytes calldata signature
    ) public view returns (bool) {
        // Recreate message hash
        bytes32 messageHash = keccak256(
            abi.encodePacked(pair, price, timestamp)
        );

        // Add Ethereum signed message prefix
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();

        // Recover signer
        address signer = ethSignedMessageHash.recover(signature);

        // Verify signer is oracle
        return signer == oracleAddress;
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
