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
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify token and get user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const userId = user.id;

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('user_data')
        .select('data')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        return res.status(500).json({ error: 'Failed to fetch data' });
      }

      return res.status(200).json({ data: data?.data || {} });
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    const { data } = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid data' });
    }

    try {
      const { error } = await supabase
        .from('user_data')
        .upsert({ user_id: userId, data, updated_at: new Date() }, {
          onConflict: 'user_id',
        });

      if (error) {
        return res.status(500).json({ error: 'Failed to save data' });
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
