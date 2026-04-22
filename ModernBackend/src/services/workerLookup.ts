import { prisma } from "../db";

/**
 * Resolves the worker's business key (`tbl_Worker_PersonalInfo.Worker_Id`)
 * from the JWT's numeric user id (`tbl_User.ID`). Returns null when the
 * JWT identity does not map to a worker.
 */
export async function findWorkerIdByJwtUserId(jwtUserId: number): Promise<string | null> {
  if (!Number.isFinite(jwtUserId) || jwtUserId <= 0) return null;

  const user = await prisma.tbl_User.findFirst({
    where: { ID: jwtUserId },
  });

  const workerId = user?.User_Id?.toString()?.trim();
  return workerId ? workerId : null;
}

/**
 * Resolves the worker's passport number from the JWT numeric user id.
 * Returns null when the JWT identity does not map to a worker, or when
 * the worker record has no passport on file.
 */
export async function findWorkerPassportByJwtUserId(jwtUserId: number): Promise<string | null> {
  if (!Number.isFinite(jwtUserId) || jwtUserId <= 0) return null;

  const user = await prisma.tbl_User.findFirst({
    where: { ID: jwtUserId },
  });

  const workerId = user?.User_Id?.toString();
  if (!workerId) return null;

  const worker = await prisma.tbl_Worker_PersonalInfo.findFirst({
    where: { Worker_Id: workerId },
  });

  const passport = worker?.Passport_Number?.toString()?.trim();
  return passport ? passport : null;
}
