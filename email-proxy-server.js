// Simple email proxy server to bypass CORS
// Run this: node email-proxy-server.js
// Then the app can send emails through this proxy

const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Root endpoint - just to show server is running
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    message: 'Email proxy server is running!',
    endpoints: {
      'POST /send-email': 'Send email via Resend',
      'POST /translate': 'Translate text using MyMemory/Google Translate'
    }
  });
});

// Helper function to detect language from text
function detectLanguage(text) {
  // Hebrew: Contains Hebrew characters (Unicode range \u0590-\u05FF)
  const hebrewRegex = /[\u0590-\u05FF]/;
  // Russian: Contains Cyrillic characters (Unicode range \u0400-\u04FF)
  const russianRegex = /[\u0400-\u04FF]/;
  
  if (hebrewRegex.test(text)) {
    return 'he';
  } else if (russianRegex.test(text)) {
    return 'ru';
  } else {
    return 'en';
  }
}

// Helper function to translate using MyMemory API (free, no key needed)
async function translateWithMyMemory(text, sourceLang, targetLang) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
    console.log(`   MyMemory URL: ${url.substring(0, 100)}...`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`   MyMemory HTTP ${response.status}: ${errorText}`);
      throw new Error(`MyMemory API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`   MyMemory response:`, JSON.stringify(data).substring(0, 200));
    
    if (data && data.responseData && data.responseData.translatedText) {
      const translated = data.responseData.translatedText;
      // MyMemory sometimes returns the original text if translation fails - check for that
      if (translated === text) {
        throw new Error('MyMemory returned original text (translation may have failed)');
      }
      return translated;
    }
    
    if (data && data.responseStatus && data.responseStatus !== 200) {
      throw new Error(`MyMemory API error: ${data.responseStatus} - ${data.responseDetails || 'Unknown error'}`);
    }
    
    throw new Error('Unexpected response format from MyMemory');
  } catch (error) {
    console.error(`   MyMemory error details:`, error);
    throw new Error(`MyMemory translation failed: ${error.message}`);
  }
}

// Helper function to translate using Google Translate (fallback)
async function translateWithGoogle(text, sourceLang, targetLang) {
  try {
    const googleTranslateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    console.log(`   Google Translate URL: ${googleTranslateUrl.substring(0, 100)}...`);
    
    const response = await fetch(googleTranslateUrl);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`   Google Translate HTTP ${response.status}: ${errorText}`);
      throw new Error(`Google Translate API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`   Google Translate response structure:`, Array.isArray(data) ? `Array with ${data.length} elements` : typeof data);
    
    // Google Translate returns: [[["translated text",...],...],...]
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      const translated = data[0][0][0];
      // Check if translation is the same as original (might indicate failure)
      if (translated === text && text.length > 0) {
        console.warn(`   Warning: Google Translate returned original text`);
      }
      return translated;
    }
    
    throw new Error('Unexpected response format from Google Translate');
  } catch (error) {
    console.error(`   Google Translate error details:`, error);
    throw new Error(`Google Translate failed: ${error.message}`);
  }
}

// Translation endpoint using multiple free translation services with fallbacks
app.post('/translate', async (req, res) => {
  const { text, targetLang } = req.body;
  
  console.log(`\n📝 Translation request received:`);
  console.log(`   Target language: ${targetLang}`);
  console.log(`   Text length: ${text.length} characters`);
  console.log(`   Text preview: ${text.substring(0, 100)}...`);
  
  // Language codes mapping
  const langMap = {
    'he': 'he', // Hebrew
    'ru': 'ru', // Russian
    'en': 'en'  // English
  };

  const target = langMap[targetLang] || 'en';
  
  // Detect source language
  const sourceLang = detectLanguage(text);
  console.log(`   Detected source language: ${sourceLang}`);
  
  // Only translate if source and target are different
  if (sourceLang === target) {
    console.log(`   Source and target are the same, returning original text`);
    return res.json({ success: true, translatedText: text });
  }

  // Try multiple translation services in order (with fallbacks)
  const translationServices = [
    { name: 'MyMemory', fn: translateWithMyMemory },
    { name: 'Google Translate', fn: translateWithGoogle }
  ];

  let lastError = null;
  
  for (const service of translationServices) {
    try {
      console.log(`   Trying ${service.name}...`);
      const translated = await service.fn(text, sourceLang, target);
      
      if (translated && translated.trim().length > 0) {
        console.log(`✅ Translation successful via ${service.name}`);
        console.log(`   Translated: ${translated.substring(0, 100)}...`);
        return res.json({ success: true, translatedText: translated });
      }
    } catch (error) {
      console.error(`❌ ${service.name} failed:`, error.message);
      lastError = error;
      
      // If it's a rate limit error (429), wait a bit before trying next service
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        console.log(`   Rate limit detected, waiting 1 second before trying next service...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Continue to next service
      continue;
    }
  }
  
  // All services failed
  console.error('❌ All translation services failed');
  const errorMessage = lastError 
    ? `Translation failed: ${lastError.message}. Please try again later.`
    : 'Translation failed: All services unavailable. Please try again later.';
  
  res.status(500).json({ 
    success: false, 
    error: errorMessage,
    details: 'The translation service is temporarily unavailable. This may be due to rate limiting. Please try again in a few moments.'
  });
});

// Email sending endpoint
app.post('/send-email', async (req, res) => {
  const { to, subject, html } = req.body;
  const RESEND_API_KEY = 're_SWostRpx_JgQbyigGGMhBLht9F6Q7P84m';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: to,
        subject: subject,
        html: html,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`✅ Email sent to ${to}, ID: ${data.id}`);
      res.json({ success: true, id: data.id });
    } else {
      console.error(`❌ Failed to send email:`, data);
      res.status(response.status).json({ success: false, error: data });
    }
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n📧 Email proxy server running on http://localhost:${PORT}`);
  console.log(`   Ready to send emails and translate messages!\n`);
});
