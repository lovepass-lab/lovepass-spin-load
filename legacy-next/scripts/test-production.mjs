#!/usr/bin/env node

// Test script for production deployment
const BASE_URL = 'https://api.lovepass.io';

async function testEndpoint(url, description) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log(`📡 URL: ${url}`);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Status: ${response.status}`);
      console.log(`📄 Response:`, JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ Status: ${response.status}`);
      console.log(`📄 Error:`, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log(`💥 Network Error:`, error.message);
  }
}

async function testProductionAPIs() {
  console.log('🚀 Testing Lovepass Production APIs');
  console.log('=' .repeat(50));

  // Test 1: Health check
  await testEndpoint(
    `${BASE_URL}/api/health/db`,
    'Database Health Check'
  );

  // Test 2: CCIP resolver (should work)
  await testEndpoint(
    `${BASE_URL}/api/ccip?name=vitalik.eth`,
    'CCIP ENS Resolution'
  );

  // Test 3: Empty mailbox (should work if DB is configured)
  await testEndpoint(
    `${BASE_URL}/api/mailbox?name=test.eth&net=mainnet`,
    'Empty Mailbox Check'
  );

  // Test 4: Mailbox for vaped.eth on sepolia
  await testEndpoint(
    `${BASE_URL}/api/mailbox?name=vaped.eth&net=sepolia`,
    'Vaped.eth Sepolia Mailbox'
  );

  console.log('\n' + '=' .repeat(50));
  console.log('🏁 Production API Test Complete');
  console.log('\n📋 Expected Results:');
  console.log('✅ Health: {"ok":true,"driver":"postgres","rows":N}');
  console.log('✅ CCIP: ENS resolution data');
  console.log('✅ Mailbox: {"name":"...","messages":[...],"total":N}');
  console.log('\n🔧 If health check fails, set POSTGRES_URL in Vercel');
}

testProductionAPIs().catch(console.error);
