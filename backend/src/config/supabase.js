// Load environment variables from .env file
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
// Use SERVICE_ROLE_KEY if available to bypass RLS for backend operations, otherwise fallback to ANON_KEY
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Debugging check to ensure variables are loaded
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file location and variable names.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const defaultStorageBucket = process.env.SUPABASE_STORAGE_BUCKET || 'research-papers';

supabase.createSignedFileUrl = async (path, expiresInSeconds = 3600, bucket = defaultStorageBucket) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    throw error;
  }

  return data?.signedUrl || null;
};

supabase.getPublicFileUrl = (path, bucket = defaultStorageBucket) => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
};

module.exports = supabase;