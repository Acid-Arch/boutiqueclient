import { createServer } from 'net';

const ports = [5874, 8743, 4874, 5877];

function checkPort(port) {
  return new Promise((resolve) => {
    const server = createServer();
    
    server.listen(port, '127.0.0.1', () => {
      server.close(() => {
        resolve({ port, available: true });
      });
    });
    
    server.on('error', () => {
      resolve({ port, available: false });
    });
  });
}

async function checkAllPorts() {
  console.log('🔍 Checking port availability for Client Portal...\n');
  
  const results = await Promise.all(ports.map(checkPort));
  
  results.forEach(({ port, available }) => {
    const status = available ? '✅ Available' : '❌ In use';
    const usage = {
      5874: 'Development Server',
      8743: 'WebSocket Server', 
      4874: 'Preview Server',
      5877: 'Test Server'
    };
    
    console.log(`Port ${port} (${usage[port]}): ${status}`);
  });
  
  const unavailable = results.filter(r => !r.available);
  
  if (unavailable.length > 0) {
    console.log('\n⚠️  Some ports are in use. You may need to:');
    console.log('   - Stop other services using these ports');
    console.log('   - Update configuration to use different ports');
    process.exit(1);
  } else {
    console.log('\n🚀 All ports available! Ready to start development.');
  }
}

checkAllPorts();