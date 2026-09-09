import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Header from "@/components/Header";
import ListsDashboard from "@/components/ListsDashboard";

export default async function ListsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <Header userEmail={user.email ?? ""} />
      <ListsDashboard userId={user.id} />
    </main>
  );
}
