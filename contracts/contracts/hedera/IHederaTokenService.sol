// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

interface IHederaTokenService {
    struct AccountAmount {
        address accountID;
        int64 amount;
        bool isApproval;
    }

    struct NftTransfer {
        address senderAccountID;
        address receiverAccountID;
        int64 serialNumber;
        bool isApproval;
    }

    struct TokenTransferList {
        address token;
        AccountAmount[] transfers;
        NftTransfer[] nftTransfers;
    }

    struct TransferList {
        AccountAmount[] transfers;
    }

    /// Transfers tokens where the calling contract is the sender
    function transferToken(address token, address sender, address receiver, int64 amount) external returns (int32 responseCode);
    
    /// Transfers multiple tokens atomically
    function transferTokens(address token, address[] memory accountIds, int64[] memory amounts) external returns (int32 responseCode);

    /// Associates the provided account with the provided token
    function associateToken(address account, address token) external returns (int32 responseCode);

    /// Associates the provided account with the provided tokens
    function associateTokens(address account, address[] calldata tokens) external returns (int32 responseCode);
    
    /// Gets the balance of a token for an account
    function getTokenBalance(address token, address account) external returns (int32 responseCode, int64 balance);
    
    /// Performs multiple token transfers atomically
    function cryptoTransfer(TransferList memory transferList, TokenTransferList[] memory tokenTransfers) external returns (int32 responseCode);
}
