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
  zernioTargets?: Array<{ platform: string; accountId: string }>;
  zernioSyncedAt?: string;
  videoUrl?: string;
};

export type ZernioAccount = {
  _id: string;
  platform: string;
  name: string;
  username: string;
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
