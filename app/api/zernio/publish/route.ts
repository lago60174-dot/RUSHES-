import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { zernioCreatePost } from "@/lib/zernio";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { videoId, caption, accountId, platform, videoUrl, scheduledFor } = body;

  if (!videoId || !caption || !accountId || !platform) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const post = await zernioCreatePost({
      content: caption,
      platforms: [{ platform, accountId }],
      mediaUrl: videoUrl || undefined,
      scheduledFor: scheduledFor || undefined,
    });

    // Store zernio post id + account id on the video record
    const { error } = await supabase
      .from("videos")
      .update({
        zernio_post_id: post._id,
        zernio_account_id: accountId,
        video_url: videoUrl || null,
        status: scheduledFor ? "planned" : "published",
        published_date: scheduledFor ? null : new Date().toISOString().slice(0, 10),
        published_time: scheduledFor ? null : new Date().toTimeString().slice(0, 5),
      })
      .eq("id", videoId)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ postId: post._id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
