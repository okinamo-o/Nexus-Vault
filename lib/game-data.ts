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
