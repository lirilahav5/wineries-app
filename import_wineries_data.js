require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// WineMe2026 Supabase project details
// IMPORTANT: replace YOUR_SERVICE_ROLE_KEY_HERE with your real service_role key
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function importWineries() {
  const geojson = JSON.parse(
    fs.readFileSync('wineries-app/src/assets/data/wineries.geojson', 'utf8')
  );

  for (const feature of geojson.features) {
    const props = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;

    // Prepare the row for wineries table
    const row = {
      name: props.name,
      address: props.address || null,
      place_id: props.place_id || null,
      region: props.region || null,
      kosher: props.kosher || null,
      phone: props.phone || null,
      website: props.website || null,
      opening_hours: props.openingHours ? JSON.stringify(props.openingHours) : null,
      is_open: props.isOpen ?? null,
      lat,
      lng,
      geometry: `SRID=4326;POINT(${lng} ${lat})`
    };

    const { error } = await supabase.from('wineries').insert([row]);
    if (error) {
      console.error('Insert error:', error, 'Row:', row);
    } else {
      console.log('Inserted winery:', row.name);
    }
  }

  console.log('Finished importing wineries.');
}

importWineries();


