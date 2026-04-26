import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const supabaseUrl = 'https://hxbwusvxjxsgprexthml.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Ynd1c3Z4anhzZ3ByZXh0aG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2OTY1NTUsImV4cCI6MjA4MzI3MjU1NX0.2jlmKuzFB3hfHcd_SKBRK-oN7nAUZ_Tmj4Xplt_haEU';

const supabase = createClient(supabaseUrl, supabaseKey);

const run = async () => {
  const { data: wineries, error: wErr } = await supabase
    .from('wineries')
    .select('id,name,address,region')
    .order('id', { ascending: true });

  if (wErr) throw wErr;

  const { data: shops, error: sErr } = await supabase
    .from('wine_shops')
    .select('id,name,address,region')
    .order('id', { ascending: true });

  if (sErr) throw sErr;

  const lines = [];
  lines.push('Wineries');
  lines.push('--------');
  wineries.forEach((w) => {
    lines.push(`${w.id}\t${w.name || ''}\t${w.region || ''}\t${w.address || ''}`);
  });
  lines.push('');
  lines.push('Wine Shops');
  lines.push('---------');
  shops.forEach((s) => {
    lines.push(`${s.id}\t${s.name || ''}\t${s.region || ''}\t${s.address || ''}`);
  });

  writeFileSync('wineries-and-shops.txt', lines.join('\n'), 'utf8');
  console.log(`Wrote ${wineries.length} wineries and ${shops.length} shops to wineries-and-shops.txt`);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
