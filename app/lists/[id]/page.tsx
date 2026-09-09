import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Header from "@/components/Header";
import ListItems from "@/components/ListItems";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: list, error } = await supabase
    .from("shopping_lists")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !list) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <Header userEmail={user.email ?? ""} />
      <ListItems list={list} />
    </main>
  );
}
