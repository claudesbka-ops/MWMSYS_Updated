import { prisma } from "../db";
import {
  createNotification,
  hasRecentNotification,
  type NotificationType,
} from "./notificationService";
import { sendNotificationEmail } from "./emailService";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
let schedulerStarted = false;

/**
 * Start the alert scheduler.
 * Runs immediately once, then every 24 hours.
 * Call this 5 minutes after server boot.
 */
export function startAlertScheduler(): void {
  if (schedulerStarted) {
    console.log("[AlertScheduler] Already running");
    return;
  }

  schedulerStarted = true;
  console.log("[AlertScheduler] Starting...");

  // Run immediately on first start
  runDailyScan();

  // Then every 24 hours
  setInterval(runDailyScan, ONE_DAY_MS);

  // Weekly report: check every hour if it's Monday 8am
  setInterval(maybeRunWeeklyReport, ONE_HOUR_MS);
  maybeRunWeeklyReport();

  console.log("[AlertScheduler] Scheduled to run every 24 hours (+ weekly report check hourly)");
}

/**
 * Fires sendWeeklyReport only when the current hour is Monday 08:xx local time
 * and we haven't sent one this week already.
 */
async function maybeRunWeeklyReport(): Promise<void> {
  const now = new Date();
  if (now.getDay() !== 1 || now.getHours() !== 8) return; // 1 = Monday
  await sendWeeklyReport();
}

/**
 * Main daily scan — runs all alert tasks in sequence.
 */
async function runDailyScan(): Promise<void> {
  const startTime = Date.now();
  console.log(`[AlertScheduler] Daily scan started at ${new Date().toISOString()}`);

  try {
    await scanDocumentExpiry();
    await scanRiskScores();
    await scanUnresolvedDisputes();
    await scanComplianceScores();

    const duration = Date.now() - startTime;
    console.log(`[AlertScheduler] Daily scan completed in ${duration}ms`);
  } catch (error) {
    console.error("[AlertScheduler] Error during daily scan:", error);
  }
}

// ==================== WEEKLY COMPLIANCE REPORT ====================

async function sendWeeklyReport(): Promise<void> {
  console.log("[AlertScheduler] Running weekly compliance report...");

  try {
    // Deduplication: check if we already sent a report this Monday
    const now = new Date();
    const mondayStart = new Date(now);
    mondayStart.setHours(0, 0, 0, 0);
    const sentKey = `weekly_report_${mondayStart.toISOString().slice(0, 10)}`;

    const alreadySent = await hasRecentNotification("__system__", "weekly_report" as any, sentKey);
    if (alreadySent) {
      console.log("[AlertScheduler] Weekly report already sent this week — skipping");
      return;
    }

    // Gather stats
    const [totalWorkers, pendingDisputes, expiringDocs, criticalRisk] = await Promise.all([
      prisma.tbl_Worker_PersonalInfo.count(),
      prisma.tbl_SalaryDispute.count({ where: { Status: "Pending" } }).catch(() => 0),
      prisma.tbl_Worker_PersonalInfo.count({
        where: {
          Passport_Expire_Date: {
            gte: now,
            lte: new Date(now.getTime() + 30 * ONE_DAY_MS),
          },
        },
      }),
      prisma.tbl_Worker_Risk_Scores.count({ where: { Risk_Level: "critical" } }).catch(() => 0),
    ]);

    const activeWorkers = totalWorkers; // Active = all with a record; adjust if status column exists
    const weekStart = mondayStart.toDateString();

    const reportData = {
      weekStart,
      totalWorkers,
      activeWorkers,
      pendingDisputes,
      expiringDocs,
      criticalRiskWorkers: criticalRisk,
    };

    // Get all Admin (roleId=1) and Agency (roleId=4) users
    const recipients = await prisma.tbl_User.findMany({
      where: {
        User_Role: { in: [1, 4] },
        User_Status: { not: 0 },
      },
      select: { User_Id: true, Email_Id: true, User_Role: true },
      take: 200,
    });

    let sent = 0;
    for (const r of recipients ?? []) {
      const email = (r.Email_Id ?? "").toString().trim();
      if (!email || email.startsWith("deleted_")) continue;
      await sendNotificationEmail(email, "weekly_report", reportData);
      sent++;
    }

    // Record sentinel so we don't send again this week
    await createNotification({
      userId: "__system__",
      type: "weekly_report" as any,
      title: `Weekly report sent — ${weekStart}`,
      message: sentKey,
      actionUrl: "/",
    });

    console.log(`[AlertScheduler] Weekly report sent to ${sent} recipients`);
  } catch (err) {
    console.error("[AlertScheduler] Weekly report error:", err);
  }
}

// ==================== TASK 1: DOCUMENT EXPIRY ====================

async function scanDocumentExpiry(): Promise<void> {
  console.log("[AlertScheduler] Scanning document expiry...");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const alertDays = [30, 7, 1, 0]; // 0 = expired today
  let totalAlerts = 0;

  for (const days of alertDays) {
    const targetDate = new Date(today);
    if (days === 0) {
      // Already expired (yesterday or earlier)
      targetDate.setDate(targetDate.getDate() - 1);
    } else {
      targetDate.setDate(targetDate.getDate() + days);
    }

    const workersWithExpiringDocs = await findWorkersWithExpiringDocs(targetDate, days);

    for (const worker of workersWithExpiringDocs) {
      const isExpired = days === 0;
      const alertType: NotificationType = "doc_expiry";
      const title = isExpired
        ? `⚠️ Document Expired: ${worker.docType}`
        : `⏰ Document Expiring in ${days} days: ${worker.docType}`;
      const message = `[ID: ${worker.workerId}] ${worker.workerName}'s ${worker.docType} ${
        isExpired ? "expired on" : "expires on"
      } ${worker.expiryDate.toDateString()}.`;

      // Get recipients (agency, admin, worker)
      const recipients = await getRecipientsForWorker(worker.workerId, worker.agencyId);

      for (const recipient of recipients) {
        if (await hasRecentNotification(recipient.userId, alertType, worker.workerId)) {
          continue; // Skip duplicate
        }

        // Create in-app notification
        await createNotification({
          userId: recipient.userId,
          type: alertType,
          title,
          message,
          actionUrl: `/worker/${worker.workerId}`,
        });

        // Send email if preferences allow
        if (recipient.email && recipient.prefs?.emailDocExpiry) {
          await sendNotificationEmail(recipient.email, alertType, {
            workerName: worker.workerName,
            docType: worker.docType,
            daysRemaining: isExpired ? 0 : days,
            expiryDate: worker.expiryDate.toDateString(),
          });
        }

        totalAlerts++;
      }
    }
  }

  console.log(`[AlertScheduler] Document expiry: ${totalAlerts} alerts sent`);
}

interface ExpiringDocWorker {
  workerId: string;
  workerName: string;
  agencyId: string;
  docType: string;
  expiryDate: Date;
}

async function findWorkersWithExpiringDocs(
  targetDate: Date,
  days: number
): Promise<ExpiringDocWorker[]> {
  const results: ExpiringDocWorker[] = [];
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  // Check Passport Expiry
  const workersWithPassport = await prisma.tbl_Worker_PersonalInfo.findMany({
    where: {
      Passport_Expire_Date: {
        gte: targetDate,
        lt: nextDay,
      },
    },
    select: {
      Worker_Id: true,
      Name: true,
      Passport_Expire_Date: true,
    },
  });

  for (const w of workersWithPassport) {
    const relationship = await prisma.tbl_Worker_EmployerLink.findFirst({
      where: { workerId: w.Worker_Id, status: "active" },
      select: { employerId: true },
    });

    results.push({
      workerId: w.Worker_Id,
      workerName: w.Name || w.Worker_Id,
      agencyId: relationship?.employerId || "",
      docType: "Passport",
      expiryDate: w.Passport_Expire_Date!,
    });
  }

  // Check Permit Expiry (skip Insurance - field name issues in Prisma)
  const workersWithPermit = await prisma.tbl_Worker_PermitInsurance.findMany({
    where: {
      Permit_Expire_Date: {
        gte: targetDate,
        lt: nextDay,
      },
    },
    select: {
      Worker_Id: true,
      Permit_Expire_Date: true,
    },
  });

  for (const w of workersWithPermit) {
    const worker = await prisma.tbl_Worker_PersonalInfo.findUnique({
      where: { Worker_Id: w.Worker_Id },
      select: { Name: true },
    });

    const relationship = await prisma.tbl_Worker_EmployerLink.findFirst({
      where: { workerId: w.Worker_Id, status: "active" },
      select: { employerId: true },
    });

    if (w.Permit_Expire_Date) {
      results.push({
        workerId: w.Worker_Id,
        workerName: worker?.Name || w.Worker_Id,
        agencyId: relationship?.employerId || "",
        docType: "Work Permit",
        expiryDate: w.Permit_Expire_Date,
      });
    }
  }

  return results;
}

// ==================== TASK 2: RISK SCORES ====================

async function scanRiskScores(): Promise<void> {
  console.log("[AlertScheduler] Scanning risk scores...");

  const since = new Date(Date.now() - ONE_DAY_MS); // Last 24 hours

  const criticalRisks = await prisma.tbl_Worker_Risk_Scores.findMany({
    where: {
      Risk_Level: "critical",
      Calculated_At: { gte: since },
    },
  });

  let totalAlerts = 0;

  for (const risk of criticalRisks) {
    const alertType: NotificationType = "risk_critical";
    const title = `🚨 Critical Risk Alert: ${risk.Worker_Id}`;
    const message = `[ID: ${risk.Worker_Id}] Risk Score: ${risk.Risk_Score}/100. Level: ${risk.Risk_Level}.`;

    const recipients = await getRecipientsForWorker(risk.Worker_Id, null);

    for (const recipient of recipients) {
      if (await hasRecentNotification(recipient.userId, alertType, risk.Worker_Id)) {
        continue;
      }

      await createNotification({
        userId: recipient.userId,
        type: alertType,
        title,
        message,
        actionUrl: `/risk-dashboard`,
      });

      if (recipient.email && recipient.prefs?.emailRiskCritical) {
        await sendNotificationEmail(recipient.email, alertType, {
          workerId: risk.Worker_Id,
          riskScore: risk.Risk_Score,
          riskLevel: risk.Risk_Level,
        });
      }

      totalAlerts++;
    }
  }

  console.log(`[AlertScheduler] Risk scores: ${totalAlerts} alerts sent`);
}

// ==================== TASK 3: UNRESOLVED DISPUTES ====================

async function scanUnresolvedDisputes(): Promise<void> {
  console.log("[AlertScheduler] Scanning unresolved disputes...");

  const sevenDaysAgo = new Date(Date.now() - 7 * ONE_DAY_MS);

  const pendingDisputes = await prisma.tbl_SalaryDispute.findMany({
    where: {
      Status: "Pending",
      Submitted_At: { lt: sevenDaysAgo },
    },
  });

  let totalAlerts = 0;

  for (const dispute of pendingDisputes) {
    const alertType: NotificationType = "dispute_reminder";
    const daysPending = Math.floor(
      (Date.now() - new Date(dispute.Submitted_At).getTime()) / ONE_DAY_MS
    );

    const title = `📋 Pending Dispute Requires Review`;
    const message = `[ID: ${dispute.Id}] Worker: ${dispute.Worker_Id}, Amount: $${dispute.Expected_Amount}, Pending for ${daysPending} days.`;

    const recipients = await getRecipientsForDispute(dispute.Worker_Id, dispute.Employer_Id);

    for (const recipient of recipients) {
      if (await hasRecentNotification(recipient.userId, alertType, String(dispute.Id))) {
        continue;
      }

      await createNotification({
        userId: recipient.userId,
        type: alertType,
        title,
        message,
        actionUrl: `/dispute`,
      });

      if (recipient.email && recipient.prefs?.emailDisputes) {
        await sendNotificationEmail(recipient.email, alertType, {
          disputeId: dispute.Id,
          workerId: dispute.Worker_Id,
          amount: dispute.Expected_Amount,
          daysPending,
        });
      }

      totalAlerts++;
    }
  }

  console.log(`[AlertScheduler] Unresolved disputes: ${totalAlerts} alerts sent`);
}

// ==================== TASK 4: COMPLIANCE SCORES ====================

async function scanComplianceScores(): Promise<void> {
  console.log("[AlertScheduler] Scanning compliance scores...");

  const since = new Date(Date.now() - ONE_DAY_MS);

  const lowScores = await prisma.tbl_Compliance_Scores.findMany({
    where: {
      Score: { lt: 50 },
      Calculated_At: { gte: since },
    },
  });

  let totalAlerts = 0;

  for (const score of lowScores) {
    const alertType: NotificationType = "compliance_low";
    const title = `⚠️ Low Compliance Score: ${score.Employer_Id}`;
    const message = `[ID: ${score.Employer_Id}] Compliance Score: ${score.Score}/100. Expired Docs: ${score.Expired_Docs || 0}.`;

    const recipients = await getRecipientsForEmployer(score.Employer_Id);

    for (const recipient of recipients) {
      if (await hasRecentNotification(recipient.userId, alertType, score.Employer_Id)) {
        continue;
      }

      await createNotification({
        userId: recipient.userId,
        type: alertType,
        title,
        message,
        actionUrl: `/risk-dashboard`,
      });

      if (recipient.email && recipient.prefs?.emailComplianceAlerts) {
        await sendNotificationEmail(recipient.email, alertType, {
          employerId: score.Employer_Id,
          score: score.Score,
          expiredDocs: score.Expired_Docs,
        });
      }

      totalAlerts++;
    }
  }

  console.log(`[AlertScheduler] Compliance scores: ${totalAlerts} alerts sent`);
}

// ==================== RECIPIENT HELPERS ====================

interface Recipient {
  userId: string;
  email?: string;
  prefs?: {
    emailDocExpiry: boolean;
    emailComplianceAlerts: boolean;
    emailDisputes: boolean;
    emailRiskCritical: boolean;
    emailLeaveUpdates: boolean;
  };
}

async function getRecipientsForWorker(
  workerId: string,
  agencyId: string | null
): Promise<Recipient[]> {
  const recipients: Recipient[] = [];

  // Get worker's agency via employer link
  if (!agencyId) {
    const rel = await prisma.tbl_Worker_EmployerLink.findFirst({
      where: { workerId, status: "active" },
      select: { employerId: true },
    });
    agencyId = rel?.employerId || null;
  }

  // Add agency admin
  if (agencyId) {
    const agency = await prisma.tbl_Agent.findFirst({
      where: { User_Id: agencyId },
      select: { Agent_EmailID: true },
    });
    if (agency) {
      recipients.push({
        userId: agencyId,
        email: agency.Agent_EmailID || undefined,
      });
    }
  }

  // Add system admin (get first admin)
  const admin = await prisma.tbl_User.findFirst({
    where: { User_Role: 1 },
    select: { User_Id: true, Email_Id: true },
  });
  if (admin) {
    recipients.push({
      userId: admin.User_Id,
      email: admin.Email_Id || undefined,
    });
  }

  // Add worker if they have email
  const worker = await prisma.tbl_Worker_PersonalInfo.findUnique({
    where: { Worker_Id: workerId },
    select: { Email_Id: true },
  });
  if (worker?.Email_Id) {
    recipients.push({
      userId: workerId,
      email: worker.Email_Id,
    });
  }

  return recipients;
}

async function getRecipientsForDispute(
  workerId: string,
  employerId: string
): Promise<Recipient[]> {
  const recipients = await getRecipientsForWorker(workerId, null);

  // Add employer - lookup by employerInfo table
  const employerInfo = await prisma.tbl_Worker_EmployerInfo.findUnique({
    where: { Worker_Id: workerId },
    select: { Employer_Name: true },
  });

  // Find employer user by name
  if (employerInfo?.Employer_Name) {
    const employer = await prisma.tbl_Employer.findFirst({
      where: { Employer_Name: employerInfo.Employer_Name },
      select: { User_Id: true, Employer_ContactPerson_Email: true },
    });
    if (employer) {
      recipients.push({
        userId: employer.User_Id,
        email: employer.Employer_ContactPerson_Email || undefined,
      });
    }
  }

  return recipients;
}

async function getRecipientsForEmployer(employerId: string): Promise<Recipient[]> {
  const recipients: Recipient[] = [];

  // Get employer and their agency
  const employer = await prisma.tbl_Employer.findFirst({
    where: { User_Id: employerId },
    select: { User_Id: true, Employer_ContactPerson_Email: true },
  });

  // Find agency through Agency_Employer_Link
  const agencyLink = await prisma.tbl_Agency_Employer_Link.findFirst({
    where: { employerId: employerId },
    select: { agencyId: true },
  });

  if (agencyLink?.agencyId) {
    const agency = await prisma.tbl_Agent.findFirst({
      where: { User_Id: agencyLink.agencyId },
      select: { Agent_EmailID: true },
    });
    if (agency?.Agent_EmailID) {
      recipients.push({
        userId: agencyLink.agencyId,
        email: agency.Agent_EmailID,
      });
    }
  }

  // Add admin
  const admin = await prisma.tbl_User.findFirst({
    where: { User_Role: 1 },
    select: { User_Id: true, Email_Id: true },
  });
  if (admin) {
    recipients.push({
      userId: admin.User_Id,
      email: admin.Email_Id || undefined,
    });
  }

  return recipients;
}
