# Lovepass ENS CCIP Gateway - Deployment Guide

## Environment Variables for Production

### Required Environment Variables

Set these in your deployment platform (Vercel, Railway, etc.):

```bash
# Public variables (safe to expose to client)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_DEV_AUTH=your-dev-compose-token

# Private server variables (NEVER expose to client)
INBOUND_SECRET=your-secure-inbound-secret-here
MAINNET_RPC_URL=https://ethereum.publicnode.com
SEPOLIA_RPC_URL=https://ethereum-sepolia.publicnode.com
IPFS_GATEWAY=https://ipfs.io
LOVEPASS_DB_PATH=/tmp/lovepass.db
```

### Security Notes

- `INBOUND_SECRET`: Used to authenticate POST requests to `/api/email`
- `NEXT_PUBLIC_DEV_AUTH`: Only used for the dev compose form (dev environments only)
- `NEXT_PUBLIC_APP_URL`: Used for server-side rendering and client hydration
- Database path should be appropriate for your hosting platform

## Vercel Deployment

1. **Connect Repository**: Import your GitHub repo to Vercel
2. **Set Environment Variables**: Add all variables above in Vercel dashboard
3. **Deploy**: Vercel will auto-deploy on push

### Vercel Environment Variables

```bash
# In Vercel dashboard, add these:
NEXT_PUBLIC_APP_URL = https://your-app.vercel.app
INBOUND_SECRET = your-secure-secret
LOVEPASS_DB_PATH = /tmp/lovepass.db
# ... (add all others from .env.example)
```

## Testing Production Deployment

1. **Test CCIP endpoint**:
   ```bash
   curl "https://your-app.vercel.app/api/ccip?name=vitalik.eth"
   ```

2. **Test mailbox (should be empty initially)**:
   ```bash
   curl "https://your-app.vercel.app/api/mailbox?name=test.eth&net=mainnet"
   ```

3. **Test email endpoint** (requires auth):
   ```bash
   curl -X POST "https://your-app.vercel.app/api/email" \
     -H "Content-Type: application/json" \
     -H "X-Auth-Token: your-secure-secret" \
     -d '{"to":"test@lovepass.eth","from":"demo@example.com","subject":"Test","text":"Hello"}'
   ```

4. **Test mailbox UI**:
   ```
   https://your-app.vercel.app/mailbox/test.eth?net=mainnet
   ```

## Security Checklist

- ✅ Server secrets not exposed to client
- ✅ CORS headers configured for API endpoints
- ✅ Auth token required for POST endpoints
- ✅ API routes have noindex headers
- ✅ Powered-by header disabled

## Database Considerations

- Current setup uses SQLite with file storage
- For production scale, consider migrating to PostgreSQL/MySQL
- Current path `/tmp/lovepass.db` works for serverless but data may not persist
- For persistent data, use a managed database service
