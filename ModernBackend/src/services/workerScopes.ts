import { prisma } from "../db";

export type WorkerScopes = {
  employerId: string | null;
  nationality: number | null;
  agencyIds: string[];
};

/**
 * Resolves the scope attributes for a worker used for socket room joins
 * and data-access filtering: their current employer, nationality, and
 * the recruitment agencies linked to them (Malaysian + source-country).
 */
export async function resolveWorkerScopes(workerId: string): Promise<WorkerScopes> {
  const wid = (workerId ?? "").toString().trim();
  if (!wid) return { employerId: null, nationality: null, agencyIds: [] };

  const info = await prisma.tbl_Worker_PersonalInfo.findFirst({
    where: { Worker_Id: wid },
    select: { Employer_Id: true, Nationality: true },
  });

  const links = await prisma.tbl_Worker_RecruitAgent.findMany({
    where: { Worker_Id: wid },
    select: { Malaysian_Reqruitment_Agency: true, Source_Country_Requirtment_Agency: true },
    take: 10,
  });

  const agencyIds = new Set<string>();
  for (const l of links ?? []) {
    const a = (l.Malaysian_Reqruitment_Agency ?? "").toString().trim();
    const b = (l.Source_Country_Requirtment_Agency ?? "").toString().trim();
    if (a) agencyIds.add(a);
    if (b) agencyIds.add(b);
  }

  const employerId = (info?.Employer_Id ?? "").toString().trim() || null;
  const nationality = info?.Nationality != null ? Number(info.Nationality) : NaN;

  return {
    employerId,
    nationality: Number.isFinite(nationality) ? nationality : null,
    agencyIds: Array.from(agencyIds),
  };
}
