// Test authentication directly in the server context
import { AuthService } from './src/lib/server/auth-direct.ts';

async function testAuth() {
  console.log('🔍 Direct Authentication Test');
  console.log('==============================');
  
  const email = 'demo@boutiqueclient.com';
  const password = 'demo123!';
  
  console.log('Email:', email);
  console.log('Password:', password);
  console.log('');
  
  try {
    console.log('📝 Testing AuthService.authenticate()...');
    const result = await AuthService.authenticate(email, password);
    
    console.log('');
    console.log('Result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('');
      console.log('✅ Authentication successful!');
      console.log('User ID:', result.user.id);
      console.log('User Email:', result.user.email);
      console.log('User Role:', result.user.role);
    } else {
      console.log('');
      console.log('❌ Authentication failed!');
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('❌ Test error:', error);
  }
  
  // Exit after test
  process.exit(0);
}

testAuth();