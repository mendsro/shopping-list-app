"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Header({ userEmail }: { userEmail: string }) {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-red-950/20 bg-red-800 px-4 py-4 text-white shadow-[0_3px_12px_rgba(133,39,25,0.18)] sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-100">Mercado em dia</p>
          <p className="mt-1 text-lg font-semibold tracking-tight">Minhas listas</p>
          <p className="break-all text-xs text-red-100">{userEmail}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="shrink-0 rounded-md border border-white/30 px-3 py-1.5 text-sm text-white transition hover:bg-white/10"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
