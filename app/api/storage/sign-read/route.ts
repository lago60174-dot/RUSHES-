import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path, expiresIn } = await request.json().catch(() => ({}));
  if (!path || typeof path !== "string" || !path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Chemin invalide" }, { status: 400 });
  }

  const { data, error } = await supabase.storage
    .from("videos")
    .createSignedUrl(path, expiresIn || 60 * 60 * 24 * 7);

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Échec de génération de l'URL signée" }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}
