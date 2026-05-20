import { prisma } from "../db";

export interface AuditLogParams {
  userId?: string;
  userRole?: string;
  action: string;
  entity?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  status: "success" | "failed" | "blocked";
  details?: object;
}

export async function logAudit(params: AuditLogParams): Promise<void> {
  // Fire and forget - never block the main request
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Tbl_Audit_Log"("User_Id","User_Role","Action","Entity","Entity_Id","Ip_Address","User_Agent","Status","Details","Created_At") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      params.userId ?? null,
      params.userRole ?? null,
      params.action,
      params.entity ?? null,
      params.entityId ?? null,
      params.ipAddress ?? null,
      params.userAgent ?? null,
      params.status,
      params.details ? JSON.stringify(params.details) : null,
      new Date()
    );
  } catch (err) {
    // Log to console but never throw
    console.error("[AuditLog] Failed to write audit entry:", err);
  }
}
