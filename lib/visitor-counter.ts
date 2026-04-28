let inMemoryVisitors = 0;

export async function incrementVisitorCounter(): Promise<number> {
  inMemoryVisitors += 1;
  return inMemoryVisitors;
}

export async function getVisitorCounter(): Promise<number> {
  return inMemoryVisitors;
}
