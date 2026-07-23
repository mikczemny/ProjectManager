import { createClient } from "@supabase/supabase-js";

/**
 * Klient Supabase tworzony leniwie i tylko wtedy, gdy aplikacja ma
 * konfigurację. Bez kluczy aplikacja działa w trybie lokalnym — dokładnie tak,
 * jak przed wprowadzeniem chmury — i nic w interfejsie nie sugeruje inaczej.
 *
 * Klucz `anon` jest publiczny z założenia: bezpieczeństwo opiera się na RLS
 * w bazie, nie na ukryciu klucza. Nigdy nie wstawiaj tu klucza `service_role`.
 */
const URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isCloudConfigured = Boolean(URL && ANON_KEY);

let client = null;

export function getClient() {
  if (!isCloudConfigured) return null;
  if (!client) {
    client = createClient(URL, ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
