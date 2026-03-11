export type HowToVideo = {
  id: string;
  title: string;
  url: string;
  category: string;
  description?: string;
  createdAt: string;
};

const STORAGE_KEY = "evfleet_how_to_videos_v1";

function readVideos(): HowToVideo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HowToVideo[];
  } catch {
    return [];
  }
}

function writeVideos(videos: HowToVideo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
}

export function getHowToVideos() {
  return readVideos().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function addHowToVideo(input: Omit<HowToVideo, "id" | "createdAt">) {
  const next: HowToVideo = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    title: input.title.trim(),
    url: input.url.trim(),
    category: input.category.trim() || "Geral",
    description: input.description?.trim() || undefined,
  };
  const videos = readVideos();
  videos.unshift(next);
  writeVideos(videos);
  return next;
}

export function deleteHowToVideo(id: string) {
  const videos = readVideos().filter((video) => video.id !== id);
  writeVideos(videos);
}
