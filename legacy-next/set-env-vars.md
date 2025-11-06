# 🔧 Set Vercel Environment Variables

## Method 1: Vercel Dashboard (Recommended)

1. **Go to**: https://vercel.com/dashboard
2. **Find your project**: "lovepass" 
3. **Navigate to**: Settings → Environment Variables
4. **Add these variables for Production:**

### Required Variables:

```bash
# Database (PostgreSQL)
POSTGRES_URL
postgresql://neondb_owner:npg_rAKZI8jGTc6X@ep-billowing-sun-adi3fwu7-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Authentication Secret
INBOUND_SECRET
lovepass-prod-secret-2024-secure

# Public App URL
NEXT_PUBLIC_APP_URL
https://api.lovepass.io

# RPC URLs (optional - have defaults)
MAINNET_RPC_URL
https://ethereum.publicnode.com

SEPOLIA_RPC_URL
https://ethereum-sepolia.publicnode.com

IPFS_GATEWAY
https://ipfs.io
```

## Method 2: CLI Commands

Run these one by one and enter the values when prompted:

```bash
# Set PostgreSQL URL
npx vercel env add POSTGRES_URL production
# Enter: postgresql://neondb_owner:npg_rAKZI8jGTc6X@ep-billowing-sun-adi3fwu7-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Set auth secret
npx vercel env add INBOUND_SECRET production
# Enter: lovepass-prod-secret-2024-secure

# Set public URL
npx vercel env add NEXT_PUBLIC_APP_URL production
# Enter: https://api.lovepass.io
```

## After Setting Variables:

1. **Redeploy**:
   ```bash
   npx vercel --prod
   ```

2. **Test**:
   ```bash
   node scripts/test-production.mjs
   ```

3. **Expected Results**:
   ```json
   {
     "ok": true,
     "driver": "postgres", 
     "rows": 0
   }
   ```
