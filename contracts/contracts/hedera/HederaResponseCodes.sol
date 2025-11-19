// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

library HederaResponseCodes {
    int32 internal constant SUCCESS = 22;
    int32 internal constant INVALID_TOKEN_ID = 167;
    int32 internal constant INVALID_ACCOUNT_ID = 21;
    int32 internal constant INSUFFICIENT_TOKEN_BALANCE = 178;
    int32 internal constant TOKEN_NOT_ASSOCIATED_TO_ACCOUNT = 184;
    int32 internal constant AMOUNT_EXCEEDS_TOKEN_MAX_SUPPLY = 169;
    int32 internal constant INVALID_SIGNATURE = 7;
    int32 internal constant CONTRACT_REVERT_EXECUTED = 33;
}
