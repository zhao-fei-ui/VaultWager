# VaultWager — Encrypted Dice on Sepolia with Zama FHEVM

VaultWager is a privacy-first dice wagering dApp. Players swap ETH for encrypted points (1 ETH = 1000 points) and guess Big/Small on two on-chain dice. Rolls, balances, guesses, and error codes stay encrypted end-to-end through Zama’s FHEVM, and are only decrypted for the requesting wallet via the Zama relayer.

## Why VaultWager
- **Provable fairness with privacy**: Dice are rolled on-chain with FHE-backed randomness; values never appear in plaintext.
- **Self-sovereign balance**: Points live as encrypted state; only the owner can decrypt through the relayer flow.
- **Simple, repeatable gameplay**: +10 points on correct guesses, -10 points (capped at available points) on incorrect ones.
- **Full-stack FHE example**: Demonstrates Solidity FHE patterns, relayer decryption on the frontend, and operational scripts for local and Sepolia usage.

## How the Game Works
1. **Deposit**: Call `purchasePoints` with ETH; the contract mints 1000 encrypted points per ETH (uint64-capped).
2. **Play**: Call `playRound(guessBig)` to roll two encrypted dice (1–6). Totals ≥7 resolve “Big,” otherwise “Small.”
3. **Settlement**: Balances adjust by ±10 encrypted points; insufficient balance on a loss records an encrypted error code.
4. **Decrypt**: The frontend requests ciphertext handles for balance, last round, and last error; users sign an EIP-712 request and retrieve clear values via the Zama relayer.

## Tech Stack
- **Smart contract**: Solidity 0.8.27, Zama FHEVM library (`FHE`, encrypted ints/bools), `ZamaEthereumConfig`.
- **Tooling**: Hardhat, hardhat-deploy, TypeChain, solidity-coverage, gas reporter, ESLint + Prettier.
- **Frontend**: React + Vite + RainbowKit + wagmi/viem (reads) + ethers (writes), Zama relayer SDK for decryption. No Tailwind, no frontend env vars.
- **Networks**: Hardhat/anvil for local dev, Sepolia via Infura for testnet deployment.

## Repository Map
- `contracts/`: `VaultWagerGame.sol` with encrypted balances, dice, and error tracking.
- `deploy/`: hardhat-deploy script for deterministic deployments.
- `tasks/`: CLI helpers to deposit, play, and decrypt round data from the console.
- `test/`: Hardhat tests using the FHE mock runtime.
- `deployments/`: Stored ABIs and addresses (use these to sync the frontend).
- `ui/`: Vite React dApp (Sepolia-only) with RainbowKit connection and relayer-based decryption.
- `docs/`: Zama FHE and relayer references kept locally.

## Backend Setup (Hardhat)
Prerequisites: Node 20+, npm, and a funded private key for Sepolia operations.

1) Install dependencies  
```bash
npm install
```

2) Environment (`.env` in repo root; do not use a mnemonic)  
```
INFURA_API_KEY=your_infura_key
PRIVATE_KEY=0xYourPrivateKey       # used for deploy & tasks
ETHERSCAN_API_KEY=optional_for_verify
```

3) Compile and test (uses the FHE mock on Hardhat; sepolia tests are optional)  
```bash
npm run compile
npm run test
```

4) Local dev network (Hardhat/anvil)  
```bash
npx hardhat node --network hardhat --no-deploy
npm run deploy:localhost           # in a separate terminal
```

5) Sepolia deployment (respects `INFURA_API_KEY` and `PRIVATE_KEY`)  
```bash
npm run deploy:sepolia
# verify with: npx hardhat verify --network sepolia <DEPLOYED_ADDRESS>
```

### Useful Hardhat Tasks
- `npx hardhat game:address --network <net>` – prints the deployed contract.
- `npx hardhat game:deposit --eth 0.25 --network <net>` – swaps ETH for points.
- `npx hardhat game:play --guess big --network <net>` – plays a round.
- `npx hardhat game:balance --network <net>` – decrypts a player’s balance.
- `npx hardhat game:round --network <net>` – decrypts the last round and error code.

## Frontend (ui/)
The frontend is fixed to Sepolia and uses only code-based configuration.

1) Install and run  
```bash
cd ui
npm install
npm run dev        # Vite dev server
```

2) Configure connections  
- `ui/src/config/contracts.ts`: set `CONTRACT_ADDRESS` and `CONTRACT_ABI` from `deployments/sepolia/VaultWagerGame.json` after deployment.  
- `ui/src/config/wagmi.ts`: set `projectId` (WalletConnect Cloud) and keep `chains: [sepolia]`.

3) Play flow  
- Connect wallet with RainbowKit (Sepolia).  
- Purchase points (writes via ethers).  
- Play Big/Small (writes via ethers).  
- Decrypt balance/round/error handles (reads via wagmi/viem + Zama relayer).  
- All ciphertexts are displayed before decryption for transparency.

## Problems Solved
- **Private state on public chains**: Balances and dice stay encrypted end-to-end; only holders decrypt.  
- **Fair randomness**: Dice use FHE-backed randomness and are never revealed until user-driven decryption.  
- **Operational clarity**: Tasks, deploy scripts, and stored ABIs reduce integration drift between contract and dApp.  
- **Risk containment**: Overflow-guarded conversions, capped deductions, and explicit error codes for insufficient balance.

## Future Work
- Add leaderboards and achievements using consented decrypted snapshots.  
- Multi-chain expansion once additional FHE-enabled networks are stable.  
- Session keys for repeated decryptions without repeated signatures (subject to relayer policy).  
- UI polish for mobile and richer game stats once more analytics are available.  
- Optional oracle-backed randomness comparison to benchmark FHE dice against alternative sources.

## License
BSD-3-Clause-Clear. See `LICENSE`.
