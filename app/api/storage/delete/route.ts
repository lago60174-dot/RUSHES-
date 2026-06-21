import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path } = await request.json();
  if (!path || typeof path !== "string" || !path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const { error } = await supabase.storage.from("videos").remove([path]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
