// Quick script to verify the server has the translate endpoint
const fs = require('fs');

const serverCode = fs.readFileSync('email-proxy-server.js', 'utf8');

if (serverCode.includes("app.post('/translate'")) {
  console.log('✅ Server file HAS the /translate endpoint');
  console.log('   The code is correct.');
  console.log('\n⚠️  You need to RESTART the server:');
  console.log('   1. Stop it (Ctrl+C)');
  console.log('   2. Start it: node email-proxy-server.js');
  console.log('   3. You should see: "Ready to send emails and translate messages!"\n');
} else {
  console.log('❌ Server file does NOT have the /translate endpoint');
  console.log('   Something is wrong with the file.\n');
}

// Check if server is listening
const net = require('net');
const client = new net.Socket();

client.setTimeout(1000);
client.on('connect', () => {
  console.log('✅ Server is running on port 3002');
  client.destroy();
});
client.on('timeout', () => {
  console.log('❌ Server is NOT running on port 3002');
  console.log('   Start it with: node email-proxy-server.js\n');
  client.destroy();
});
client.on('error', () => {
  console.log('❌ Server is NOT running on port 3002');
  console.log('   Start it with: node email-proxy-server.js\n');
});

client.connect(3002, 'localhost');
