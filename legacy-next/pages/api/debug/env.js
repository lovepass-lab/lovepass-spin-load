// Debug endpoint to check environment variables (no secrets exposed)
export default function handler(req, res) {
  // Get all env vars that might be relevant
  const envKeys = Object.keys(process.env).filter(key => 
    key.includes('POSTGRES') || 
    key.includes('DATABASE') || 
    key.includes('INBOUND') ||
    key.includes('NEXT_PUBLIC') ||
    key.includes('LOVEPASS') ||
    key.includes('NEON')
  );

  // Get all LOVEPASS variables specifically
  const lovepassKeys = Object.keys(process.env).filter(key => key.startsWith('LOVEPASS'));

  // Also get ALL environment variables to see what's available
  const allEnvKeys = Object.keys(process.env).sort();

  const debug = {
    nodeEnv: process.env.NODE_ENV,
    availableKeys: envKeys,
    lovepassKeys: lovepassKeys,
    allEnvCount: allEnvKeys.length,
    // Show first 20 env vars to see what's available
    sampleEnvKeys: allEnvKeys.slice(0, 20),
    hasPostgresUrl: !!process.env.POSTGRES_URL,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasNeonDatabaseUrl: !!process.env.NEON_DATABASE_URL,
    hasLovepassPostgresUrl: !!process.env.LOVEPASS_POSTGRES_URL,
    hasInboundSecret: !!process.env.INBOUND_SECRET,
    hasPublicAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
    postgresUrlLength: process.env.POSTGRES_URL?.length || 0,
    databaseUrlLength: process.env.DATABASE_URL?.length || 0,
    lovepassPostgresUrlLength: process.env.LOVEPASS_POSTGRES_URL?.length || 0,
    // Show first few chars for debugging (no password)
    postgresPrefix: process.env.POSTGRES_URL?.substring(0, 20) || 'none',
    databasePrefix: process.env.DATABASE_URL?.substring(0, 20) || 'none',
    lovepassPostgresPrefix: process.env.LOVEPASS_POSTGRES_URL?.substring(0, 20) || 'none',
  };

  return res.status(200).json(debug);
}
