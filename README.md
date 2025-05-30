# Stock Management System

A modern stock management system built with React, Vite, and Supabase.

## 🚀 Quick Start

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the Supabase credentials if you have them
   - Or set `VITE_USE_MOCK_DATA=true` to use mock data

## 📦 Environment Configuration

Two modes are available:

### 1. Using Supabase (Production Mode)

Set these variables in your `.env`:
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_USE_MOCK_DATA=false
```

### 2. Using Mock Data (Development Mode)

For local development without Supabase:
```bash
VITE_USE_MOCK_DATA=true
```

## 🗄️ Database Setup

1. Click "Connect to Supabase" in the top right corner
2. Follow the setup wizard to create your project
3. Copy the URL and Anon Key to your `.env` file

## 🏗️ Development

Start the development server:
```bash
npm run dev
```

## 📝 Notes

- Mock data is available for local development
- Supabase connection is required for production use
- All environment variables are prefixed with `VITE_`