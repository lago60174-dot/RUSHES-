import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { zernioCreatePost } from "@/lib/zernio";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { videoId, caption, videoUrl, scheduledFor } = body;

  // Multi-plateforme : `targets` est une liste de { platform, accountId }.
  // On garde la compatibilité avec l'ancien format { platform, accountId } unique.
  const targets: Array<{ platform: string; accountId: string }> =
    Array.isArray(body.targets) && body.targets.length > 0
      ? body.targets
      : body.accountId && body.platform
        ? [{ platform: body.platform, accountId: body.accountId }]
        : [];

  if (!videoId || !caption || targets.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const post = await zernioCreatePost({
      content: caption,
      platforms: targets,
      mediaUrl: videoUrl || undefined,
      scheduledFor: scheduledFor || undefined,
    });

    // Store zernio post id + every target platform/account on the video record
    const { error } = await supabase
      .from("videos")
      .update({
        zernio_post_id: post._id,
        zernio_account_id: targets[0].accountId,
        zernio_targets: targets,
        video_url: videoUrl || null,
        status: scheduledFor ? "planned" : "published",
        published_date: scheduledFor ? null : new Date().toISOString().slice(0, 10),
        published_time: scheduledFor ? null : new Date().toTimeString().slice(0, 5),
      })
      .eq("id", videoId)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ postId: post._id, targets });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
