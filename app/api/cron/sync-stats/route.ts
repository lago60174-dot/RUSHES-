import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { zernioGetPostAnalytics, mapZernioAnalyticsMulti } from "@/lib/zernio";

// Synchronise automatiquement les statistiques de toutes les vidéos publiées
// (tous utilisateurs) ayant un post Zernio lié. Déclenché soit par :
//  - Vercel Cron (voir vercel.json) — header `Authorization: Bearer ${CRON_SECRET}`
//  - un webhook externe (Render, GitHub Actions, etc.) — header `x-cron-secret`
function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  return auth === `Bearer ${secret}` || headerSecret === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: videos, error } = await supabase
    .from("videos")
    .select("id, platform, zernio_post_id, zernio_targets")
    .eq("status", "published")
    .not("zernio_post_id", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let synced = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const video of videos || []) {
    try {
      const analytics = await zernioGetPostAnalytics(video.zernio_post_id as string);
      const targetPlatforms: string[] =
        Array.isArray(video.zernio_targets) && video.zernio_targets.length > 0
          ? video.zernio_targets.map((t: { platform: string }) => t.platform)
          : [video.platform as string];
      const mapped = mapZernioAnalyticsMulti(analytics.platforms, targetPlatforms);

      const { error: updateError } = await supabase
        .from("videos")
        .update({
          views: mapped.views,
          likes: mapped.likes,
          comments: mapped.comments,
          shares: mapped.shares,
          saves: mapped.saves,
          new_followers: mapped.newFollowers,
          avg_watch_time: mapped.avgWatchTime,
          completion_rate: mapped.completionRate,
          zernio_synced_at: new Date().toISOString(),
        })
        .eq("id", video.id);

      if (updateError) throw new Error(updateError.message);
      synced += 1;
    } catch (e) {
      errors.push({ id: video.id as string, error: (e as Error).message });
    }
  }

  return NextResponse.json({ ok: true, synced, total: videos?.length || 0, errors });
}
