# NFT Marketplace — ERC721 on Base Sepolia

A full-stack NFT marketplace built with React, ethers.js, and a custom ERC721 Solidity smart contract deployed on Base Sepolia testnet. Users can mint, list, buy, and cancel NFT listings — with an admin panel for the contract owner to collect marketplace fees.

---

## Live Demo

> 🔗 **[https://nft-marketplace-developernarendra.vercel.app](https://nft-marketplace-developernarendra.vercel.app)**

---

## Features

| Feature | Description |
|---|---|
| **Connect Wallet** | MetaMask integration with Base Sepolia network detection |
| **Mint NFT** | Upload image to IPFS via Pinata, generate metadata, mint ERC721 token on-chain |
| **My NFTs** | View all NFTs you currently own (fetches past mint events) |
| **List for Sale** | Approve + list your NFT at a custom ETH price |
| **Marketplace** | Browse all active listings and buy any NFT |
| **Cancel Listing** | Remove your own NFT from the marketplace |
| **Admin Panel** | Owner-only: view and withdraw collected marketplace fees |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (hooks: useState, useEffect, useCallback) |
| Blockchain library | ethers.js v6 |
| Wallet | MetaMask |
| Smart Contract | Solidity ERC721 (deployed on Base Sepolia) |
| NFT Storage | IPFS via Pinata (image + metadata) |
| Network | Base Sepolia Testnet (Chain ID: 0x14a34 / 84532) |

---

## Project Structure

```
src/
├── App.js          # All React logic — wallet, mint, list, buy, admin
├── App.css         # Styling — tabs, cards, grid, responsive
└── contract.js     # CONTRACT_ADDRESS, CONTRACT_ABI, CONTRACT_DEPLOY_BLOCK
.env                # Pinata API credentials (never committed)
```

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/developernarendra/nft-marketplace.git
cd nft-marketplace
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root folder:

```env
REACT_APP_PINATA_JWT=your_pinata_jwt_token
# OR use API key pair:
REACT_APP_PINATA_API_KEY=your_pinata_api_key
REACT_APP_PINATA_SECRET_API_KEY=your_pinata_secret
```

Get your Pinata credentials at [pinata.cloud](https://pinata.cloud).

### 4. Set your contract deployment block (important)

In `src/contract.js`, set `CONTRACT_DEPLOY_BLOCK` to the block number when your contract was deployed.
Find it on [Base Sepolia explorer](https://sepolia.basescan.org).

```js
export const CONTRACT_DEPLOY_BLOCK = 38940000; // replace with your actual block
```

This prevents HTTP 413 errors when fetching NFT events.

### 5. Run locally

```bash
npm start
```

Open http://localhost:3000 in your browser.

---

## Smart Contract

- **Network:** Base Sepolia Testnet
- **Contract Address:** `0x715970c3F05B9B85364aBC3E9aeAa025a088d8ae`
- **Standard:** ERC721 + Ownable
- **Deployed with:** Remix IDE
- **Verified on:** [BaseScan](https://sepolia.basescan.org/address/0x715970c3F05B9B85364aBC3E9aeAa025a088d8ae)

### Contract Functions

| Function | Type | Description |
|---|---|---|
| `safeMint(uri)` | write | Mint a new NFT with metadata URI |
| `listNFT(tokenId, price)` | write | List NFT for sale (requires approve first) |
| `buyNFT(tokenId)` | payable | Buy a listed NFT, sends ETH to seller |
| `cancelListing(tokenId)` | write | Remove NFT from sale |
| `getAllListings()` | read | Returns all active listings |
| `collectedFees()` | read | Total marketplace fees collected |
| `withdrawFees()` | write (owner only) | Withdraw fees to owner wallet |

---

## How It Works — Mint Flow

```
1. User fills form (name, description, image)
        ↓
2. Image uploaded to IPFS via Pinata → returns Image CID
        ↓
3. Metadata JSON { name, description, image: IPFS URL }
   → uploaded to IPFS → returns Metadata CID
        ↓
4. contract.safeMint(metadataURL) called
   → MetaMask popup for approval
   → Transaction confirmed on Base Sepolia (~2 sec)
        ↓
5. NFT minted — tokenId assigned, ownership recorded on-chain
```

---

## Bugs Fixed During Development

| # | Bug | Fix |
|---|---|---|
| 1 | getSigner() missing await (ethers v6) | Added await provider.getSigner() |
| 2 | Mint never called the contract | Added contract.safeMint(url) + tx.wait() |
| 3 | Wrong CONTRACT_ADDRESS (wallet address used) | Deployed on Remix, used actual contract address |
| 4 | HTTP 413 — block range too large for RPC | Chunked queryFilter into 2000-block batches |
| 5 | Wrong Network banner on Base Sepolia | Changed chain ID from 0xaa36a7 to 0x14a34 |

---

## Environment Variables for Vercel Deployment

When deploying to Vercel, add these in **Project Settings → Environment Variables**:

```
REACT_APP_PINATA_JWT            = your_jwt
REACT_APP_PINATA_API_KEY        = your_key
REACT_APP_PINATA_SECRET_API_KEY = your_secret
```

---

## License

MIT — free to use and modify.

---

Built with React + ethers.js + Solidity on Base Sepolia.