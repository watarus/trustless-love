# Trustless Love

Privacy-preserving dating app powered by Zama fhEVM (Fully Homomorphic Encryption).

**Live Demo**: https://trustless-love.vercel.app

## Overview

Trustless Love is a Tinder-like dating application where your swipe decisions remain completely private until a mutual match is confirmed. Using Fully Homomorphic Encryption (FHE), the app computes whether two users have both "liked" each other **without ever revealing individual votes**.

## How It Works

```
Alice likes Bob → Encrypted vote stored on-chain (nobody knows)
Bob likes Alice → Encrypted vote stored on-chain (nobody knows)

Alice requests match check:
  → Contract computes: Alice_vote AND Bob_vote (homomorphically)
  → Result is decrypted only by Alice
  → If true: MATCH! Contact info revealed
  → If false: No match, votes remain secret
```

## Architecture

### Hybrid Architecture

| Component | Technology | Purpose |
|-----------|------------|---------|
| Encrypted Votes | Zama fhEVM (Sepolia) | Privacy-preserving vote storage & computation |
| User Profiles | Supabase | Fast profile queries & contact info storage |
| Frontend | Next.js + Vercel | User interface |

### Smart Contract

- **Network**: Sepolia Testnet (fhEVM v0.9)
- **Contract**: `0xD94F9de87176bd92717B633095123690e8cDD0a8`
- **Key Functions**:
  - `register()` - Register as a user
  - `vote(target, encryptedBool, proof)` - Cast encrypted like/dislike
  - `prepareMatchCheck(target)` - Compute encrypted AND of mutual votes
  - `hasVoted(from, to)` - Check if vote exists (not the value)

### User Decrypt Flow (fhEVM v0.9)

```
1. User calls prepareMatchCheck(target) on-chain
2. Contract computes: isMatch = FHE.and(myVote, theirVote)
3. Contract grants ACL permission to user
4. Frontend generates keypair & requests EIP-712 signature
5. Frontend calls userDecrypt() via Zama Relayer
6. Result decrypted locally - only user sees the answer
```

## Tech Stack

- **Frontend**: Next.js 14, React 18, TailwindCSS
- **Blockchain**: ethers.js v6, Zama fhEVM
- **FHE SDK**: @zama-fhe/relayer-sdk 0.3.0-6
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel

## Local Development

### Prerequisites

- Node.js 18+
- pnpm
- MetaMask with Sepolia ETH

### Setup

```bash
# Clone
git clone https://github.com/watarus/trustless-love.git
cd trustless-love

# Install dependencies
pnpm install

# Environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run dev server
pnpm dev
```

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Supabase Schema

```sql
CREATE TABLE profiles (
  wallet_address TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bio TEXT,
  image_url TEXT NOT NULL,
  telegram_id TEXT,
  twitter_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Contract Development

```bash
cd contracts

# Install Foundry dependencies
forge install

# Build
forge build

# Deploy to Sepolia
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC --broadcast
```

## Key Features

- **True Privacy**: Votes are encrypted on-chain, never visible to anyone
- **Trustless Verification**: Match computation happens on-chain via FHE
- **User-Controlled Decryption**: Only the requesting user can decrypt match results
- **No Central Authority**: No server ever sees your swipe decisions

## Limitations

- **Zama Relayer Dependency**: Decryption requires Zama's relayer service
- **Sepolia Only**: Currently deployed on testnet
- **Gas Costs**: FHE operations are more expensive than regular transactions

## License

MIT

## Acknowledgments

- [Zama](https://www.zama.ai/) - fhEVM and FHE tooling
- [fhEVM Documentation](https://docs.zama.ai/fhevm)
