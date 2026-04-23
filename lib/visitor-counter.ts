import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const metricsDir = path.join(process.cwd(), "storage");
const metricsFile = path.join(metricsDir, "site-metrics.json");

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
  const metrics = await readMetrics();
  const nextValue = metrics.visitors + 1;
  await writeMetrics({ visitors: nextValue });
  return nextValue;
}

export async function getVisitorCounter(): Promise<number> {
  const metrics = await readMetrics();
  return metrics.visitors;
}
