import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function dbToVideo(row: Record<string, unknown>) {
  return {
    id: row.id,
    platform: row.platform,
    title: row.title,
    hashtags: row.hashtags,
    notes: row.notes,
    status: row.status,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    publishedDate: row.published_date,
    publishedTime: row.published_time,
    durationSeconds: row.duration_seconds,
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    saves: row.saves,
    newFollowers: row.new_followers,
    avgWatchTime: row.avg_watch_time,
    completionRate: row.completion_rate,
    videoUrl: row.video_url,
  };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map(dbToVideo));
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from("videos")
    .insert({
      id: body.id,
      user_id: user.id,
      platform: body.platform,
      title: body.title,
      hashtags: body.hashtags || "",
      notes: body.notes || "",
      status: body.status,
      scheduled_date: body.scheduledDate || null,
      scheduled_time: body.scheduledTime || null,
      published_date: body.publishedDate || null,
      published_time: body.publishedTime || null,
      duration_seconds: body.durationSeconds || 0,
      views: body.views || 0,
      likes: body.likes || 0,
      comments: body.comments || 0,
      shares: body.shares || 0,
      saves: body.saves || 0,
      new_followers: body.newFollowers || 0,
      avg_watch_time: body.avgWatchTime || 0,
      completion_rate: body.completionRate || 0,
      video_url: body.videoUrl || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(dbToVideo(data));
}
