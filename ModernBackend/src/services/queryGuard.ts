import type { JwtClaims } from "../auth";
import { prisma } from "../db";

export async function buildWorkerScopeWhere(user: JwtClaims): Promise<Record<string, any>> {
  const roleId = user?.roleId != null ? Number(user.roleId) : null;
  const userKey = (user?.userKey ?? "").toString().trim();

  if (roleId === 1) {
    return {};
  }

  if (roleId === 3) {
    return userKey ? { Employer_Id: userKey } : { Employer_Id: "" };
  }

  if (roleId === 2) {
    return userKey ? { Worker_Id: userKey } : { Worker_Id: "" };
  }

  if (roleId === 4) {
    if (!userKey) return { Worker_Id: "" };

    const links = await prisma.tbl_Worker_RecruitAgent.findMany({
      where: {
        OR: [{ Malaysian_Reqruitment_Agency: userKey }, { Source_Country_Requirtment_Agency: userKey }],
      },
      select: { Worker_Id: true },
      take: 5000,
    });

    const ids = Array.from(new Set((links ?? []).map((x) => (x.Worker_Id ?? "").toString()).filter(Boolean)));
    if (!ids.length) return { Worker_Id: "" };
    return { Worker_Id: { in: ids } };
  }

  if (roleId === 5 || roleId === 6 || roleId === 7) {
    const nationality = user?.countryCode != null ? Number(user.countryCode) : NaN;
    return Number.isFinite(nationality) ? { Nationality: nationality } : { Nationality: -1 };
  }

  return {};
}
