// Test the translation endpoint
const fetch = require('node-fetch');

async function testTranslation() {
  console.log('Testing translation endpoint...\n');
  
  try {
    const response = await fetch('http://localhost:3002/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Hello, how are you?',
        targetLang: 'he'
      })
    });

    const data = await response.json();
    console.log('Response:', data);
    
    if (data.success) {
      console.log('\n✅ Translation works!');
      console.log('Translated text:', data.translatedText);
    } else {
      console.log('\n❌ Translation failed:', data.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  Make sure the email proxy server is running:');
    console.log('   node email-proxy-server.js');
  }
}

testTranslation();
