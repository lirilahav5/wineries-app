# WineME Management Portal

A separate management application for wineries and wine shops administrators.

## Features

- 🔐 **Authentication**: Secure login for managers
- 📊 **Dashboard**: Overview of wineries and wine shops statistics
- 🍷 **Wineries Management**: View, add, edit, and delete wineries
- 🏪 **Wine Shops Management**: View, add, edit, and delete wine shops
- ✨ **Real-time Updates**: Changes reflect immediately in the user-facing app

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

The app will run on `http://localhost:3001` (different port from the main wineries-app)

## Authentication

Managers need to be created in Supabase Auth. To create a manager account:

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User" → "Create new user"
3. Enter email and password
4. The manager can now login to the management portal

## Project Structure

```
management-app/
├── src/
│   ├── components/
│   │   └── Navigation.tsx      # Navigation bar
│   ├── lib/
│   │   └── supabase.ts         # Supabase client configuration
│   ├── pages/
│   │   ├── Login.tsx           # Login page
│   │   ├── Dashboard.tsx       # Dashboard with statistics
│   │   ├── WineriesManagement.tsx  # Wineries CRUD
│   │   └── WineShopsManagement.tsx  # Wine Shops CRUD
│   ├── App.tsx                 # Main app component with routing
│   ├── App.css                 # Global styles
│   ├── main.tsx                # Entry point
│   └── index.css               # Base styles
├── index.html
└── package.json
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Database Connection

The management app connects to the same Supabase database as the main wineries-app:
- **Tables**: `wineries`, `wine_shops`
- **Authentication**: Supabase Auth

## Notes

- This is a completely separate app from `wineries-app`
- Runs on a different port (3001 vs 5173)
- Uses the same Supabase database
- Changes made here will reflect in the user-facing app immediately
