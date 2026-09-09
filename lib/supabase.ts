"use client";

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Variáveis de ambiente do Supabase ausentes. Verifique NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

/**
 * Cliente Supabase para uso em Client Components ("use client").
 * Mantém a sessão do usuário sincronizada via cookies no navegador.
 */
export function createClient() {
  return createBrowserClient<any>(supabaseUrl, supabaseAnonKey);
}

// Instância única pronta para uso direto em componentes client-side.
export const supabase = createClient();
