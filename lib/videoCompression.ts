"use client";
// Compression vidéo côté navigateur (ffmpeg.wasm) — appliquée avant tout
// upload vers Supabase Storage, pour respecter les limites du projet :
//   - poids max : 50 Mo
//   - durée max : 2,3 min (≈ 138 secondes)
// Si le fichier respecte déjà les deux limites, il est uploadé tel quel.

export const MAX_VIDEO_SIZE_MB = 50;
export const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 138; // 2,3 min

type FFmpegModule = {
  FFmpeg: new () => {
    on: (event: "progress" | "log", cb: (e: { progress?: number; message?: string }) => void) => void;
    load: (opts: { coreURL: string; wasmURL: string }) => Promise<void>;
    writeFile: (name: string, data: Uint8Array) => Promise<void>;
    readFile: (name: string) => Promise<Uint8Array>;
    deleteFile: (name: string) => Promise<void>;
    exec: (args: string[]) => Promise<number>;
  };
};

let ffmpegSingleton: Awaited<ReturnType<typeof loadFFmpeg>> | null = null;

async function loadFFmpeg() {
  const { FFmpeg } = (await import("@ffmpeg/ffmpeg")) as unknown as FFmpegModule;
  const { toBlobURL } = await import("@ffmpeg/util");
  const ffmpeg = new FFmpeg();
  const base = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
  });
  return ffmpeg;
}

async function getFFmpeg() {
  if (!ffmpegSingleton) ffmpegSingleton = await loadFFmpeg();
  return ffmpegSingleton;
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const d = video.duration;
      URL.revokeObjectURL(video.src);
      resolve(Number.isFinite(d) ? d : 0);
    };
    video.onerror = () => reject(new Error("Impossible de lire les métadonnées de la vidéo"));
    video.src = URL.createObjectURL(file);
  });
}

export type CompressionInfo = {
  needed: boolean;
  originalSizeMB: number;
  originalDuration: number;
};

export async function inspectVideo(file: File): Promise<CompressionInfo> {
  const duration = await getVideoDuration(file).catch(() => 0);
  const sizeMB = file.size / (1024 * 1024);
  const needed = file.size > MAX_VIDEO_SIZE_BYTES || duration > MAX_VIDEO_DURATION_SECONDS;
  return { needed, originalSizeMB: sizeMB, originalDuration: duration };
}

/**
 * Compresse / tronque la vidéo si besoin pour respecter 50 Mo et 2,3 min max.
 * Retourne le fichier original si aucune limite n'est dépassée.
 */
export async function compressVideoFile(
  file: File,
  onProgress?: (pct: number) => void
): Promise<File> {
  const { originalDuration, needed } = await inspectVideo(file);
  if (!needed) return file;

  const ffmpeg = await getFFmpeg();
  const targetDuration = Math.min(originalDuration || MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_DURATION_SECONDS);

  // Budget de débit calculé pour viser ~92% de la limite de poids (marge de sécurité)
  const audioBitrateBps = 96_000;
  const targetTotalBits = MAX_VIDEO_SIZE_BYTES * 8 * 0.92;
  const videoBitrateBps = Math.max(150_000, Math.floor(targetTotalBits / targetDuration) - audioBitrateBps);

  const inputName = "input" + (file.name.match(/\.[^/.]+$/)?.[0] || ".mp4");
  const outputName = "output.mp4";

  const { fetchFile } = await import("@ffmpeg/util");
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  let lastPct = 0;
  ffmpeg.on("progress", ({ progress }) => {
    if (typeof progress === "number" && onProgress) {
      const pct = Math.min(99, Math.round(progress * 100));
      if (pct > lastPct) { lastPct = pct; onProgress(pct); }
    }
  });

  await ffmpeg.exec([
    "-i", inputName,
    "-t", String(targetDuration),
    "-vf", "scale=-2:'min(720,ih)'",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-b:v", `${videoBitrateBps}`,
    "-maxrate", `${Math.floor(videoBitrateBps * 1.2)}`,
    "-bufsize", `${Math.floor(videoBitrateBps * 1.5)}`,
    "-c:a", "aac",
    "-b:a", "96k",
    "-movflags", "+faststart",
    outputName,
  ]);

  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile(outputName).catch(() => {});

  onProgress?.(100);

  const blob = new Blob([data as unknown as ArrayBuffer], { type: "video/mp4" });
  const newName = file.name.replace(/\.[^/.]+$/, "") + "-compressed.mp4";
  return new File([blob], newName, { type: "video/mp4" });
}
