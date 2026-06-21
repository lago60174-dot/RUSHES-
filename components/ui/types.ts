export type Video = {
  id: string;
  platform: string;
  title: string;
  hashtags: string;
  notes: string;
  status: "planned" | "published";
  scheduledDate?: string;
  scheduledTime?: string;
  publishedDate?: string;
  publishedTime?: string;
  durationSeconds: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  newFollowers: number;
  avgWatchTime: number;
  completionRate: number;
  zernioPostId?: string;
  zernioAccountId?: string;
  zernioSyncedAt?: string;
  videoUrl?: string;
};

export type ZernioAccount = {
  _id: string;
  platform: string;
  name: string;
  username: string;
};

export type ClipJob = {
  id: string;
  status: "pending" | "processing" | "done" | "error";
  video_name: string;
  clips: Clip[] | null;
  error?: string;
  created_at: string;
};

export type Clip = {
  url: string;
  hook: string;
  reason: string;
  startTime: number;
  endTime: number;
  duration: number;
  captions: Record<string, { caption: string; hashtags: string }>;
};

export type AIMeta = {
  generatedAt: string;
  videoCount: number;
};

export type AIAnalysis = {
  patterns: string[];
  recommendations: string[];
  next_ideas: string[];
};
