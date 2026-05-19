import { Request, Response, NextFunction } from "express";
import {
  getEmbassyDashboardStats,
  getEmbassyAtRiskNationals,
  getEmbassyDocumentExpiry,
  getEmbassyWorkers,
  getLabourDashboardStats,
  getLabourWorkforceStats,
  getLabourComplianceOverview,
  getLabourDisputeOverview,
} from "../services/authorityService";

// Embassy Controllers

export async function embassyDashboard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = (req as any).user;
    const stats = await getEmbassyDashboardStats(user);
    return res.json(stats);
  } catch (e) {
    return next(e);
  }
}

export async function embassyAtRisk(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = (req as any).user;
    const limit = parseInt(req.query.limit as string) || 50;
    const workers = await getEmbassyAtRiskNationals(user, limit);
    return res.json({ workers });
  } catch (e) {
    return next(e);
  }
}

export async function embassyDocumentExpiry(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = (req as any).user;
    const days = parseInt(req.query.days as string) || 60;
    const documents = await getEmbassyDocumentExpiry(user, days);
    return res.json({ documents });
  } catch (e) {
    return next(e);
  }
}

export async function embassyWorkers(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = (req as any).user;
    const search = (req.query.search as string) || "";
    const limit = parseInt(req.query.limit as string) || 100;
    const workers = await getEmbassyWorkers(user, search, limit);
    return res.json({ workers });
  } catch (e) {
    return next(e);
  }
}

// Labour Department Controllers

export async function labourDashboard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const stats = await getLabourDashboardStats();
    return res.json(stats);
  } catch (e) {
    return next(e);
  }
}

export async function labourWorkforceStats(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const stats = await getLabourWorkforceStats();
    return res.json(stats);
  } catch (e) {
    return next(e);
  }
}

export async function labourComplianceOverview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const employers = await getLabourComplianceOverview();
    return res.json({ employers });
  } catch (e) {
    return next(e);
  }
}

export async function labourDisputeOverview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const severity = (req.query.severity as string) || "";
    const status = (req.query.status as string) || "";
    const limit = parseInt(req.query.limit as string) || 100;
    const disputes = await getLabourDisputeOverview(severity, status, limit);
    return res.json({ disputes });
  } catch (e) {
    return next(e);
  }
}
