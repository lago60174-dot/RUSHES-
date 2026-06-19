import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { zernioGetConnectUrl } from "@/lib/zernio";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  if (!platform) return NextResponse.json({ error: "Missing platform" }, { status: 400 });

  // Get saved Zernio profileId from settings
  const { data: settings } = await supabase
    .from("settings")
    .select("data")
    .eq("user_id", user.id)
    .single();
  const profileId = settings?.data?.zernioProfileId as string | undefined;
  if (!profileId) return NextResponse.json({ error: "No Zernio profile set up. Create a profile first via the Zernio dashboard." }, { status: 400 });

  try {
    const authUrl = await zernioGetConnectUrl(platform, profileId);
    return NextResponse.json({ authUrl });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
