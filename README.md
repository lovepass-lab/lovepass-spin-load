# Lovepass Gold Contract + Tests + Readme

Ethereum subscription contract for Lovepass Gold. Solidity 0.8.x using OpenZeppelin Ownable, Pausable, ReentrancyGuard.

## Features
- ETH subscription: `subscribe(uint8 months)` and `renew(uint8 months)` extend `expiry` (30 days per month), `tier=1`.
- Read helper: `isActive(address)` returns `(bool active, uint64 expiry, uint8 tier, bool revoked)`.
- Admin: `grant`, `grantBatch`, `revoke`, `unrevoke`.
- Admin knobs: price, treasury, operator, grace, pause/unpause.
- Payments accumulate in contract. `withdraw()` pushes to `treasury`.
- Events for all state changes.

## Setup
```bash
npm install
cp .env.sample .env
# fill in RPC URLs, PRIVATE_KEY, TREASURY, OPERATOR
```

## Build & Test
```bash
npm run build
npm test
```

## Deploy
```bash
# Sepolia
npm run deploy:sepolia
# Mainnet
npm run deploy:mainnet
```

Environment variables used by `scripts/deploy.js`:
- `PRICE_WEI_PER_30D`
- `TREASURY`
- `OPERATOR`
- `GRACE_SECONDS`

## Contract
Path: `contracts/LovepassGold.sol`

Constructor:
```solidity
constructor(uint256 priceWeiPer30d, address payable treasury, address operator, uint64 graceSeconds)
```

Helper:
```solidity
function isActive(address user) view returns (bool active, uint64 expiry, uint8 tier, bool revoked)
```

ABI snippet for `isActive`:
```json
[
  {
    "inputs": [{"internalType":"address","name":"user","type":"address"}],
    "name":"isActive",
    "outputs": [
      {"internalType":"bool","name":"active","type":"bool"},
      {"internalType":"uint64","name":"expiry","type":"uint64"},
      {"internalType":"uint8","name":"tier","type":"uint8"},
      {"internalType":"bool","name":"revoked","type":"bool"}
    ],
    "stateMutability":"view",
    "type":"function"
  }
]
```

Example ethers.js call:
```js
import { ethers } from "ethers";
const provider = new ethers.JsonRpcProvider(process.env.MAINNET_RPC_URL);
const abi = ["function isActive(address) view returns (bool,uint64,uint8,bool)"];
const contract = new ethers.Contract("0xYourContractAddress", abi, provider);
const [active, expiry, tier, revoked] = await contract.isActive("0xUserAddress");
```

## ENS wiring
Point `upgrade.lovepass.eth` to the deployed contract address.
Your docs should say:
- "Send exactly X ETH to upgrade.lovepass.eth for 30 days. Send 2× for 60 days, etc."

Note: direct ETH transfers to the contract do not auto-subscribe; users must call `subscribe(months)` (or use a forwarding/pay contract if desired).

## Notes
- Time math uses `30 days` Solidity literal (equivalent to 30*24*60*60).
- Rounding: if `msg.value` is slightly more than required, extra is kept as dust.
- Upgradability: v1 is immutable; deploy v2 later if needed.
