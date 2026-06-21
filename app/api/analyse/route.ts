import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const PLATFORMS: Record<string, string> = {
  tiktok: "TikTok", instagram: "Instagram",
  youtube: "YouTube Shorts", facebook: "Facebook",
};

async function callMistral(system: string, user: string) {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: "mistral-large-latest",
      max_tokens: 1000,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || "")
    .trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { videos } = await request.json();
  if (!videos || videos.length < 5) return NextResponse.json({ error: "Not enough data" }, { status: 400 });

  const payload = videos.map((v: Record<string, unknown>) => ({
    plateforme: PLATFORMS[v.platform as string] || v.platform,
    titre: v.title, hashtags: v.hashtags, notes: v.notes,
    date_publication: v.publishedDate, heure_publication: v.publishedTime || null,
    duree_secondes: v.durationSeconds || null, vues: v.views || 0,
    likes: v.likes || 0, commentaires: v.comments || 0, partages: v.shares || 0,
    favoris: v.saves || 0, nouveaux_abonnes: v.newFollowers || 0,
    temps_moyen_visionnage: v.avgWatchTime || null, taux_completion: v.completionRate || null,
  }));

  const system = `Tu es un analyste de croissance spécialisé en contenu vidéo court (TikTok, Instagram Reels, YouTube Shorts, Facebook Reels).
Analyse uniquement les données fournies, sans rien inventer.
Réponds UNIQUEMENT avec un JSON valide sans markdown : {"patterns":["..."],"recommendations":["..."],"next_ideas":["..."]}
3 à 5 éléments par liste. Chaque élément fait une phrase courte (25 mots max), en français, concrète et actionnable.`;

  const text = await callMistral(system, `Vidéos publiées :\n${JSON.stringify(payload)}`);
  const result = JSON.parse(text);
  const generatedAt = new Date().toISOString();

  await supabase.from("ai_analyses").upsert({
    user_id: user.id, result, video_count: videos.length, generated_at: generatedAt,
  });
  return NextResponse.json({ result, generatedAt, videoCount: videos.length });
}
