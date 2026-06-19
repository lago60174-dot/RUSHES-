import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { videoPath, videoName, maxClips = 5 } = await request.json();
  if (!videoPath) return NextResponse.json({ error: "Missing videoPath" }, { status: 400 });

  const jobId = uid();

  // Create job record
  const { error: jobErr } = await supabase.from("clip_jobs").insert({
    id: jobId,
    user_id: user.id,
    video_path: videoPath,
    video_name: videoName || videoPath.split("/").pop(),
    status: "pending",
  });
  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });

  // Trigger Render worker (fire and forget — worker responds 202 immediately)
  const workerUrl = process.env.RENDER_WORKER_URL;
  if (!workerUrl) {
    return NextResponse.json({ error: "RENDER_WORKER_URL not configured" }, { status: 500 });
  }

  fetch(`${workerUrl}/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-secret": process.env.WORKER_SECRET || "",
    },
    body: JSON.stringify({ jobId, videoPath, userId: user.id, maxClips }),
  }).catch((err) => {
    console.error("Failed to trigger worker:", err);
    supabase.from("clip_jobs").update({ status: "error", error: "Worker unreachable" }).eq("id", jobId);
  });

  return NextResponse.json({ jobId });
}
