import { createClient } from '@supabase/supabase-js'

// Anon key is designed to be public. Row Level Security in the DB is what
// actually protects data. It's safe to bundle in the client.
const url  = import.meta.env.VITE_SUPABASE_URL  || 'https://ubmnqvnxqeovbcwissmw.supabase.co'
const anon = import.meta.env.VITE_SUPABASE_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVibW5xdm54cWVvdmJjd2lzc213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyOTgxMDksImV4cCI6MjA5OTg3NDEwOX0.3aAnxZnVr8ShXM2_ZOaVg18gRR9zHQMDejLEjl5dG5g'

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
