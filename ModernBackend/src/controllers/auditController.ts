import { Request, Response } from "express";
import { prisma } from "../db";

export async function getAuditLog(req: Request, res: Response): Promise<void> {
  const {
    userId,
    action,
    status,
    startDate,
    endDate,
    limit = "50",
    page = "1",
  } = req.query;

  const take = Math.min(Number(limit) || 50, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const where: any = {};
  if (userId) where.User_Id = String(userId);
  if (action) where.Action = { contains: String(action), mode: "insensitive" };
  if (status) where.Status = String(status);
  if (startDate || endDate) {
    where.Created_At = {};
    if (startDate) where.Created_At.gte = new Date(String(startDate));
    if (endDate) where.Created_At.lte = new Date(String(endDate));
  }

  try {
    const [logs, total] = await Promise.all([
      prisma.tbl_Audit_Log.findMany({
        where,
        orderBy: { Created_At: "desc" },
        take,
        skip,
      }),
      prisma.tbl_Audit_Log.count({ where }),
    ]);

    res.json({
      logs,
      pagination: {
        page: Number(page) || 1,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    console.error("[AuditController] Error fetching audit log:", err);
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
}

export async function getUserLoginHistory(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  try {
    const logs = await prisma.tbl_Audit_Log.findMany({
      where: {
        User_Id: String(userId),
        Action: { in: ["login_success", "login_failed", "login_blocked", "logout"] },
      },
      orderBy: { Created_At: "desc" },
      take: 20,
    });

    res.json({ logs });
  } catch (err) {
    console.error("[AuditController] Error fetching login history:", err);
    res.status(500).json({ error: "Failed to fetch login history" });
  }
}
