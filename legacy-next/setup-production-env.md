# Production Environment Setup

## Required Environment Variables for Vercel

Set these in your Vercel dashboard (https://vercel.com/dashboard):

### Navigate to:
Project → Settings → Environment Variables

### Add these variables:

```bash
# Public variables
NEXT_PUBLIC_APP_URL=https://api.lovepass.io
NEXT_PUBLIC_DEV_AUTH=dev-compose-token-2024

# Private server variables  
INBOUND_SECRET=lovepass-prod-secret-2024-secure
MAINNET_RPC_URL=https://ethereum.publicnode.com
SEPOLIA_RPC_URL=https://ethereum-sepolia.publicnode.com
IPFS_GATEWAY=https://ipfs.io

# Database - PostgreSQL for production
POSTGRES_URL=postgresql://username:password@host.neon.tech/database_name

# Fallback SQLite path (not used when POSTGRES_URL is set)
LOVEPASS_DB_PATH=/tmp/lovepass.db
```

## Alternative: Set via CLI

```bash
# Set each variable
npx vercel env add POSTGRES_URL production
# Enter your Neon connection string when prompted

npx vercel env add INBOUND_SECRET production  
# Enter: lovepass-prod-secret-2024-secure

npx vercel env add NEXT_PUBLIC_APP_URL production
# Enter: https://api.lovepass.io

# ... repeat for all variables
```

## Test Commands After Setup

```bash
# Test health endpoint
curl https://api.lovepass.io/api/health/db

# Should return:
# {"ok":true,"driver":"postgres","rows":0}

# Test mailbox (should be empty initially)
curl "https://api.lovepass.io/api/mailbox?name=test.eth&net=mainnet"

# Should return:
# {"name":"test.eth","net":"mainnet","messages":[],"total":0,"limit":50,"offset":0}
```
