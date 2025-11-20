// connection.js
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // boleh pakai service role di backend saja

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL atau SUPABASE_ANON_KEY belum di-set di .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
