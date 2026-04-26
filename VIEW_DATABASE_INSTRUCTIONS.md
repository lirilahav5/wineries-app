# How to View All Database Data

You have several options to view all the data in your Supabase database tables:

## Option 1: Using Supabase Dashboard (Easiest) ⭐

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Log in to your account
3. Select your project: **hxbwusvxjxsgprexthml**
4. Click on **"Table Editor"** in the left sidebar
5. You'll see all your tables:
   - `wineries`
   - `wine_shops`
6. Click on any table to view all rows
7. You can filter, sort, and search within the table editor

## Option 2: Using SQL Editor in Supabase

1. Go to your Supabase dashboard
2. Click on **"SQL Editor"** in the left sidebar
3. Run these queries:

```sql
-- View all wineries
SELECT * FROM wineries ORDER BY id;

-- View all wine shops
SELECT * FROM wine_shops ORDER BY id;

-- Count records
SELECT 
  (SELECT COUNT(*) FROM wineries) as wineries_count,
  (SELECT COUNT(*) FROM wine_shops) as wine_shops_count;

-- View wineries by region
SELECT region, COUNT(*) as count 
FROM wineries 
GROUP BY region 
ORDER BY count DESC;

-- View wine shops by region
SELECT region, COUNT(*) as count 
FROM wine_shops 
GROUP BY region 
ORDER BY count DESC;
```

## Option 3: Using Node.js Scripts (Command Line)

I've created two scripts for you:

### View Data in Terminal:
```bash
node view_database_data.js
```

This will display:
- All wineries (first 5 + summary)
- All wine shops (first 5 + summary)
- Statistics by region
- Kosher counts

### Export Data to JSON Files:
```bash
node export_database_data.js
```

This will create:
- `wineries_export.json` - All wineries data
- `wine_shops_export.json` - All wine shops data

## Option 4: Using Browser Console (Quick Check)

1. Open your app in the browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Paste this code:

```javascript
// View wineries
fetch('https://hxbwusvxjxsgprexthml.supabase.co/rest/v1/wineries?select=*', {
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Ynd1c3Z4anhzZ3ByZXh0aG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2OTY1NTUsImV4cCI6MjA4MzI3MjU1NX0.2jlmKuzFB3hfHcd_SKBRK-oN7nAUZ_Tmj4Xplt_haEU',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Ynd1c3Z4anhzZ3ByZXh0aG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2OTY1NTUsImV4cCI6MjA4MzI3MjU1NX0.2jlmKuzFB3hfHcd_SKBRK-oN7nAUZ_Tmj4Xplt_haEU'
  }
})
.then(r => r.json())
.then(data => {
  console.table(data);
  console.log(`Total: ${data.length} wineries`);
});

// View wine shops
fetch('https://hxbwusvxjxsgprexthml.supabase.co/rest/v1/wine_shops?select=*', {
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Ynd1c3Z4anhzZ3ByZXh0aG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2OTY1NTUsImV4cCI6MjA4MzI3MjU1NX0.2jlmKuzFB3hfHcd_SKBRK-oN7nAUZ_Tmj4Xplt_haEU',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Ynd1c3Z4anhzZ3ByZXh0aG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2OTY1NTUsImV4cCI6MjA4MzI3MjU1NX0.2jlmKuzFB3hfHcd_SKBRK-oN7nAUZ_Tmj4Xplt_haEU'
  }
})
.then(r => r.json())
.then(data => {
  console.table(data);
  console.log(`Total: ${data.length} wine shops`);
});
```

## Recommended: Use Supabase Dashboard

The **Supabase Dashboard** (Option 1) is the easiest and most user-friendly way to view your data. It provides:
- Visual table editor
- Search and filter capabilities
- Easy editing
- Export options
- No code required

## Your Database Tables

Based on your code, you have these tables:
- **wineries** - Contains winery information (name, address, region, phone, kosher, etc.)
- **wine_shops** - Contains wine shop information (name, address, region, phone, kosher, etc.)

Both tables have similar structures with fields like:
- `id`, `name`, `address`, `region`, `phone`, `website`, `opening_hours`, `kosher`, `lat`, `lng`, `offers`, etc.
