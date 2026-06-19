import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("settings")
    .select("data")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json(data?.data || {});
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  await supabase.from("settings").upsert({
    user_id: user.id,
    data: body,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
