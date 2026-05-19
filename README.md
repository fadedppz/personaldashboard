# Dashboard App

A full-stack dashboard application with authentication, cross-device sync, goal tracking, and a day ring progress indicator.

## Features

- **Authentication**: Email/password signup and signin via Supabase
- **Cross-Device Sync**: All data syncs across devices when logged in
- **Goal Ticker**: NASDAQ-style ticker showing pending goals
- **Day Ring**: Circular progress indicator showing time awake (8 AM - midnight)
- **To-Do List**: Manage today's goals and plan for tomorrow
- **Streak Tracking**: Track consecutive days of completed goals
- **Goal Polish**: AI-powered goal refinement (requires Anthropic API key)
- **Drag & Reorder**: Reorder goals via drag-and-drop
- **Inline Editing**: Click to edit goal text
- **Queue System**: Mark goals for a productivity window

## Setup

### Prerequisites

- Node.js 16+
- npm or pnpm
- Supabase account (free tier works)

### Environment Variables

Create a `.env.local` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Installation

```bash
npm install
# or
pnpm install
```

### Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the SQL Editor, run:

```sql
CREATE TABLE user_data (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own data" ON user_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own data" ON user_data
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own data" ON user_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

3. Copy your project URL and anon key from Settings → API
4. Paste them into `.env.local`

### Development

```bash
npm run dev
# or
pnpm dev
```

The app will be available at `http://localhost:5173`

### Building

```bash
npm run build
# or
pnpm build
```

## Deployment to Vercel

### Option 1: Using Git

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/dashboard-app.git
git push -u origin main
```

Then connect your repository to Vercel:
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Select your GitHub repository
4. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click "Deploy"

### Option 2: Using Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts and set environment variables when asked.

## Usage

### Sign Up / Sign In

1. Enter your email and password
2. Click "Sign Up" to create a new account or "Sign In" if you already have one
3. Your session will persist across devices

### Adding Goals

1. Type a goal in the input field
2. Click "+ Add" to add it
3. Click "✨ Polish" to refine it with AI (requires Anthropic API key in code)

### Managing Goals

- **Check off**: Click the checkbox to mark as done
- **Edit**: Click the goal text to edit inline
- **Reorder**: Drag goals to reorder them
- **Queue**: Click ⚡ to mark for a productivity window
- **Delete**: Click × to remove

### Pushing to Tomorrow

If you have unchecked goals at the end of the day:
1. Click "Push remaining to tomorrow →"
2. Confirm the action
3. All unchecked goals move to tomorrow's list

### Cross-Device Sync

- Changes sync automatically every 5 seconds
- Sync also happens on window focus and visibility change
- While editing, incoming changes queue and apply when you finish
- All data is stored per user in Supabase

## Architecture

### Frontend

- Single HTML file with inline styles and JavaScript
- Supabase JS client for auth
- localStorage for offline state
- Automatic cloud sync via API routes

### Backend (Vercel Functions)

- `/api/auth/signin` - Sign in with email/password
- `/api/auth/signup` - Create new account
- `/api/sync` - GET/POST user data to Supabase

### Database (Supabase)

- `auth.users` - User accounts (managed by Supabase)
- `user_data` - User's goal data (JSON)

## Troubleshooting

### "Sync failed" message

- Check that your Supabase credentials are correct
- Verify the `user_data` table exists in Supabase
- Check browser console for error details

### Goals not syncing across devices

- Make sure you're logged in with the same account
- Check that the API routes are deployed
- Verify Supabase database is accessible

### "Polish needs an Anthropic API key"

- Add your Anthropic API key to the `ANTHROPIC_API_KEY` constant in `index.html`
- Get a key from [console.anthropic.com](https://console.anthropic.com)

## License

MIT
"# personaldashy" 
