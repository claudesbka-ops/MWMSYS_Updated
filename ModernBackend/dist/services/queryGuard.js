"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWorkerScopeWhere = buildWorkerScopeWhere;
const db_1 = require("../db");
/**
 * Returns a Prisma `where` fragment that scopes `Tbl_Worker_PersonalInfo`
 * queries to the workers the caller is permitted to see.
 *
 * Role ID semantics:
 *   1 Admin                       → all workers (no filter)
 *   2 Worker                      → own record only
 *   3 Employer                    → workers assigned to this employer
 *   4 Agency                      → union of (workers linked via recruit-agent) +
 *                                   (workers whose Employer_Id is in the agency's
 *                                    Tbl_Agency_Employer_Link set)
 *   5 Embassy (source)            → workers matching embassy nationality
 *   6 Embassy (destination)       → workers matching embassy nationality
 *   7 Labour Department           → all workers (no filter) — global oversight
 */
async function buildWorkerScopeWhere(user) {
    const roleId = user?.roleId != null ? Number(user.roleId) : null;
    const userKey = (user?.userKey ?? "").toString().trim();
    // Admin + Labour Department see everything.
    if (roleId === 1 || roleId === 7) {
        return {};
    }
    if (roleId === 3) {
        return userKey ? { Employer_Id: userKey } : { Employer_Id: "" };
    }
    if (roleId === 2) {
        return userKey ? { Worker_Id: userKey } : { Worker_Id: "" };
    }
    if (roleId === 4) {
        if (!userKey)
            return { Worker_Id: "" };
        const [recruitLinks, agencyEmployerLinks] = await Promise.all([
            db_1.prisma.tbl_Worker_RecruitAgent.findMany({
                where: {
                    OR: [{ Malaysian_Reqruitment_Agency: userKey }, { Source_Country_Requirtment_Agency: userKey }],
                },
                select: { Worker_Id: true },
                take: 5000,
            }),
            db_1.prisma.tbl_Agency_Employer_Link.findMany({
                where: { agencyId: userKey },
                select: { employerId: true },
                take: 5000,
            }),
        ]);
        const workerIdSet = new Set();
        for (const r of recruitLinks ?? []) {
            const v = (r.Worker_Id ?? "").toString().trim();
            if (v)
                workerIdSet.add(v);
        }
        const employerIds = Array.from(new Set((agencyEmployerLinks ?? []).map((x) => (x.employerId ?? "").toString().trim()).filter(Boolean)));
        // Build OR clauses: workers by ID set + workers under any linked employer.
        const ors = [];
        if (workerIdSet.size > 0)
            ors.push({ Worker_Id: { in: Array.from(workerIdSet) } });
        if (employerIds.length > 0)
            ors.push({ Employer_Id: { in: employerIds } });
        if (ors.length === 0)
            return { Worker_Id: "" };
        if (ors.length === 1)
            return ors[0];
        return { OR: ors };
    }
    if (roleId === 5 || roleId === 6) {
        const nationality = user?.countryCode != null ? Number(user.countryCode) : NaN;
        return Number.isFinite(nationality) ? { Nationality: nationality } : { Nationality: -1 };
    }
    return {};
}
