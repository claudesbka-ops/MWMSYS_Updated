import { prisma } from "../db";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

export interface LockStatus {
  locked: boolean;
  minutesLeft?: number;
}

export async function checkAccountLocked(userId: string): Promise<LockStatus> {
  const user = await prisma.tbl_User.findFirst({
    where: { User_Id: userId },
    select: {
      Failed_Login_Attempts: true,
      Locked_Until: true,
    },
  });

  if (!user) return { locked: false };

  // Check if lockout has expired
  if (user.Locked_Until && new Date() < user.Locked_Until) {
    const minutesLeft = Math.ceil(
      (user.Locked_Until.getTime() - Date.now()) / (60 * 1000)
    );
    return { locked: true, minutesLeft };
  }

  // Lockout expired, clear it
  if (user.Locked_Until && new Date() >= user.Locked_Until) {
    await prisma.tbl_User.updateMany({
      where: { User_Id: userId },
      data: {
        Failed_Login_Attempts: 0,
        Locked_Until: null,
        Last_Failed_At: null,
      },
    });
  }

  return { locked: false };
}

export async function recordFailedAttempt(userId: string): Promise<void> {
  const user = await prisma.tbl_User.findFirst({
    where: { User_Id: userId },
    select: { Failed_Login_Attempts: true },
  });

  const newCount = (user?.Failed_Login_Attempts ?? 0) + 1;

  if (newCount >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    await prisma.tbl_User.updateMany({
      where: { User_Id: userId },
      data: {
        Failed_Login_Attempts: newCount,
        Locked_Until: lockedUntil,
        Last_Failed_At: new Date(),
      },
    });
  } else {
    await prisma.tbl_User.updateMany({
      where: { User_Id: userId },
      data: {
        Failed_Login_Attempts: newCount,
        Last_Failed_At: new Date(),
      },
    });
  }
}

export async function resetFailedAttempts(userId: string): Promise<void> {
  await prisma.tbl_User.updateMany({
    where: { User_Id: userId },
    data: {
      Failed_Login_Attempts: 0,
      Locked_Until: null,
      Last_Failed_At: null,
    },
  });
}

export function getRemainingAttempts(failedCount: number | null | undefined): number {
  return Math.max(0, MAX_FAILED_ATTEMPTS - (failedCount ?? 0));
}
