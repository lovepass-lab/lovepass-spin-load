// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MailboxRegistry (v1)
/// @notice Minimal registry mapping ENS namehash to mailbox pointers
///         - encryptionPubKey: public key bytes (e.g., X25519 public key)
///         - feedHeadCID: CID string for the head of the append-only IPLD feed
///         - version: application-defined semantic version (client uses this)
///         - controller: address allowed to update this entry (v1 simplification)
///
/// Security model (v1): first caller to set a node becomes controller. Updates require controller.
/// Future: integrate ENS ownership checks or an 
///         off-chain proof-based controller verification if desired.
contract MailboxRegistry {
    struct Entry {
        bytes encryptionPubKey; // e.g., 32 bytes X25519 public key
        string feedHeadCID;     // IPFS CID string (multibase)
        uint32 version;         // client-meaningful version
        address controller;     // address with update rights in v1
    }

    mapping(bytes32 => Entry) private entries; // node => entry

    event MailboxSet(
        bytes32 indexed node,
        address indexed controller,
        bytes encryptionPubKey,
        string feedHeadCID,
        uint32 version
    );

    event MailboxUpdated(
        bytes32 indexed node,
        address indexed controller,
        bytes encryptionPubKey,
        string feedHeadCID,
        uint32 version
    );

    event ControllerTransferred(bytes32 indexed node, address indexed from, address indexed to);

    error NotController();
    error AlreadyInitialized();

    /// @notice Create a new mailbox entry for a namehash `node`.
    ///         The caller becomes the controller.
    function setMailbox(
        bytes32 node,
        bytes calldata encryptionPubKey,
        string calldata feedHeadCID,
        uint32 version
    ) external {
        Entry storage e = entries[node];
        if (e.controller != address(0)) revert AlreadyInitialized();
        e.encryptionPubKey = encryptionPubKey;
        e.feedHeadCID = feedHeadCID;
        e.version = version;
        e.controller = msg.sender;
        emit MailboxSet(node, msg.sender, encryptionPubKey, feedHeadCID, version);
    }

    /// @notice Update an existing mailbox entry. Only controller may call.
    function updateMailbox(
        bytes32 node,
        bytes calldata encryptionPubKey,
        string calldata feedHeadCID,
        uint32 version
    ) external {
        Entry storage e = entries[node];
        if (e.controller != msg.sender) revert NotController();
        e.encryptionPubKey = encryptionPubKey;
        e.feedHeadCID = feedHeadCID;
        e.version = version;
        emit MailboxUpdated(node, msg.sender, encryptionPubKey, feedHeadCID, version);
    }

    /// @notice Update only the head CID and bump the version.
    function updateFeedHead(
        bytes32 node,
        string calldata newHeadCID,
        uint32 newVersion
    ) external {
        Entry storage e = entries[node];
        if (e.controller != msg.sender) revert NotController();
        e.feedHeadCID = newHeadCID;
        e.version = newVersion;
        emit MailboxUpdated(node, msg.sender, e.encryptionPubKey, newHeadCID, newVersion);
    }

    /// @notice Transfer controller rights to another address.
    function transferController(bytes32 node, address newController) external {
        Entry storage e = entries[node];
        if (e.controller != msg.sender) revert NotController();
        address prev = e.controller;
        e.controller = newController;
        emit ControllerTransferred(node, prev, newController);
    }

    /// @notice Read the mailbox entry for a node.
    function getMailbox(bytes32 node)
        external
        view
        returns (
            bytes memory encryptionPubKey,
            string memory feedHeadCID,
            uint32 version,
            address controller
        )
    {
        Entry storage e = entries[node];
        return (e.encryptionPubKey, e.feedHeadCID, e.version, e.controller);
    }
}
