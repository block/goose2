import type { ChatSession } from "@/features/chat/stores/chatSessionStore";

export interface SessionDateGroup {
  label: string;
  sessions: ChatSession[];
}

function startOfDayUTC(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function formatDateLabel(date: Date, today: Date): string {
  const todayStart = startOfDayUTC(today);
  const dateStart = startOfDayUTC(date);
  const diff = todayStart - dateStart;

  if (diff === 0) return "Today";
  if (diff === 86_400_000) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function groupSessionsByDate(
  sessions: ChatSession[],
): SessionDateGroup[] {
  if (sessions.length === 0) return [];

  const now = new Date();
  const buckets = new Map<string, ChatSession[]>();
  const labelOrder: string[] = [];

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  for (const session of sorted) {
    const date = new Date(session.updatedAt);
    const label = formatDateLabel(date, now);

    let bucket = buckets.get(label);
    if (!bucket) {
      bucket = [];
      buckets.set(label, bucket);
      labelOrder.push(label);
    }
    bucket.push(session);
  }

  return labelOrder.map((label) => ({
    label,
    sessions: buckets.get(label) ?? [],
  }));
}
