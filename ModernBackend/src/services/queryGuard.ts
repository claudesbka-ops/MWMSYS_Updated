import type { JwtClaims } from "../auth";

export function buildWorkerScopeWhere(user: JwtClaims): Record<string, any> {
  const roleId = user?.roleId != null ? Number(user.roleId) : null;
  const userKey = (user?.userKey ?? "").toString().trim();

  if (roleId === 3) {
    return userKey ? { Employer_Id: userKey } : { Employer_Id: "" };
  }

  if (roleId === 2) {
    return userKey ? { Worker_Id: userKey } : { Worker_Id: "" };
  }

  if (roleId === 6) {
    const nationality = user?.countryCode != null ? Number(user.countryCode) : NaN;
    return Number.isFinite(nationality) ? { Nationality: nationality } : { Nationality: -1 };
  }

  return {};
}
