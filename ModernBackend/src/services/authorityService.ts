import { prisma } from "../db";
import { buildWorkerScopeWhere } from "./queryGuard";

/**
 * Embassy Dashboard Stats
 * Returns: total nationals, at-risk count, docs expiring count
 */
export async function getEmbassyDashboardStats(user: any) {
  const nationality = user?.countryCode != null ? Number(user.countryCode) : NaN;
  
  if (!Number.isFinite(nationality)) {
    return { totalNationals: 0, atRiskCount: 0, docsExpiringCount: 0 };
  }

  // Total nationals
  const totalNationals = await prisma.tbl_Worker_PersonalInfo.count({
    where: { Nationality: nationality },
  });

  // At-risk nationals (risk score > 50)
  const atRiskWorkers = await prisma.tbl_Worker_Risk_Scores.findMany({
    where: {
      Risk_Score: { gt: 50 },
      Worker_Id: {
        in: await getWorkerIdsByNationality(nationality),
      },
    },
    select: { Worker_Id: true },
  });
  const atRiskCount = atRiskWorkers.length;

  // Docs expiring in 60 days
  const sixtyDaysFromNow = new Date();
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
  
  const nationalWorkerIds = await getWorkerIdsByNationality(nationality);
  
  let docsExpiringCount = 0;
  
  // Check permit/insurance expiry
  const permitRecords = await prisma.tbl_Worker_PermitInsurance.findMany({
    where: {
      Worker_Id: { in: nationalWorkerIds },
      OR: [
        { Permit_Expire_Date: { lte: sixtyDaysFromNow, gte: new Date() } },
        { Insurance_Expire_Date: { lte: sixtyDaysFromNow, gte: new Date() } },
      ],
    },
    select: { Worker_Id: true },
  });
  docsExpiringCount += new Set(permitRecords.map(r => r.Worker_Id)).size;

  // Check passport expiry
  const passportRecords = await prisma.tbl_Worker_PersonalInfo.findMany({
    where: {
      Worker_Id: { in: nationalWorkerIds },
      Passport_Expire_Date: { lte: sixtyDaysFromNow, gte: new Date() },
    },
    select: { Worker_Id: true },
  });
  docsExpiringCount += new Set(passportRecords.map(r => r.Worker_Id)).size;

  return { totalNationals, atRiskCount, docsExpiringCount };
}

/**
 * Get at-risk nationals (Risk_Score > 50)
 */
export async function getEmbassyAtRiskNationals(user: any, limit: number = 50) {
  const nationality = user?.countryCode != null ? Number(user.countryCode) : NaN;
  
  if (!Number.isFinite(nationality)) {
    return [];
  }

  const nationalWorkerIds = await getWorkerIdsByNationality(nationality);
  
  if (nationalWorkerIds.length === 0) {
    return [];
  }

  const riskScores = await prisma.tbl_Worker_Risk_Scores.findMany({
    where: {
      Risk_Score: { gt: 50 },
      Worker_Id: { in: nationalWorkerIds },
    },
    orderBy: { Risk_Score: "desc" },
    take: limit,
  });

  // Get worker details
  const workerIds = riskScores.map(r => r.Worker_Id);
  const workers = await prisma.tbl_Worker_PersonalInfo.findMany({
    where: { Worker_Id: { in: workerIds } },
    select: {
      Worker_Id: true,
      Name: true,
      Passport_Number: true,
      Employer_Id: true,
    },
  });

  const workerMap = new Map(workers.map(w => [w.Worker_Id, w]));

  return riskScores.map(r => {
    const worker = workerMap.get(r.Worker_Id);
    return {
      workerId: r.Worker_Id,
      name: worker?.Name || r.Worker_Id,
      passportNumber: worker?.Passport_Number || "—",
      employerId: worker?.Employer_Id || "—",
      riskScore: r.Risk_Score,
      riskLevel: r.Risk_Level,
      topFactor: r.Dispute_Severity || "Document/Compliance issues",
      calculatedAt: r.Calculated_At,
    };
  });
}

/**
 * Get document expiry for nationals
 */
export async function getEmbassyDocumentExpiry(user: any, days: number = 60) {
  const nationality = user?.countryCode != null ? Number(user.countryCode) : NaN;
  
  if (!Number.isFinite(nationality)) {
    return [];
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + days);

  const nationalWorkerIds = await getWorkerIdsByNationality(nationality);
  
  if (nationalWorkerIds.length === 0) {
    return [];
  }

  const results: Array<{
    workerId: string;
    name: string;
    passportNumber: string;
    documentType: string;
    expiryDate: Date;
    daysRemaining: number;
    employerId: string;
  }> = [];

  // Get worker details
  const workers = await prisma.tbl_Worker_PersonalInfo.findMany({
    where: { Worker_Id: { in: nationalWorkerIds } },
    select: {
      Worker_Id: true,
      Name: true,
      Passport_Number: true,
      Passport_Expire_Date: true,
      Employer_Id: true,
    },
  });

  const now = new Date();

  for (const worker of workers) {
    // Check passport
    if (worker.Passport_Expire_Date && worker.Passport_Expire_Date <= cutoffDate) {
      const daysRemaining = Math.floor((worker.Passport_Expire_Date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      results.push({
        workerId: worker.Worker_Id,
        name: worker.Name || worker.Worker_Id,
        passportNumber: worker.Passport_Number || "—",
        documentType: "Passport",
        expiryDate: worker.Passport_Expire_Date,
        daysRemaining,
        employerId: worker.Employer_Id || "—",
      });
    }
  }

  // Check permits/insurance
  const permits = await prisma.tbl_Worker_PermitInsurance.findMany({
    where: {
      Worker_Id: { in: nationalWorkerIds },
      OR: [
        { Permit_Expire_Date: { lte: cutoffDate } },
        { Insurance_Expire_Date: { lte: cutoffDate } },
      ],
    },
  });

  const workerMap = new Map(workers.map(w => [w.Worker_Id, w]));

  for (const permit of permits) {
    const worker = workerMap.get(permit.Worker_Id);
    if (!worker) continue;

    if (permit.Permit_Expire_Date && permit.Permit_Expire_Date <= cutoffDate) {
      const daysRemaining = Math.floor((permit.Permit_Expire_Date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      results.push({
        workerId: permit.Worker_Id,
        name: worker.Name || permit.Worker_Id,
        passportNumber: worker.Passport_Number || "—",
        documentType: "Work Permit",
        expiryDate: permit.Permit_Expire_Date,
        daysRemaining,
        employerId: worker.Employer_Id || "—",
      });
    }

    if (permit.Insurance_Expire_Date && permit.Insurance_Expire_Date <= cutoffDate) {
      const daysRemaining = Math.floor((permit.Insurance_Expire_Date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      results.push({
        workerId: permit.Worker_Id,
        name: worker.Name || permit.Worker_Id,
        passportNumber: worker.Passport_Number || "—",
        documentType: "Insurance",
        expiryDate: permit.Insurance_Expire_Date,
        daysRemaining,
        employerId: worker.Employer_Id || "—",
      });
    }
  }

  // Sort by days remaining (ascending)
  return results.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/**
 * Get all national workers for embassy
 */
export async function getEmbassyWorkers(user: any, search?: string, limit: number = 100) {
  const nationality = user?.countryCode != null ? Number(user.countryCode) : NaN;
  
  if (!Number.isFinite(nationality)) {
    return [];
  }

  const where: any = { Nationality: nationality };
  
  if (search) {
    where.OR = [
      { Name: { contains: search, mode: "insensitive" } },
      { Passport_Number: { contains: search, mode: "insensitive" } },
    ];
  }

  const workers = await prisma.tbl_Worker_PersonalInfo.findMany({
    where,
    take: limit,
    orderBy: { Created_On: "desc" },
    select: {
      Worker_Id: true,
      Name: true,
      Passport_Number: true,
      Employer_Id: true,
      Created_On: true,
    },
  });

  // Get risk levels
  const workerIds = workers.map(w => w.Worker_Id);
  const riskScores = await prisma.tbl_Worker_Risk_Scores.findMany({
    where: { Worker_Id: { in: workerIds } },
    select: { Worker_Id: true, Risk_Level: true },
  });
  const riskMap = new Map(riskScores.map(r => [r.Worker_Id, r.Risk_Level]));

  // Get agencies for workers
  const recruitAgents = await prisma.tbl_Worker_RecruitAgent.findMany({
    where: { Worker_Id: { in: workerIds } },
    select: { Worker_Id: true, Malaysian_Reqruitment_Agency: true },
  });
  const agencyMap = new Map(recruitAgents.map(r => [r.Worker_Id, r.Malaysian_Reqruitment_Agency]));

  return workers.map(w => ({
    workerId: w.Worker_Id,
    name: w.Name || w.Worker_Id,
    passportNumber: w.Passport_Number || "—",
    employerId: w.Employer_Id || "—",
    agencyId: agencyMap.get(w.Worker_Id) || "—",
    riskLevel: riskMap.get(w.Worker_Id) || "unknown",
    status: "active",
  }));
}

/**
 * Labour Department Dashboard Stats
 */
export async function getLabourDashboardStats() {
  const [totalWorkers, totalEmployers, complianceIssues, activeDisputes] = await Promise.all([
    prisma.tbl_Worker_PersonalInfo.count(),
    prisma.tbl_Employer.count(),
    prisma.tbl_Compliance_Alerts.count({
      where: {
        Severity: { in: ["CRITICAL", "HIGH"] },
        Is_Resolved: false,
      },
    }),
    prisma.tbl_SalaryDispute.count({
      where: { Status: { not: "Resolved" } },
    }),
  ]);

  return { totalWorkers, totalEmployers, complianceIssues, activeDisputes };
}

/**
 * Workforce statistics for charts
 */
export async function getLabourWorkforceStats() {
  // Nationality breakdown (top 10)
  const nationalities = await prisma.tbl_Worker_PersonalInfo.groupBy({
    by: ["Nationality"],
    _count: { Worker_Id: true },
    orderBy: { _count: { Worker_Id: "desc" } },
    take: 10,
  });

  // Employer breakdown (top 10)
  const employers = await prisma.tbl_Worker_PersonalInfo.groupBy({
    by: ["Employer_Id"],
    _count: { Worker_Id: true },
    where: { Employer_Id: { not: null } },
    orderBy: { _count: { Worker_Id: "desc" } },
    take: 10,
  });

  // Get employer names
  const employerIds = employers.map(e => e.Employer_Id).filter(Boolean) as string[];
  const employerDetails = await prisma.tbl_Employer.findMany({
    where: { User_Id: { in: employerIds } },
    select: { User_Id: true, Employer_Name: true },
  });
  const employerNameMap = new Map(employerDetails.map(e => [e.User_Id, e.Employer_Name]));

  // Document compliance status
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [validCount, expiringCount, expiredCount] = await Promise.all([
    // Valid: all docs > 30 days
    prisma.tbl_Worker_PermitInsurance.count({
      where: {
        Permit_Expire_Date: { gt: thirtyDaysFromNow },
        Insurance_Expire_Date: { gt: thirtyDaysFromNow },
      },
    }),
    // Expiring: any doc <= 30 days but not expired
    prisma.tbl_Worker_PermitInsurance.count({
      where: {
        OR: [
          { Permit_Expire_Date: { lte: thirtyDaysFromNow, gte: now } },
          { Insurance_Expire_Date: { lte: thirtyDaysFromNow, gte: now } },
        ],
      },
    }),
    // Expired: any doc < now
    prisma.tbl_Worker_PermitInsurance.count({
      where: {
        OR: [
          { Permit_Expire_Date: { lt: now } },
          { Insurance_Expire_Date: { lt: now } },
        ],
      },
    }),
  ]);

  return {
    nationalities: nationalities.map(n => ({
      nationality: n.Nationality,
      count: n._count.Worker_Id,
    })),
    employers: employers.map(e => ({
      employerId: e.Employer_Id,
      employerName: employerNameMap.get(e.Employer_Id || "") || e.Employer_Id || "Unknown",
      count: e._count.Worker_Id,
    })),
    complianceStatus: {
      valid: validCount,
      expiring: expiringCount,
      expired: expiredCount,
    },
  };
}

/**
 * Compliance overview for all employers
 */
export async function getLabourComplianceOverview() {
  const employers = await prisma.tbl_Employer.findMany({
    select: {
      User_Id: true,
      Employer_Name: true,
    },
    take: 100,
  });

  const employerIds = employers.map(e => e.User_Id);

  // Get compliance scores
  const scores = await prisma.tbl_Compliance_Scores.findMany({
    where: { Employer_Id: { in: employerIds } },
    select: {
      Employer_Id: true,
      Score: true,
      Total_Workers: true,
      Expired_Docs: true,
      Expiring_Soon: true,
    },
  });
  const scoreMap = new Map(scores.map(s => [s.Employer_Id, s]));

  // Get alert counts per employer
  const alerts = await prisma.tbl_Compliance_Alerts.findMany({
    where: {
      Employer_Id: { in: employerIds },
      Is_Resolved: false,
    },
    select: { Employer_Id: true, Severity: true },
  });

  const alertCounts = new Map<string, { critical: number; high: number }>();
  for (const alert of alerts) {
    const empId = alert.Employer_Id || "unknown";
    const existing = alertCounts.get(empId) || { critical: 0, high: 0 };
    if (alert.Severity === "CRITICAL") existing.critical++;
    if (alert.Severity === "HIGH") existing.high++;
    alertCounts.set(empId, existing);
  }

  return employers.map(e => {
    const score = scoreMap.get(e.User_Id);
    const counts = alertCounts.get(e.User_Id) || { critical: 0, high: 0 };
    
    let status = "good";
    if (counts.critical > 0) status = "critical";
    else if (counts.high > 0) status = "high";
    else if ((score?.Score || 100) < 70) status = "medium";

    return {
      employerId: e.User_Id,
      employerName: e.Employer_Name || e.User_Id,
      workers: score?.Total_Workers || 0,
      score: score?.Score || 100,
      criticalAlerts: counts.critical,
      highAlerts: counts.high,
      expiredDocs: score?.Expired_Docs || 0,
      status,
    };
  }).sort((a, b) => a.score - b.score);
}

/**
 * Dispute overview for labour department
 */
export async function getLabourDisputeOverview(
  severity?: string,
  status?: string,
  limit: number = 100
) {
  const where: any = {};
  
  if (status) {
    where.Status = status;
  }

  const disputes = await prisma.tbl_SalaryDispute.findMany({
    where,
    take: limit,
    orderBy: { Created_On: "desc" },
  });

  const workerIds = disputes.map(d => d.Worker_Id);
  const workers = await prisma.tbl_Worker_PersonalInfo.findMany({
    where: { Worker_Id: { in: workerIds } },
    select: { Worker_Id: true, Name: true },
  });
  const workerMap = new Map(workers.map(w => [w.Worker_Id, w.Name]));

  // Get AI severity from risk scores (if available)
  const riskScores = await prisma.tbl_Worker_Risk_Scores.findMany({
    where: { Worker_Id: { in: workerIds } },
    select: { Worker_Id: true, Dispute_Severity: true },
  });
  const severityMap = new Map(riskScores.map(r => [r.Worker_Id, r.Dispute_Severity]));

  return disputes.map(d => ({
    disputeId: d.Id,
    workerId: d.Worker_Id,
    workerName: workerMap.get(d.Worker_Id) || d.Worker_Id,
    employerId: d.Employer_Id,
    expectedAmount: d.Expected_Amount,
    receivedAmount: d.Received_Amount,
    disputeMonth: d.Dispute_Month,
    description: d.Description,
    status: d.Status,
    aiSeverity: severityMap.get(d.Worker_Id) || "unknown",
    submittedDate: d.Created_On,
  })).filter(d => !severity || d.aiSeverity === severity);
}

// Helper function
async function getWorkerIdsByNationality(nationality: number): Promise<string[]> {
  const workers = await prisma.tbl_Worker_PersonalInfo.findMany({
    where: { Nationality: nationality },
    select: { Worker_Id: true },
  });
  return workers.map(w => w.Worker_Id);
}
