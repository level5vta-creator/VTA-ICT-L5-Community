// Supabase Configuration
const SUPABASE_URL = "https://rogppaejmhzzsysbvmzn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xBwtytcw3lAvgDHNe38Qng_qcxJy6Al";

// Create client WITHOUT redeclaring 'supabase'
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Attach safely to window
window.supabaseClient = supabaseClient;
console.log("Supabase client initialized");
