"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findWorkerIdByJwtUserId = findWorkerIdByJwtUserId;
exports.findWorkerPassportByJwtUserId = findWorkerPassportByJwtUserId;
const db_1 = require("../db");
/**
 * Resolves the worker's business key (`tbl_Worker_PersonalInfo.Worker_Id`)
 * from the JWT's numeric user id (`tbl_User.ID`). Returns null when the
 * JWT identity does not map to a worker.
 */
async function findWorkerIdByJwtUserId(jwtUserId) {
    if (!Number.isFinite(jwtUserId) || jwtUserId <= 0)
        return null;
    const user = await db_1.prisma.tbl_User.findFirst({
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
async function findWorkerPassportByJwtUserId(jwtUserId) {
    if (!Number.isFinite(jwtUserId) || jwtUserId <= 0)
        return null;
    const user = await db_1.prisma.tbl_User.findFirst({
        where: { ID: jwtUserId },
    });
    const workerId = user?.User_Id?.toString();
    if (!workerId)
        return null;
    const worker = await db_1.prisma.tbl_Worker_PersonalInfo.findFirst({
        where: { Worker_Id: workerId },
    });
    const passport = worker?.Passport_Number?.toString()?.trim();
    return passport ? passport : null;
}
