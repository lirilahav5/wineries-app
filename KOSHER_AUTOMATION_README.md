# Kosher Status Automation System

This system automatically checks and updates kosher status for wineries and wine shops in your database using multiple methods.

## Features

The automation uses **3 different methods** to check kosher status (in priority order):

1. **Manual Kosher Database** (JSON file) - Highest priority
2. **Google Places API** - Checks reviews and summaries for kosher mentions
3. **Website Scraping** - Scrapes winery/shop websites for kosher certifications

## Installation

Dependencies are already installed (same as offers automation):
- `axios` - For HTTP requests
- `cheerio` - For web scraping
- `@supabase/supabase-js` - For database access

## Configuration

Make sure your `.env` file contains:
```
SUPABASE_SERVICE_ROLE=your_service_role_key
GOOGLE_PLACES_KEY=your_google_places_api_key
```

## Usage

### Run for Wineries:
```bash
node update_wineries_kosher.js
```

### Run for Wine Shops:
```bash
node update_wine_shops_kosher.js
```

## Manual Kosher Database

You can manually set kosher status by editing `manual_kosher.json`:

```json
{
  "wineries": {
    "יקב גולן": true,
    "יקב רמת הגולן": true,
    "יקב מסוים": false
  },
  "shops": {
    "חנות יין תל אביב": true,
    "חנות מסוימת": false
  }
}
```

**Format:**
- Use exact winery/shop name as it appears in the database
- `true` = כשר (Kosher)
- `false` = לא כשר (Not Kosher)

## How It Works

### Priority Order:
1. **Manual Database** - Checks `manual_kosher.json` first (highest priority)
2. **Google Places API** - Checks reviews and editorial summaries for kosher keywords
3. **Website Scraping** - Scrapes websites looking for kosher certifications

### Kosher Detection:
- **Keywords searched**: כשר, כשרות, kosher, kashrut, badatz, רבנות, רבני, אושר, הכשר, מהדרין, mehadrin
- **Sources**: Website content, kosher certification images, Google reviews, editorial summaries

### Database Updates:
- If kosher status found → Updates `kosher` column in database (`true` or `false`)
- If status unknown → Keeps current value (doesn't overwrite)
- Only updates when a definitive answer is found

## App Behavior

The app automatically shows/hides the "כשר" badge based on the `kosher` field:
- `kosher: true` → Shows black "כשר" badge in top right of list item
- `kosher: false` or `null` → No badge shown

## Output

The scripts provide detailed output:
- Progress for each winery/shop
- Summary of updates
- Error reporting

Example output:
```
Starting wineries kosher status update...
Using methods: Manual Database → Google Places → Website Scraping

Found 150 wineries to check

[1/150] Checking יקב גולן... ✓ Updated: כשר
[2/150] Checking יקב רמת הגולן... - No change (כשר)
[3/150] Checking יקב מסוים... - Unknown (keeping current: לא ידוע)

=== Update Summary ===
Total wineries: 150
Updated: 12
Unchanged: 138
Errors: 0
```

## Notes

- Scripts include delays to avoid rate limiting
- Website scraping may fail silently if sites are down
- Google Places API requires valid API key
- Manual database takes highest priority (always used if found)
- Unknown status doesn't overwrite existing values (preserves current data)
