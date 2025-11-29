// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, ebool, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title TrustlessLove - FHE-powered anonymous matching (v0.9 Re-encryption Model)
/// @notice Uses user re-encryption for private decryption
contract TrustlessLove is ZamaEthereumConfig {
    // User registration status
    mapping(address => bool) public registered;

    // Encrypted votes: from => to => encryptedBool
    mapping(address => mapping(address => ebool)) internal likes;

    // Match result handles: user => handle (for re-encryption)
    mapping(address => uint256) public matchResultHandles;

    // Match result revealed status
    mapping(address => mapping(address => bool)) public matchRevealed;

    // Events
    event UserRegistered(address user);
    event VoteCast(address indexed from, address indexed to);
    event MatchCheckPrepared(address indexed requester, address indexed target, uint256 handle);

    // 1. Register user
    function register() public {
        registered[msg.sender] = true;
        emit UserRegistered(msg.sender);
    }

    // 2. Cast encrypted vote (Like/Dislike)
    function vote(address target, externalEbool inputEbool, bytes calldata inputProof) public {
        require(registered[msg.sender], "User not registered");
        require(registered[target], "Target not registered");

        ebool encryptedBool = FHE.fromExternal(inputEbool, inputProof);
        likes[msg.sender][target] = encryptedBool;

        FHE.allowThis(encryptedBool);
        FHE.allow(encryptedBool, msg.sender);

        emit VoteCast(msg.sender, target);
    }

    // 3. Prepare match check - compute AND and allow requester to re-encrypt
    function prepareMatchCheck(address target) public returns (uint256) {
        require(registered[msg.sender], "User not registered");
        require(registered[target], "Target not registered");

        ebool myVote = likes[msg.sender][target];
        ebool theirVote = likes[target][msg.sender];

        require(FHE.isInitialized(myVote), "You haven't voted for this target");
        require(FHE.isInitialized(theirVote), "Target hasn't voted for you");

        // Compute match: A voted for B AND B voted for A
        ebool isMatch = FHE.and(myVote, theirVote);

        // Allow contract and requester for user decrypt
        FHE.allowThis(isMatch);  // Contract must be allowed for ACL check
        FHE.allow(isMatch, msg.sender);

        // Store handle for re-encryption
        uint256 handle = uint256(FHE.toBytes32(isMatch));
        matchResultHandles[msg.sender] = handle;

        emit MatchCheckPrepared(msg.sender, target, handle);
        return handle;
    }

    // View: Check if user has voted for another
    function hasVoted(address from, address to) public view returns (bool) {
        return FHE.isInitialized(likes[from][to]);
    }

    // View: Check if match has been revealed
    function isMatchRevealed(address user, address target) public view returns (bool) {
        return matchRevealed[user][target];
    }

    // View: Get match result handle for re-encryption
    function getMatchResultHandle(address user) public view returns (uint256) {
        return matchResultHandles[user];
    }
}
