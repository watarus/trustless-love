// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title TrustlessLove - Fhenix CoFHE Version
/// @notice Mutual match detection using FHE (Fully Homomorphic Encryption)
contract TrustlessLoveCoFHE {
    // User registration status
    mapping(address => bool) public registered;

    // Encrypted votes: from => to => encryptedBool
    mapping(address => mapping(address => ebool)) internal likes;

    // Match results for decryption
    mapping(address => ebool) public matchResults;

    // Events
    event UserRegistered(address user);
    event VoteCast(address indexed from, address indexed to);
    event MatchChecked(address indexed requester, address indexed target);
    event DecryptionRequested(address indexed user);

    // 1. Register user
    function register() public {
        registered[msg.sender] = true;
        emit UserRegistered(msg.sender);
    }

    // 2. Cast encrypted vote
    function vote(address target, InEbool memory encryptedVote) public {
        require(registered[msg.sender], "User not registered");
        require(registered[target], "Target not registered");

        ebool voteBool = FHE.asEbool(encryptedVote);
        likes[msg.sender][target] = voteBool;

        // Allow contract to use this value
        FHE.allowThis(voteBool);

        emit VoteCast(msg.sender, target);
    }

    // 3. Check match (compute AND, store result)
    function checkMatch(address target) public {
        require(registered[msg.sender], "User not registered");
        require(registered[target], "Target not registered");

        ebool myVote = likes[msg.sender][target];
        ebool theirVote = likes[target][msg.sender];

        require(ebool.unwrap(myVote) != 0, "You haven't voted for this target");
        require(ebool.unwrap(theirVote) != 0, "Target hasn't voted for you");

        // Compute match: A voted for B AND B voted for A
        ebool isMatch = FHE.and(myVote, theirVote);

        // Store result
        matchResults[msg.sender] = isMatch;

        // Allow contract and sender to access
        FHE.allowThis(isMatch);
        FHE.allowSender(isMatch);

        emit MatchChecked(msg.sender, target);
    }

    // 4. Request decryption (async in CoFHE)
    function requestDecrypt() public {
        ebool result = matchResults[msg.sender];
        require(ebool.unwrap(result) != 0, "No match result available");

        FHE.decrypt(result);
        emit DecryptionRequested(msg.sender);
    }

    // 5. Get decrypted result (call after decryption is ready)
    function getDecryptedResult() public view returns (bool isMatch, bool decrypted) {
        ebool result = matchResults[msg.sender];
        (isMatch, decrypted) = FHE.getDecryptResultSafe(result);
    }

    // View: Check if user has voted for another
    function hasVoted(address from, address to) public view returns (bool) {
        return ebool.unwrap(likes[from][to]) != 0;
    }
}
