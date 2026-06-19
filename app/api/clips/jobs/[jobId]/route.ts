import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(_: Request, { params }: { params: { jobId: string } }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("clip_jobs")
    .select("id, status, error, video_name, clips, segments, created_at")
    .eq("id", params.jobId)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json(data);
}

// Also list all jobs for the user
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("clip_jobs")
    .select("id, status, error, video_name, clips, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json(data || []);
}
