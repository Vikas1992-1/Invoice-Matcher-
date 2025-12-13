import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ckjhvnyootvolhfforyi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNramh2bnlvb3R2b2xoZmZvcnlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDM1NDUsImV4cCI6MjA4MTE3OTU0NX0.bJoc-OrcD3DZggKxjKvgkntSFZ1qs-pdBdFUkhsg0eA';

export const supabase = createClient(supabaseUrl, supabaseKey);