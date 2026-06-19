import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("ai_analyses")
    .select("result, video_count, generated_at")
    .eq("user_id", user.id)
    .single();

  if (!data) return NextResponse.json(null, { status: 404 });
  return NextResponse.json({
    result: data.result,
    videoCount: data.video_count,
    generatedAt: data.generated_at,
  });
}
