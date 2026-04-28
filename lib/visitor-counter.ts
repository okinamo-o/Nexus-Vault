import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const metricsDir = path.join(process.cwd(), "storage");
const metricsFile = path.join(metricsDir, "site-metrics.json");
const isReadOnlyRuntime = process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

type SiteMetrics = {
  visitors: number;
};

async function readMetrics(): Promise<SiteMetrics> {
  try {
    const content = await readFile(metricsFile, "utf8");
    const parsed = JSON.parse(content) as Partial<SiteMetrics>;
    return {
      visitors: Number.isFinite(parsed.visitors) ? Number(parsed.visitors) : 0,
    };
  } catch {
    return { visitors: 0 };
  }
}

async function writeMetrics(metrics: SiteMetrics): Promise<void> {
  await mkdir(metricsDir, { recursive: true });
  await writeFile(metricsFile, JSON.stringify(metrics, null, 2), "utf8");
}

export async function incrementVisitorCounter(): Promise<number> {
  if (isReadOnlyRuntime) return 0;

  try {
    const metrics = await readMetrics();
    const nextValue = metrics.visitors + 1;
    await writeMetrics({ visitors: nextValue });
    return nextValue;
  } catch {
    // On serverless platforms with read-only filesystem (e.g. Vercel),
    // metrics writes can fail. Never crash page rendering for analytics.
    return 0;
  }
}

export async function getVisitorCounter(): Promise<number> {
  if (isReadOnlyRuntime) return 0;

  const metrics = await readMetrics();
  return metrics.visitors;
}
