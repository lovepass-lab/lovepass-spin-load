// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LovepassGold is Ownable, Pausable, ReentrancyGuard {
    struct User {
        uint64 expiry; // unix seconds
        uint8 tier; // 0=free, 1=Gold, 2=Platinum future
        bool revoked; // if true, disabled regardless of expiry
    }

    // 30 days constant in seconds
    uint256 public constant SECONDS_PER_30D = 30 days;

    // Pricing and ops
    uint256 public priceWeiPer30d;
    address payable public treasury;
    address public operator; // hot wallet for ops
    uint64 public graceSeconds; // e.g., 48h

    mapping(address => User) public users;

    // Events
    event Subscribed(address indexed user, uint8 months, uint64 newExpiry, uint8 tier, uint256 value);
    event Renewed(address indexed user, uint8 months, uint64 newExpiry, uint8 tier, uint256 value);
    event Granted(address indexed to, uint64 secondsGranted, uint8 tier, uint64 newExpiry);
    event Revoked(address indexed user, string reason);
    event Unrevoked(address indexed user);
    event PriceChanged(uint256 oldPrice, uint256 newPrice);
    event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury);
    event OperatorChanged(address indexed oldOperator, address indexed newOperator);
    event GraceChanged(uint64 oldGrace, uint64 newGrace);
    event Withdrawn(address indexed to, uint256 amount);

    modifier onlyOwnerOrOperator() {
        require(msg.sender == owner() || msg.sender == operator, "not auth");
        _;
    }

    constructor(
        uint256 priceWeiPer30d_,
        address payable treasury_,
        address operator_,
        uint64 graceSeconds_
    ) Ownable(msg.sender) {
        require(treasury_ != address(0), "treasury=0");
        require(operator_ != address(0), "operator=0");
        priceWeiPer30d = priceWeiPer30d_;
        treasury = treasury_;
        operator = operator_;
        graceSeconds = graceSeconds_;
    }

    // View helper for extension
    function isActive(address user)
        public
        view
        returns (bool active, uint64 expiry, uint8 tier, bool revoked)
    {
        User memory u = users[user];
        expiry = u.expiry;
        tier = u.tier;
        revoked = u.revoked;
        active = !revoked && tier > 0 && block.timestamp <= uint256(expiry) + uint256(graceSeconds);
    }

    // Subscribe and renew
    function subscribe(uint8 months_) external payable nonReentrant whenNotPaused {
        _subscribe(months_, false);
    }

    function renew(uint8 months_) external payable nonReentrant whenNotPaused {
        _subscribe(months_, true);
    }

    function _subscribe(uint8 months_, bool isRenew_) internal {
        require(months_ > 0, "months=0");
        uint256 cost = uint256(months_) * priceWeiPer30d;
        require(msg.value >= cost, "insufficient ETH");

        User storage u = users[msg.sender];
        (bool currentlyActive,, ,) = isActive(msg.sender);
        uint64 base = currentlyActive && u.expiry > 0 && u.expiry > uint64(block.timestamp)
            ? u.expiry
            : uint64(block.timestamp);
        uint64 added = uint64(uint256(months_) * SECONDS_PER_30D);
        uint64 newExpiry = base + added;

        u.expiry = newExpiry;
        u.tier = 1; // Gold
        u.revoked = false;

        if (isRenew_) {
            emit Renewed(msg.sender, months_, newExpiry, u.tier, msg.value);
        } else {
            emit Subscribed(msg.sender, months_, newExpiry, u.tier, msg.value);
        }
        // Dust is kept by contract per spec (no refund). Owner withdraws to treasury via withdraw().
    }

    // Admin comp/gift
    function grant(address to, uint64 seconds_, uint8 tier_) public onlyOwnerOrOperator {
        _grant(to, seconds_, tier_);
    }

    function grantBatch(address[] calldata users_, uint64 seconds_, uint8 tier_) external onlyOwnerOrOperator {
        for (uint256 i = 0; i < users_.length; i++) {
            _grant(users_[i], seconds_, tier_);
        }
    }

    function _grant(address to, uint64 seconds_, uint8 tier_) internal {
        require(to != address(0), "to=0");
        require(tier_ > 0, "tier=0");
        User storage u = users[to];
        uint64 base = u.expiry > uint64(block.timestamp) ? u.expiry : uint64(block.timestamp);
        uint64 newExpiry = base + seconds_;
        u.expiry = newExpiry;
        u.tier = tier_;
        u.revoked = false;
        emit Granted(to, seconds_, tier_, newExpiry);
    }

    // Revoke/unrevoke
    function revoke(address user, string calldata reason) external onlyOwnerOrOperator {
        users[user].revoked = true;
        emit Revoked(user, reason);
    }

    function unrevoke(address user) external onlyOwnerOrOperator {
        users[user].revoked = false;
        emit Unrevoked(user);
    }

    // Admin knobs
    function setPriceWeiPer30d(uint256 newPrice) external onlyOwner {
        emit PriceChanged(priceWeiPer30d, newPrice);
        priceWeiPer30d = newPrice;
    }

    function setTreasury(address payable newTreasury) external onlyOwner {
        require(newTreasury != address(0), "treasury=0");
        emit TreasuryChanged(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setOperator(address newOperator) external onlyOwner {
        require(newOperator != address(0), "operator=0");
        emit OperatorChanged(operator, newOperator);
        operator = newOperator;
    }

    function setGraceSeconds(uint64 secs) external onlyOwner {
        emit GraceChanged(graceSeconds, secs);
        graceSeconds = secs;
    }

    function pause() external onlyOwner {
        _pause(); // OZ emits Paused
    }

    function unpause() external onlyOwner {
        _unpause(); // OZ emits Unpaused
    }

    // Withdraw pattern
    function withdraw() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        require(bal > 0, "no funds");
        address payable to = treasury;
        require(to != address(0), "treasury=0");
        (bool ok, ) = to.call{value: bal}("");
        require(ok, "withdraw fail");
        emit Withdrawn(to, bal);
    }

    // Receive ETH fallback (in case someone sends directly). Does not auto-subscribe.
    receive() external payable {}
}
