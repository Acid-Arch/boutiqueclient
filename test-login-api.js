// Test the login API directly
async function testLogin() {
  const loginData = {
    emailOrUsername: 'demo@boutiqueclient.com',
    password: 'demo123!',
    rememberMe: false
  };

  console.log('🔍 Testing Login API');
  console.log('====================');
  console.log('URL: http://localhost:5173/api/auth/login');
  console.log('Credentials:', loginData);
  console.log('');

  try {
    const response = await fetch('http://localhost:5173/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData)
    });

    console.log('Response Status:', response.status, response.statusText);
    console.log('Response Headers:');
    console.log('  Content-Type:', response.headers.get('content-type'));
    console.log('');

    const result = await response.json();
    console.log('Response Body:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('');
      console.log('✅ Login successful!');
      console.log('User:', result.user);
    } else {
      console.log('');
      console.log('❌ Login failed!');
      console.log('Error:', result.error);
      if (result.details) {
        console.log('Details:', result.details);
      }
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

// Note: You need to have the dev server running for this to work
console.log('⚠️  Make sure the dev server is running (npm run dev)');
console.log('');
testLogin();