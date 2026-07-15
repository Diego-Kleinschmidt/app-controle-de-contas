import { createClient } from "@supabase/supabase-js";

// Lê as chaves guardadas no cofre (.env.local)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cria o "conector" que o app usa para falar com o Supabase
// (banco de dados + login). É reaproveitado em todo o app.
export const supabase = createClient(supabaseUrl, supabaseKey);
