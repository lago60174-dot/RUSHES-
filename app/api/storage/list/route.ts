import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: files, error } = await supabase.storage
    .from("videos")
    .list(user.id, { sortBy: { column: "created_at", order: "desc" } });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = await Promise.all(
    (files || [])
      .filter((f) => f.name && !f.name.endsWith("/"))
      .map(async (f) => {
        const path = `${user.id}/${f.name}`;
        const { data: signed } = await supabase.storage
          .from("videos")
          .createSignedUrl(path, 60 * 60); // 1h, régénéré à chaque visite de la galerie
        return {
          path,
          name: f.name,
          size: f.metadata?.size ?? null,
          mimetype: f.metadata?.mimetype ?? null,
          createdAt: f.created_at,
          url: signed?.signedUrl || null,
        };
      })
  );

  return NextResponse.json(items);
}
