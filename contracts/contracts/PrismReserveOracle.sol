// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PrismReserveOracle
 * @notice Manages collateral reserves and Proof of Reserves for Prism Finance
 * @dev Tracks HBAR collateral, publishes attestations to HCS, and manages multisig admin
 */
contract PrismReserveOracle {
    // State variables
    address public admin;
    address public pendingAdmin;
    address public vault;
    mapping(address => bool) public attestors;
    
    uint256 public totalHbarCollateral;
    uint256 public totalSyntheticValue;
    uint256 public lastAttestationTime;
    bytes32 public lastMerkleRoot;
    
    // HCS Topic ID for attestations (stored as uint256)
    uint256 public hcsTopicId;
    
    // Collateral ratio (150% = 1.5e18)
    uint256 public constant MIN_COLLATERAL_RATIO = 1.5e18;
    uint256 public constant RATIO_PRECISION = 1e18;
    
    // Events
    event CollateralDeposited(address indexed depositor, uint256 amount);
    event CollateralWithdrawn(address indexed recipient, uint256 amount);
    event AttestationPublished(bytes32 merkleRoot, uint256 timestamp);
    event AttestorAdded(address indexed attestor);
    event AttestorRemoved(address indexed attestor);
    event AdminTransferInitiated(address indexed newAdmin);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    modifier onlyAttestor() {
        require(attestors[msg.sender], "Only attestor");
        _;
    }
    
    modifier onlyVault() {
        require(msg.sender == vault, "Only vault");
        _;
    }
    
    constructor(address _admin, uint256 _hcsTopicId) {
        admin = _admin;
        hcsTopicId = _hcsTopicId;
        emit AdminTransferred(address(0), _admin);
    }
    
    /**
     * @notice Deposit HBAR collateral
     */
    function depositCollateral() external payable {
        require(msg.value > 0, "Must deposit HBAR");
        totalHbarCollateral += msg.value;
        emit CollateralDeposited(msg.sender, msg.value);
    }
    
    /**
     * @notice Withdraw HBAR collateral (admin only)
     */
    function withdrawCollateral(address payable recipient, uint256 amount) external onlyAdmin {
        require(amount <= totalHbarCollateral, "Insufficient collateral");
        require(_checkCollateralRatio(amount), "Would break collateral ratio");
        
        totalHbarCollateral -= amount;
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit CollateralWithdrawn(recipient, amount);
    }
    
    /**
     * @notice Withdraw HBAR for vault operations (no collateral ratio check)
     * @dev Used by vault to return collateral to users
     */
    function withdrawForVault(address payable recipient, uint256 amount) external onlyVault {
        require(amount <= totalHbarCollateral, "Insufficient collateral");
        
        totalHbarCollateral -= amount;
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit CollateralWithdrawn(recipient, amount);
    }
    
    /**
     * @notice Set vault address (admin only)
     */
    function setVault(address _vault) external onlyAdmin {
        vault = _vault;
    }
    
    /**
     * @notice Update total synthetic value (called by vault contracts)
     */
    function updateSyntheticValue(uint256 newValue) external onlyAdmin {
        totalSyntheticValue = newValue;
    }
    
    /**
     * @notice Publish attestation (merkle root of reserves)
     */
    function publishAttestation(bytes32 merkleRoot) external onlyAttestor {
        lastMerkleRoot = merkleRoot;
        lastAttestationTime = block.timestamp;
        emit AttestationPublished(merkleRoot, block.timestamp);
    }
    
    /**
     * @notice Add attestor
     */
    function addAttestor(address attestor) external onlyAdmin {
        attestors[attestor] = true;
        emit AttestorAdded(attestor);
    }
    
    /**
     * @notice Remove attestor
     */
    function removeAttestor(address attestor) external onlyAdmin {
        attestors[attestor] = false;
        emit AttestorRemoved(attestor);
    }
    
    /**
     * @notice Get current collateral ratio
     * @return ratio Collateral ratio with 18 decimals (1.5e18 = 150%)
     */
    function getCollateralRatio() public view returns (uint256) {
        if (totalSyntheticValue == 0) return type(uint256).max;
        return (totalHbarCollateral * RATIO_PRECISION) / totalSyntheticValue;
    }
    
    /**
     * @notice Check if system is healthy
     */
    function isHealthy() public view returns (bool) {
        return getCollateralRatio() >= MIN_COLLATERAL_RATIO;
    }
    
    /**
     * @notice Initiate admin transfer (2-step process)
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        pendingAdmin = newAdmin;
        emit AdminTransferInitiated(newAdmin);
    }
    
    /**
     * @notice Accept admin transfer
     */
    function acceptAdmin() external {
        require(msg.sender == pendingAdmin, "Not pending admin");
        address oldAdmin = admin;
        admin = pendingAdmin;
        pendingAdmin = address(0);
        emit AdminTransferred(oldAdmin, admin);
    }
    
    /**
     * @dev Internal check for collateral ratio after withdrawal
     */
    function _checkCollateralRatio(uint256 withdrawAmount) internal view returns (bool) {
        if (totalSyntheticValue == 0) return true;
        uint256 newCollateral = totalHbarCollateral - withdrawAmount;
        uint256 newRatio = (newCollateral * RATIO_PRECISION) / totalSyntheticValue;
        return newRatio >= MIN_COLLATERAL_RATIO;
    }
    
    /**
     * @notice Get contract info
     */
    function getInfo() external view returns (
        uint256 collateral,
        uint256 syntheticValue,
        uint256 ratio,
        bool healthy,
        uint256 lastAttestation
    ) {
        return (
            totalHbarCollateral,
            totalSyntheticValue,
            getCollateralRatio(),
            isHealthy(),
            lastAttestationTime
        );
    }
    
    // Receive HBAR
    receive() external payable {
        totalHbarCollateral += msg.value;
        emit CollateralDeposited(msg.sender, msg.value);
    }
}
