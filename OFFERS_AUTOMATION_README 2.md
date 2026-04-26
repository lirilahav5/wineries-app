# Offers Automation System

This system automatically checks and updates offers for wineries and wine shops in your database using multiple methods.

## Features

The automation uses **4 different methods** to check for offers (in priority order):

1. **Manual Offers Database** (JSON file) - Highest priority
2. **Google Places API** - Checks reviews and summaries for offer mentions
3. **Website Scraping** - Scrapes winery/shop websites for offer keywords
4. **External APIs** - Placeholder for custom API integrations

## Installation

1. Install required dependencies:
```bash
npm install axios cheerio
```

## Configuration

Make sure your `.env` file contains:
```
SUPABASE_SERVICE_ROLE=your_service_role_key
GOOGLE_PLACES_KEY=your_google_places_api_key
```

## Usage

### Run for Wineries:
```bash
node update_wineries_offers.js
```

### Run for Wine Shops:
```bash
node update_wine_shops_offers.js
```

## Manual Offers Database

You can manually add offers by editing `manual_offers.json`:

```json
{
  "wineries": {
    "יקב גולן": {
      "name": "מבצע מיוחד!",
      "description": "20% הנחה על כל היינות עד סוף החודש"
    }
  },
  "shops": {
    "חנות יין תל אביב": {
      "name": "מבצע היום!",
      "description": "קנייה של 3 בקבוקים ומעלה - הנחה של 15%"
    }
  }
}
```

**Format:**
- Use exact winery/shop name as it appears in the database
- Offer can be:
  - JSON object: `{ "name": "...", "description": "..." }`
  - Plain text string: `"מבצע מיוחד - 20% הנחה"`

## How It Works

### Priority Order:
1. **Manual Offers** - Checks `manual_offers.json` first (highest priority)
2. **Google Places API** - Checks reviews and editorial summaries for offer keywords
3. **Website Scraping** - Scrapes websites looking for offer-related keywords
4. **External APIs** - Custom API integrations (you can add your own)

### Offer Detection:
- **Keywords searched**: מבצע, הצעות, הנחה, sale, discount, promotion, offer, deal, %
- **Sources**: Website content, Google reviews, editorial summaries

### Database Updates:
- If offer found → Updates `offers` column in database
- If no offer found → Sets `offers` to `null` (button will be hidden in app)
- If offer changed → Updates to new offer
- If offer expired → Removes offer (sets to null)

## Adding Custom External APIs

To add your own API integration, edit the `checkExternalAPIOffers()` function in both scripts:

```javascript
async function checkExternalAPIOffers(winery) {
  const apiUrl = 'https://api.example.com/wine-deals';
  try {
    const response = await axios.get(apiUrl, {
      params: { winery_name: winery.name }
    });
    if (response.data.offers && response.data.offers.length > 0) {
      return JSON.stringify({
        name: response.data.offers[0].title,
        description: response.data.offers[0].description
      });
    }
  } catch (error) {
    console.error('External API error:', error.message);
  }
  return null;
}
```

## Scheduling (Optional)

You can schedule these scripts to run automatically:

### Using cron (Linux/Mac):
```bash
# Run daily at 9 AM
0 9 * * * cd /path/to/project && node update_wineries_offers.js
0 9 * * * cd /path/to/project && node update_wine_shops_offers.js
```

### Using Windows Task Scheduler:
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (daily, weekly, etc.)
4. Action: Start a program
5. Program: `node`
6. Arguments: `update_wineries_offers.js`
7. Start in: Your project directory

## Output

The scripts provide detailed output:
- Progress for each winery/shop
- Summary of updates (added, updated, removed, unchanged)
- Error reporting

Example output:
```
Starting wineries offers update...
Using methods: Manual Offers → Google Places → Website Scraping → External APIs

Found 150 wineries to check

[1/150] Checking יקב גולן... ✓ Added offer
[2/150] Checking יקב רמת הגולן... - No change
[3/150] Checking יקב דלתון... ✗ Removed offer

=== Update Summary ===
Total wineries: 150
Updated/Added offers: 12
Removed offers: 3
Unchanged: 135
Errors: 0
```

## Notes

- Scripts include delays to avoid rate limiting
- Website scraping may fail silently if sites are down
- Google Places API requires valid API key
- Manual offers take highest priority (always used if found)
