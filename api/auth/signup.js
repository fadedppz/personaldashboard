import { createClient } from '@supabase/supabase-js';

// Polyfill WebSocket for Node.js < 22 (required by Supabase RealtimeClient)
import WebSocket from 'ws';
if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://udkdkqnnhhcyddmlbqas.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVka2RrcW5uaGhjeWRkbWxicWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNjcyNzIsImV4cCI6MjA5NDY0MzI3Mn0.UqLPqOwBc8t-_Mu_9AsY7C4xecHRxcMM6yCyMCbOTAY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // If email confirmation is required, session will be null
    if (!data.session) {
      return res.status(200).json({
        user: null,
        token: null,
        message: 'Please check your email to confirm your account before signing in.',
      });
    }

    return res.status(200).json({
      user: { email: data.user.email, id: data.user.id },
      token: data.session.access_token,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
