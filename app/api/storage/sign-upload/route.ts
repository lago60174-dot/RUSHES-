import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Génère une URL d'upload signée côté serveur (utilisateur authentifié via cookies),
// que le navigateur utilise ensuite pour uploader directement vers Supabase Storage.
// Avantages :
//  - Pas de "auth.uid() = null" côté RLS (le serveur, lui, est authentifié) -> plus d'erreur RLS
//  - Le fichier ne transite jamais par la fonction Next.js -> pas de limite de taille de payload Vercel
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { filename } = await request.json().catch(() => ({ filename: "video.mp4" }));
  const ext = (filename || "video.mp4").split(".").pop() || "mp4";
  const path = `${user.id}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage.from("videos").createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Échec de génération de l'URL d'upload" }, { status: 500 });
  }

  return NextResponse.json({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    path: data.path,
    token: data.token,
  });
}
