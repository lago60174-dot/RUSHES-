const ZERNIO_BASE = "https://zernio.com/api/v1";

function zernioHeaders() {
  return {
    Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
    "Content-Type": "application/json",
  };
}

// List all connected social accounts
export async function zernioListAccounts() {
  const res = await fetch(`${ZERNIO_BASE}/accounts`, {
    headers: zernioHeaders(),
  });
  if (!res.ok) throw new Error(`Zernio accounts error: ${res.status}`);
  const data = await res.json();
  return data.accounts as Array<{
    _id: string;
    platform: string;
    name: string;
    username: string;
    profilePicture?: string;
  }>;
}

// Get OAuth URL to connect a platform account
export async function zernioGetConnectUrl(platform: string, profileId: string) {
  const res = await fetch(
    `${ZERNIO_BASE}/connect/${platform}?profileId=${profileId}`,
    { headers: zernioHeaders() }
  );
  if (!res.ok) throw new Error(`Zernio connect error: ${res.status}`);
  const data = await res.json();
  return data.authUrl as string;
}

// Create a post (publish now or schedule)
export async function zernioCreatePost(params: {
  content: string;
  platforms: Array<{ platform: string; accountId: string }>;
  mediaUrl?: string;
  scheduledFor?: string; // ISO string, omit for immediate publish
  timezone?: string;
}) {
  const body: Record<string, unknown> = {
    content: params.content,
    platforms: params.platforms,
  };
  if (params.scheduledFor) {
    body.scheduledFor = params.scheduledFor;
    body.timezone = params.timezone || "UTC";
  } else {
    body.publishNow = true;
  }
  if (params.mediaUrl) {
    body.mediaUrl = params.mediaUrl;
  }

  const res = await fetch(`${ZERNIO_BASE}/posts`, {
    method: "POST",
    headers: zernioHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Zernio post error: ${res.status}`);
  }
  const data = await res.json();
  return data.post as { _id: string; [key: string]: unknown };
}

// Get analytics for a specific post
export async function zernioGetPostAnalytics(postId: string) {
  const res = await fetch(`${ZERNIO_BASE}/analytics/${postId}`, {
    headers: zernioHeaders(),
  });
  if (!res.ok) throw new Error(`Zernio analytics error: ${res.status}`);
  return res.json() as Promise<{
    postId: string;
    platforms: Record<
      string,
      {
        views?: number;
        impressions?: number;
        likes?: number;
        comments?: number;
        shares?: number;
        saves?: number;
        newFollowers?: number;
        avgWatchTime?: number;
        completionRate?: number;
      }
    >;
  }>;
}

// Map Zernio analytics to our video schema
export function mapZernioAnalytics(
  platformData: Record<string, unknown>,
  platform: string
) {
  const d = (platformData[platform] || {}) as Record<string, number>;
  return {
    views: d.views ?? d.impressions ?? 0,
    likes: d.likes ?? 0,
    comments: d.comments ?? 0,
    shares: d.shares ?? 0,
    saves: d.saves ?? 0,
    newFollowers: d.newFollowers ?? 0,
    avgWatchTime: d.avgWatchTime ?? 0,
    completionRate: d.completionRate ?? 0,
  };
}
