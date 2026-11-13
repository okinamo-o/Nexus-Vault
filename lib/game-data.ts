export type RequirementKey =
  | "OS"
  | "Processor"
  | "Memory"
  | "Graphics"
  | "Storage";

export type RequirementsMap = Partial<Record<RequirementKey, string>>;

const requirementKeys: RequirementKey[] = [
  "OS",
  "Processor",
  "Memory",
  "Graphics",
  "Storage",
];

const requirementAliases: Record<string, RequirementKey> = {
  os: "OS",
  processor: "Processor",
  cpu: "Processor",
  memory: "Memory",
  ram: "Memory",
  graphics: "Graphics",
  gpu: "Graphics",
  storage: "Storage",
  hdd: "Storage",
  ssd: "Storage",
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSerializedJson(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function normalizeRequirements(value: unknown): RequirementsMap {
  const parsedValue = parseSerializedJson(value);

  if (!isObject(parsedValue)) return {};

  const normalized: RequirementsMap = {};

  for (const [key, raw] of Object.entries(parsedValue)) {
    const canonicalKey = requirementAliases[key.toLowerCase()] ?? null;
    if (!canonicalKey) continue;

    if (typeof raw === "string" && raw.trim().length > 0) {
      normalized[canonicalKey] = raw.trim();
    }
  }

  return normalized;
}

export type DownloadLink = {
  label: string;
  url: string;
  host: string;
};

function hostFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    const root = host.split(".")[0] ?? "mirror";
    return root.charAt(0).toUpperCase() + root.slice(1);
  } catch {
    return "Mirror";
  }
}

export function normalizeDownloadLinks(value: unknown): DownloadLink[] {
  const parsedValue = parseSerializedJson(value);
  if (!Array.isArray(parsedValue)) return [];

  const links = parsedValue
    .map((item): DownloadLink | null => {
      if (typeof item === "string" && item.startsWith("http")) {
        return {
          url: item,
          host: hostFromUrl(item),
          label: hostFromUrl(item),
        };
      }

      if (!isObject(item)) return null;

      const url = typeof item.url === "string" ? item.url : null;
      if (!url || !url.startsWith("http")) return null;

      const host = typeof item.host === "string" && item.host.trim() ? item.host.trim() : hostFromUrl(url);
      const label = typeof item.label === "string" && item.label.trim() ? item.label.trim() : host;

      return { url, host, label };
    })
    .filter((item): item is DownloadLink => item !== null);

  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

export function requirementsToRows(requirements: RequirementsMap): Array<{
  key: RequirementKey;
  value: string;
}> {
  return requirementKeys
    .map((key) => ({ key, value: requirements[key] }))
    .filter((row): row is { key: RequirementKey; value: string } => Boolean(row.value));
}

export const FALLBACK_GAME_IMAGE = "/window.svg";

/**
 * Normalizes stored image paths (Vercel Blob HTTPS URLs, root-relative paths, or bare filenames).
 */
export function resolveGameImagePath(imagePath: string | null | undefined): string {
  const trimmed = typeof imagePath === "string" ? imagePath.trim() : "";
  if (!trimmed) return FALLBACK_GAME_IMAGE;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  return `/games/${trimmed}`;
}

function toTimestampMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Computes whether a game should be highlighted as newly added or recently updated.
 */
export function getGameStatusBadge(
  createdAt?: Date | string | null,
  updatedAt?: Date | string | null,
  nowMs = Date.now()
): "New Entry" | "Updated" | null {
  const createdAtMs = toTimestampMs(createdAt);
  const updatedAtMs = toTimestampMs(updatedAt);

  if (createdAtMs !== null && nowMs - createdAtMs < SEVEN_DAYS_MS) {
    return "New Entry";
  }
  if (updatedAtMs !== null && nowMs - updatedAtMs < THREE_DAYS_MS) {
    return "Updated";
  }
  return null;
}

/**
 * Returns raw and percent-decoded slug candidates so non-ASCII slugs resolve consistently.
 */
export function getSlugLookupCandidates(rawSlug: string): string[] {
  const candidates = new Set<string>();
  const trimmed = rawSlug.trim();
  if (trimmed) candidates.add(trimmed);

  try {
    const decoded = decodeURIComponent(trimmed);
    if (decoded) candidates.add(decoded);
  } catch {
    // Ignore malformed percent-encoding and rely on raw slug.
  }

  return Array.from(candidates);
}

export function encodeGameSlugPath(slug: string): string {
  return `/game/${encodeURIComponent(slug)}`;
}

export function parsePageNumber(rawPage: string | string[] | undefined): number {
  const value = Array.isArray(rawPage) ? rawPage[0] : rawPage;
  if (!value) return 1;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}
