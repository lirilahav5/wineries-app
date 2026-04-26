require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNames() {
  console.log('Checking wineries...');
  const { data: wineries, error: wineriesError } = await supabase
    .from('wineries')
    .select('id, name');
  
  if (wineriesError) {
    console.error('Error fetching wineries:', wineriesError);
    return;
  }
  
  console.log(`Total wineries: ${wineries.length}`);
  const wineriesWithoutNames = wineries.filter(w => !w.name || w.name.trim() === '');
  console.log(`Wineries without names: ${wineriesWithoutNames.length}`);
  if (wineriesWithoutNames.length > 0) {
    console.log('Wineries without names:', wineriesWithoutNames.map(w => w.id));
  }
  
  // Check for Hebrew-only names
  const hebrewOnlyNames = wineries.filter(w => {
    if (!w.name) return false;
    const hasHebrew = /[\u0590-\u05FF]/.test(w.name);
    const hasEnglish = /[a-zA-Z]/.test(w.name);
    const hasRussian = /[а-яА-ЯёЁ]/.test(w.name);
    return hasHebrew && !hasEnglish && !hasRussian;
  });
  console.log(`Wineries with Hebrew-only names (no English/Russian): ${hebrewOnlyNames.length}`);
  if (hebrewOnlyNames.length > 0 && hebrewOnlyNames.length <= 10) {
    console.log('Sample Hebrew-only names:', hebrewOnlyNames.slice(0, 10).map(w => ({ id: w.id, name: w.name })));
  }
  
  console.log('\nChecking wine shops...');
  const { data: shops, error: shopsError } = await supabase
    .from('wine_shops')
    .select('id, name');
  
  if (shopsError) {
    console.error('Error fetching shops:', shopsError);
    return;
  }
  
  console.log(`Total wine shops: ${shops.length}`);
  const shopsWithoutNames = shops.filter(s => !s.name || s.name.trim() === '');
  console.log(`Wine shops without names: ${shopsWithoutNames.length}`);
  if (shopsWithoutNames.length > 0) {
    console.log('Wine shops without names:', shopsWithoutNames.map(s => s.id));
  }
  
  // Check for Hebrew-only names
  const hebrewOnlyShopNames = shops.filter(s => {
    if (!s.name) return false;
    const hasHebrew = /[\u0590-\u05FF]/.test(s.name);
    const hasEnglish = /[a-zA-Z]/.test(s.name);
    const hasRussian = /[а-яА-ЯёЁ]/.test(s.name);
    return hasHebrew && !hasEnglish && !hasRussian;
  });
  console.log(`Wine shops with Hebrew-only names (no English/Russian): ${hebrewOnlyShopNames.length}`);
  if (hebrewOnlyShopNames.length > 0 && hebrewOnlyShopNames.length <= 10) {
    console.log('Sample Hebrew-only names:', hebrewOnlyShopNames.slice(0, 10).map(s => ({ id: s.id, name: s.name })));
  }
}

checkNames().catch(console.error);
