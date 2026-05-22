import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { ensureGeofenceTable } from "../db/schemaMigrations";

export const geofenceRouter = Router();

/**
 * Haversine distance between two lat/lng points.
 * Returns distance in metres.
 */
export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Check if a GPS point is within ANY active geofence for the given employer.
 * Returns { withinAny: boolean, geofences: row[] }.
 * Returns withinAny=true (skip notification) when there are no geofences.
 */
export async function checkGeofences(
  employerId: string,
  lat: number,
  lng: number
): Promise<{ withinAny: boolean; geofences: any[] }> {
  await ensureGeofenceTable();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "Tbl_Geofences" WHERE "Employer_Id"=$1 AND "Is_Active"=TRUE`,
    employerId
  );

  if (!rows.length) return { withinAny: true, geofences: [] };

  const withinAny = rows.some((g) => {
    const dist = haversineMeters(lat, lng, Number(g.Center_Lat), Number(g.Center_Lng));
    return dist <= Number(g.Radius_Meters);
  });

  return { withinAny, geofences: rows };
}

// GET /Api/Geofences — Employer (own) or Admin (all or by employerId)
geofenceRouter.get("/Api/Geofences", requireAuth, async (req, res, next) => {
  try {
    await ensureGeofenceTable();
    const user = (req as any).user as any;
    const roleId = Number(user?.roleId ?? 0);

    let employerId: string;
    if (roleId === 1) {
      employerId = (req.query.employerId ?? "").toString().trim();
      if (!employerId) {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "Tbl_Geofences" ORDER BY "Id" DESC LIMIT 200`
        );
        return res.json(rows);
      }
    } else if (roleId === 3) {
      employerId = (user?.userKey ?? "").toString().trim();
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Tbl_Geofences" WHERE "Employer_Id"=$1 ORDER BY "Id" DESC`,
      employerId
    );
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

// POST /Api/Geofences/Create — Employer only
geofenceRouter.post("/Api/Geofences/Create", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as any;
    if (Number(user?.roleId) !== 3 && Number(user?.roleId) !== 1) {
      return res.status(403).json({ error: "Employer only" });
    }

    await ensureGeofenceTable();

    const employerId = Number(user?.roleId) === 1
      ? (req.body?.employerId ?? user?.userKey ?? "").toString().trim()
      : (user?.userKey ?? "").toString().trim();

    const { name, centerLat, centerLng, radiusMeters } = req.body ?? {};
    if (!name?.toString().trim()) return res.status(400).json({ error: "name is required" });
    const lat = Number(centerLat);
    const lng = Number(centerLng);
    const radius = Number(radiusMeters ?? 500);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "centerLat and centerLng are required" });
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Tbl_Geofences" ("Employer_Id","Name","Center_Lat","Center_Lng","Radius_Meters","Is_Active")
       VALUES ($1,$2,$3,$4,$5,TRUE)`,
      employerId, name.toString().trim(), lat, lng, radius
    );

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Tbl_Geofences" WHERE "Employer_Id"=$1 ORDER BY "Id" DESC LIMIT 1`,
      employerId
    );
    return res.status(201).json(rows[0]);
  } catch (e) {
    return next(e);
  }
});

// PUT /Api/Geofences/:id — Employer only (own geofence)
geofenceRouter.put("/Api/Geofences/:id", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as any;
    const roleId = Number(user?.roleId ?? 0);
    if (roleId !== 3 && roleId !== 1) return res.status(403).json({ error: "Employer only" });

    await ensureGeofenceTable();

    const id = Number(req.params.id ?? 0);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const employerId = (user?.userKey ?? "").toString().trim();
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Tbl_Geofences" WHERE "Id"=$1 LIMIT 1`, id
    );
    if (!existing.length) return res.status(404).json({ error: "Not found" });
    if (roleId !== 1 && existing[0].Employer_Id !== employerId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { name, centerLat, centerLng, radiusMeters, isActive } = req.body ?? {};
    await prisma.$executeRawUnsafe(
      `UPDATE "Tbl_Geofences"
       SET "Name"=COALESCE($1,"Name"),
           "Center_Lat"=COALESCE($2,"Center_Lat"),
           "Center_Lng"=COALESCE($3,"Center_Lng"),
           "Radius_Meters"=COALESCE($4,"Radius_Meters"),
           "Is_Active"=COALESCE($5,"Is_Active")
       WHERE "Id"=$6`,
      name ? name.toString().trim() : null,
      centerLat != null ? Number(centerLat) : null,
      centerLng != null ? Number(centerLng) : null,
      radiusMeters != null ? Number(radiusMeters) : null,
      isActive != null ? Boolean(isActive) : null,
      id
    );

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Tbl_Geofences" WHERE "Id"=$1 LIMIT 1`, id
    );
    return res.json(rows[0]);
  } catch (e) {
    return next(e);
  }
});

// DELETE /Api/Geofences/:id — Employer only (deactivate, not hard delete)
geofenceRouter.delete("/Api/Geofences/:id", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as any;
    const roleId = Number(user?.roleId ?? 0);
    if (roleId !== 3 && roleId !== 1) return res.status(403).json({ error: "Employer only" });

    await ensureGeofenceTable();

    const id = Number(req.params.id ?? 0);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const employerId = (user?.userKey ?? "").toString().trim();
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Tbl_Geofences" WHERE "Id"=$1 LIMIT 1`, id
    );
    if (!existing.length) return res.status(404).json({ error: "Not found" });
    if (roleId !== 1 && existing[0].Employer_Id !== employerId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "Tbl_Geofences" SET "Is_Active"=FALSE WHERE "Id"=$1`, id
    );
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});
