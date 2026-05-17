const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Fill in your Supabase project details:
const supabaseUrl = 'https://YOUR_PROJECT_REF.supabase.co';
const supabaseKey = 'YOUR_SUPABASE_SERVICE_ROLE_KEY'; // Use service role key for inserts
const supabase = createClient(supabaseUrl, supabaseKey);

async function importWineries() {
  const geojson = JSON.parse(fs.readFileSync('./src/assets/data/wineries.geojson', 'utf8'));
  for (const feature of geojson.features) {
    const props = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;

    // Prepare the row
    const row = {
      name: props.name,
      address: props.address || null,
      place_id: props.place_id || null,
      region: props.region || null,
      kosher: props.kosher || null,
      phone: props.phone || null,
      website: props.website || null,
      opening_hours: props.openingHours ? JSON.stringify(props.openingHours) : null,
      is_open: props.isOpen || null,
      lat,
      lng,
      geometry: `SRID=4326;POINT(${lng} ${lat})`
    };

    // Insert into Supabase
    const { error } = await supabase
      .from('wineries')
      .insert([row]);
    if (error) {
      console.error('Insert error:', error, 'Row:', row);
    } else {
      console.log('Inserted:', row.name);
    }
  }
}

importWineries(); 