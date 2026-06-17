import * as repo from "../repositories/healthRepository";

export async function getHealth() {
  // business logic can be extended here
  const repoStatus = await repo.ping();
  return { ok: true, time: new Date().toISOString(), db: repoStatus };
}
