import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const PLATFORMS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube Shorts",
  facebook: "Facebook",
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { videos } = await request.json();
  if (!videos || videos.length < 5) {
    return NextResponse.json({ error: "Not enough data" }, { status: 400 });
  }

  const payload = videos.map((v: Record<string, unknown>) => ({
    plateforme: PLATFORMS[v.platform as string] || v.platform,
    titre: v.title,
    hashtags: v.hashtags,
    notes: v.notes,
    date_publication: v.publishedDate,
    heure_publication: v.publishedTime || null,
    duree_secondes: v.durationSeconds || null,
    vues: v.views || 0,
    likes: v.likes || 0,
    commentaires: v.comments || 0,
    partages: v.shares || 0,
    favoris: v.saves || 0,
    nouveaux_abonnes: v.newFollowers || 0,
    temps_moyen_visionnage: v.avgWatchTime || null,
    taux_completion: v.completionRate || null,
  }));

  const system = [
    "Tu es un analyste de croissance spécialisé en contenu vidéo court (TikTok, Instagram Reels, YouTube Shorts, Facebook Reels).",
    "On te fournit l'historique de vidéos déjà publiées par un créateur, avec leurs métadonnées et leurs statistiques.",
    "Analyse uniquement les données fournies, sans rien inventer ni supposer au-delà de ce qui est présent.",
    'Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans bloc de code, avec exactement cette forme : {"patterns":["..."],"recommendations":["..."],"next_ideas":["..."]}',
    "3 à 5 éléments par liste maximum. Chaque élément fait une phrase courte (25 mots maximum), en français, concrète et actionnable.",
    '"patterns" décrit des tendances observées dans les données.',
    '"recommendations" décrit des actions concrètes à appliquer à partir de maintenant.',
    '"next_ideas" propose des idées de prochaines vidéos qui s\'appuient sur ce qui fonctionne déjà chez ce créateur.',
  ].join(" ");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: `Voici les vidéos publiées :\n${JSON.stringify(payload)}` }],
    }),
  });

  const data = await response.json();
  const text = (data.content || [])
    .map((item: { type: string; text?: string }) => item.text || "")
    .join("\n")
    .trim()
    .replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();

  const result = JSON.parse(text);
  const generatedAt = new Date().toISOString();

  // Cache in Supabase
  await supabase.from("ai_analyses").upsert({
    user_id: user.id,
    result,
    video_count: videos.length,
    generated_at: generatedAt,
  });

  return NextResponse.json({ result, generatedAt, videoCount: videos.length });
}
