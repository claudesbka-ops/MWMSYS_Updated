import { prisma } from "../db";
import { generateBatchAlertSummaries, AlertForAi } from "../services/complianceAiService";

/**
 * Compliance Copilot Controller
 * Handles compliance scanning, scoring, and alert generation
 */

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "GOOD";

export type ComplianceAlert = {
  workerId: string;
  employerId?: string;
  agencyId?: string;
  alertType: string;
  severity: Severity;
  daysUntilExpiry: number;
  documentType: string;
  expiryDate: Date | null;
  workerName: string;
  employerName?: string | null;
};

export type ComplianceScore = {
  employerId: string;
  employerName: string | null;
  score: number;
  totalWorkers: number;
  expiredDocs: number;
  expiringSoon: number;
  missingDocs: number;
  activeDisputes: number;
  breakdown: Record<string, number>;
};

export type ScanSummary = {
  totalWorkers: number;
  criticalAlerts: number;
  highAlerts: number;
  mediumAlerts: number;
  lowAlerts: number;
  scoresUpdated: number;
  scanRunAt: Date;
};

/**
 * Calculate severity based on days until expiry
 */
function calculateSeverity(days: number): Severity {
  if (days <= 0) return "CRITICAL";
  if (days <= 7) return "HIGH";
  if (days <= 30) return "MEDIUM";
  if (days <= 60) return "LOW";
  return "GOOD";
}

/**
 * Calculate compliance score (0-100)
 */
function calculateScore(
  critical: number,
  high: number,
  medium: number,
  missing: number
): number {
  let score = 100;
  score -= critical * 15;
  score -= high * 8;
  score -= medium * 3;
  score -= missing * 10;
  return Math.max(0, score);
}

/**
 * Get days until expiry from a date
 */
function getDaysUntilExpiry(expiryDate: Date | null): number {
  if (!expiryDate) return -999; // Missing/never set
  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Run full compliance scan
 * 1. Check all workers' document expiry dates
 * 2. Generate alerts for expiring/expired documents
 * 3. Calculate employer compliance scores
 * 4. Use BATCHED AI for summaries (one call for all)
 */
export async function runComplianceScan(
  scopedWorkerIds: string[],
  userRole: number,
  userAgency?: string
): Promise<ScanSummary> {
  const scanRunAt = new Date();

  // Delete existing unresolved alerts for scoped workers (duplicate prevention)
  await prisma.tbl_Compliance_Alerts.deleteMany({
    where: {
      Worker_Id: { in: scopedWorkerIds },
      Is_Resolved: false,
    },
  });

  // Fetch all worker data with their documents
  const workers = await prisma.tbl_Worker_PersonalInfo.findMany({
    where: { Worker_Id: { in: scopedWorkerIds } },
    select: {
      Worker_Id: true,
      Name: true,
      Passport_Number: true,
      Passport_Expire_Date: true,
      Employer_Id: true,
    },
  });

  const workerIds = workers.map((w) => w.Worker_Id);

  // Fetch permit/insurance data
  const permits = await prisma.tbl_Worker_PermitInsurance.findMany({
    where: { Worker_Id: { in: workerIds } },
    select: {
      Worker_Id: true,
      Permit_Expire_Date: true,
      Insurance_Expire_Date: true,
    },
  });

  // Fetch employer info
  const employerIds = workers
    .map((w) => w.Employer_Id)
    .filter((id): id is string => !!id);
  const employers = await prisma.tbl_Worker_EmployerInfo.findMany({
    where: { Worker_Id: { in: workerIds } },
    select: {
      Worker_Id: true,
      Employer_Name: true,
    },
  });

  // Build lookup maps
  const permitMap = new Map(permits.map((p) => [p.Worker_Id, p]));
  const employerMap = new Map(employers.map((e) => [e.Worker_Id, e]));

  // Collect all alerts
  const alerts: ComplianceAlert[] = [];
  const alertsForAi: AlertForAi[] = [];

  for (const worker of workers) {
    const permit = permitMap.get(worker.Worker_Id);
    const employer = employerMap.get(worker.Worker_Id);

    // Check Passport
    const passportDays = getDaysUntilExpiry(worker.Passport_Expire_Date);
    const passportSeverity = calculateSeverity(passportDays);
    if (passportSeverity !== "GOOD") {
      alerts.push({
        workerId: worker.Worker_Id,
        employerId: worker.Employer_Id ?? undefined,
        alertType: passportDays <= 0 ? "passport_expired" : "passport_expiring",
        severity: passportSeverity,
        daysUntilExpiry: passportDays,
        documentType: "passport",
        expiryDate: worker.Passport_Expire_Date,
        workerName: worker.Name || worker.Worker_Id,
        employerName: employer?.Employer_Name ?? undefined,
      });
      alertsForAi.push({
        workerId: worker.Worker_Id,
        workerName: worker.Name || worker.Worker_Id,
        documentType: "passport",
        daysUntilExpiry: passportDays,
        severity: passportSeverity,
        employerName: employer?.Employer_Name ?? undefined,
      });
    }

    // Check Work Permit
    if (permit?.Permit_Expire_Date) {
      const permitDays = getDaysUntilExpiry(permit.Permit_Expire_Date);
      const permitSeverity = calculateSeverity(permitDays);
      if (permitSeverity !== "GOOD") {
        alerts.push({
          workerId: worker.Worker_Id,
          employerId: worker.Employer_Id ?? undefined,
          alertType: permitDays <= 0 ? "permit_expired" : "permit_expiring",
          severity: permitSeverity,
          daysUntilExpiry: permitDays,
          documentType: "work_permit",
          expiryDate: permit.Permit_Expire_Date,
          workerName: worker.Name || worker.Worker_Id,
          employerName: employer?.Employer_Name ?? undefined,
        });
        alertsForAi.push({
          workerId: worker.Worker_Id,
          workerName: worker.Name || worker.Worker_Id,
          documentType: "work permit",
          daysUntilExpiry: permitDays,
          severity: permitSeverity,
          employerName: employer?.Employer_Name ?? undefined,
        });
      }
    } else {
      // Missing permit
      alerts.push({
        workerId: worker.Worker_Id,
        employerId: worker.Employer_Id ?? undefined,
        alertType: "missing_permit",
        severity: "CRITICAL",
        daysUntilExpiry: -999,
        documentType: "work_permit",
        expiryDate: null,
        workerName: worker.Name || worker.Worker_Id,
        employerName: employer?.Employer_Name ?? undefined,
      });
      alertsForAi.push({
        workerId: worker.Worker_Id,
        workerName: worker.Name || worker.Worker_Id,
        documentType: "work permit",
        daysUntilExpiry: -999,
        severity: "CRITICAL",
        employerName: employer?.Employer_Name ?? undefined,
      });
    }

    // Check Insurance (using Insurance_Expire_Date only)
    if (permit?.Insurance_Expire_Date) {
      const insDays = getDaysUntilExpiry(permit.Insurance_Expire_Date);
      const insSeverity = calculateSeverity(insDays);
      if (insSeverity !== "GOOD") {
        alerts.push({
          workerId: worker.Worker_Id,
          employerId: worker.Employer_Id ?? undefined,
          alertType: insDays <= 0 ? "insurance_expired" : "insurance_expiring",
          severity: insSeverity,
          daysUntilExpiry: insDays,
          documentType: "insurance",
          expiryDate: permit.Insurance_Expire_Date,
          workerName: worker.Name || worker.Worker_Id,
          employerName: employer?.Employer_Name ?? undefined,
        });
        alertsForAi.push({
          workerId: worker.Worker_Id,
          workerName: worker.Name || worker.Worker_Id,
          documentType: "insurance",
          daysUntilExpiry: insDays,
          severity: insSeverity,
          employerName: employer?.Employer_Name ?? undefined,
        });
      }
    } else {
      // Missing insurance
      alerts.push({
        workerId: worker.Worker_Id,
        employerId: worker.Employer_Id ?? undefined,
        alertType: "missing_insurance",
        severity: "CRITICAL",
        daysUntilExpiry: -999,
        documentType: "insurance",
        expiryDate: null,
        workerName: worker.Name || worker.Worker_Id,
        employerName: employer?.Employer_Name ?? undefined,
      });
      alertsForAi.push({
        workerId: worker.Worker_Id,
        workerName: worker.Name || worker.Worker_Id,
        documentType: "insurance",
        daysUntilExpiry: -999,
        severity: "CRITICAL",
        employerName: employer?.Employer_Name ?? undefined,
      });
    }
  }

  // BATCHED AI: Generate summaries for ALL alerts in ONE call
  const aiSummaries = await generateBatchAlertSummaries(alertsForAi);

  // Save alerts to database
  for (const alert of alerts) {
    await prisma.tbl_Compliance_Alerts.create({
      data: {
        Worker_Id: alert.workerId,
        Employer_Id: alert.employerId,
        Agency_Id: userAgency,
        Alert_Type: alert.alertType,
        Severity: alert.severity,
        Days_Until_Expiry: alert.daysUntilExpiry === -999 ? null : alert.daysUntilExpiry,
        Document_Type: alert.documentType,
        Expiry_Date: alert.expiryDate,
        Ai_Summary: aiSummaries.get(alert.workerId) || null,
        Is_Resolved: false,
        Scan_Run_At: scanRunAt,
      },
    });
  }

  // Calculate employer scores
  const employerScores = new Map<string, ComplianceScore>();

  for (const alert of alerts) {
    if (!alert.employerId) continue;

    let score = employerScores.get(alert.employerId);
    if (!score) {
      score = {
        employerId: alert.employerId,
        employerName: alert.employerName || "Unknown",
        score: 100,
        totalWorkers: 0,
        expiredDocs: 0,
        expiringSoon: 0,
        missingDocs: 0,
        activeDisputes: 0,
        breakdown: {},
      };
      employerScores.set(alert.employerId, score);
    }

    score.totalWorkers++;

    if (alert.severity === "CRITICAL") {
      score.expiredDocs++;
    } else if (alert.severity === "HIGH" || alert.severity === "MEDIUM") {
      score.expiringSoon++;
    }

    if (alert.alertType.startsWith("missing_")) {
      score.missingDocs++;
    }

    score.breakdown[alert.documentType] = (score.breakdown[alert.documentType] || 0) + 1;
  }

  // Calculate final scores and save
  const criticalCount = alerts.filter((a) => a.severity === "CRITICAL").length;
  const highCount = alerts.filter((a) => a.severity === "HIGH").length;
  const mediumCount = alerts.filter((a) => a.severity === "MEDIUM").length;

  for (const [employerId, scoreData] of employerScores) {
    const finalScore = calculateScore(
      criticalCount,
      highCount,
      mediumCount,
      scoreData.missingDocs
    );

    await prisma.tbl_Compliance_Scores.create({
      data: {
        Employer_Id: employerId,
        Score: finalScore,
        Total_Workers: scoreData.totalWorkers,
        Expired_Docs: scoreData.expiredDocs,
        Expiring_Soon: scoreData.expiringSoon,
        Missing_Docs: scoreData.missingDocs,
        Active_Disputes: scoreData.activeDisputes,
        Score_Breakdown: scoreData.breakdown,
        Scanned_At: scanRunAt,
      },
    });
  }

  return {
    totalWorkers: workers.length,
    criticalAlerts: criticalCount,
    highAlerts: highCount,
    mediumAlerts: mediumCount,
    lowAlerts: alerts.filter((a) => a.severity === "LOW").length,
    scoresUpdated: employerScores.size,
    scanRunAt,
  };
}

/**
 * Get compliance alerts with filtering
 */
export async function getAlerts(
  filters: {
    severity?: string;
    employerId?: string;
    isResolved?: boolean;
    agencyId?: string;
  },
  skip: number,
  take: number
) {
  const where: any = {};

  if (filters.severity) {
    where.Severity = filters.severity;
  }
  if (filters.employerId) {
    where.Employer_Id = filters.employerId;
  }
  if (filters.isResolved !== undefined) {
    where.Is_Resolved = filters.isResolved;
  }
  if (filters.agencyId) {
    where.Agency_Id = filters.agencyId;
  }

  const [alerts, total] = await Promise.all([
    prisma.tbl_Compliance_Alerts.findMany({
      where,
      orderBy: { Created_At: "desc" },
      skip,
      take,
    }),
    prisma.tbl_Compliance_Alerts.count({ where }),
  ]);

  return { alerts, total };
}

/**
 * Get employer compliance scores
 */
export async function getEmployerScores(agencyId?: string) {
  const where: any = {};
  if (agencyId) {
    where.Agency_Id = agencyId;
  }

  // Get latest score per employer
  const scores = await prisma.tbl_Compliance_Scores.findMany({
    where,
    orderBy: { Scanned_At: "desc" },
    distinct: ["Employer_Id"],
  });

  // Sort by score ascending (worst first)
  return scores.sort((a, b) => (a.Score || 0) - (b.Score || 0));
}

/**
 * Resolve an alert
 */
export async function resolveAlert(alertId: number): Promise<boolean> {
  try {
    await prisma.tbl_Compliance_Alerts.update({
      where: { Id: alertId },
      data: {
        Is_Resolved: true,
        Resolved_At: new Date(),
      },
    });
    return true;
  } catch (err) {
    console.error("[compliance] Failed to resolve alert:", err);
    return false;
  }
}

/**
 * Get dashboard summary stats
 */
export async function getDashboardSummary(agencyId?: string) {
  const alertWhere: any = { Is_Resolved: false };
  if (agencyId) {
    alertWhere.Agency_Id = agencyId;
  }

  const [criticalCount, highCount, avgScore, lastScan] = await Promise.all([
    prisma.tbl_Compliance_Alerts.count({ where: { ...alertWhere, Severity: "CRITICAL" } }),
    prisma.tbl_Compliance_Alerts.count({ where: { ...alertWhere, Severity: "HIGH" } }),
    prisma.tbl_Compliance_Scores.aggregate({
      _avg: { Score: true },
    }),
    prisma.tbl_Compliance_Scores.findFirst({
      orderBy: { Scanned_At: "desc" },
      select: { Scanned_At: true },
    }),
  ]);

  // Find most at-risk employer
  const mostAtRisk = await prisma.tbl_Compliance_Scores.findFirst({
    orderBy: { Score: "asc" },
    select: { Employer_Id: true, Score: true },
  });

  return {
    criticalCount,
    highCount,
    avgScore: Math.round(avgScore._avg?.Score || 0),
    mostAtRiskEmployer: mostAtRisk?.Employer_Id || null,
    lastScannedAt: lastScan?.Scanned_At || null,
  };
}
