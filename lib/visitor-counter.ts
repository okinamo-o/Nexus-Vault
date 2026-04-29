import { prisma } from "./prisma";

export async function incrementVisitorCounter(): Promise<number> {
  const stat = await prisma.siteStat.upsert({
    where: { key: "visitors" },
    update: { value: { increment: 1 } },
    create: { key: "visitors", value: 1 },
  });
  return stat.value;
}

export async function getVisitorCounter(): Promise<number> {
  const stat = await prisma.siteStat.findUnique({
    where: { key: "visitors" },
  });
  return stat?.value ?? 0;
}
