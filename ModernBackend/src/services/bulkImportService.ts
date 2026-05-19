import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { encryptLegacyPassword } from "../cryptoLegacy";

export interface CsvWorkerRow {
  full_name: string;
  passport_number: string;
  nationality: string;
  date_of_birth: string;
  employer_id: string;
  phone_number: string;
  email?: string;
  permit_number?: string;
  permit_expiry?: string;
  insurance_expiry?: string;
  job_title?: string;
  department?: string;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ParsedPreview {
  rows: CsvWorkerRow[];
  errors: ValidationError[];
  totalRows: number;
  validRows: number;
}

export interface ImportResult {
  successful: number;
  failed: number;
  errors: Array<{ row: number; reason: string }>;
}

const REQUIRED_COLUMNS = [
  "full_name",
  "passport_number",
  "nationality",
  "date_of_birth",
  "employer_id",
  "phone_number",
];

export function validateAndParseCsv(buffer: Buffer): ParsedPreview {
  const content = buffer.toString("utf-8");
  
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (records.length === 0) {
    return { rows: [], errors: [{ row: 0, field: "file", message: "CSV is empty" }], totalRows: 0, validRows: 0 };
  }

  const headers = Object.keys(records[0]);
  const missingColumns = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  
  if (missingColumns.length > 0) {
    return {
      rows: [],
      errors: [{ row: 0, field: "headers", message: `Missing required columns: ${missingColumns.join(", ")}` }],
      totalRows: 0,
      validRows: 0,
    };
  }

  const rows: CsvWorkerRow[] = [];
  const errors: ValidationError[] = [];

  records.forEach((record: any, index: number) => {
    const rowNum = index + 2; // 1-based with header
    const row: CsvWorkerRow = {
      full_name: record.full_name?.trim() || "",
      passport_number: record.passport_number?.trim() || "",
      nationality: record.nationality?.trim() || "",
      date_of_birth: record.date_of_birth?.trim() || "",
      employer_id: record.employer_id?.trim() || "",
      phone_number: record.phone_number?.trim() || "",
      email: record.email?.trim(),
      permit_number: record.permit_number?.trim(),
      permit_expiry: record.permit_expiry?.trim(),
      insurance_expiry: record.insurance_expiry?.trim(),
      job_title: record.job_title?.trim(),
      department: record.department?.trim(),
    };

    // Validation
    if (!row.full_name || row.full_name.length < 3) {
      errors.push({ row: rowNum, field: "full_name", message: "Full name is required (min 3 characters)" });
    }
    if (!row.passport_number) {
      errors.push({ row: rowNum, field: "passport_number", message: "Passport number is required" });
    }
    if (!row.nationality) {
      errors.push({ row: rowNum, field: "nationality", message: "Nationality is required" });
    }
    if (!row.date_of_birth) {
      errors.push({ row: rowNum, field: "date_of_birth", message: "Date of birth is required (YYYY-MM-DD)" });
    } else {
      const dob = new Date(row.date_of_birth);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      if (isNaN(dob.getTime()) || age < 18) {
        errors.push({ row: rowNum, field: "date_of_birth", message: "Worker must be at least 18 years old" });
      }
    }
    if (!row.employer_id) {
      errors.push({ row: rowNum, field: "employer_id", message: "Employer ID is required" });
    }
    if (row.email && !isValidEmail(row.email)) {
      errors.push({ row: rowNum, field: "email", message: "Invalid email format" });
    }

    rows.push(row);
  });

  const validRows = rows.length - errors.filter((e) => e.row > 0).length;

  return { rows, errors, totalRows: rows.length, validRows };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function validateEmployersExist(rows: CsvWorkerRow[]): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const uniqueEmployerIds = [...new Set(rows.map((r) => r.employer_id).filter(Boolean))];

  for (const employerId of uniqueEmployerIds) {
    const employer = await prisma.tbl_Employer.findFirst({
      where: { User_Id: employerId },
      select: { User_Id: true },
    });
    if (!employer) {
      rows.forEach((row, idx) => {
        if (row.employer_id === employerId) {
          errors.push({ row: idx + 2, field: "employer_id", message: `Employer not found: ${employerId}` });
        }
      });
    }
  }

  return errors;
}

export async function processImport(
  jobId: number,
  rows: CsvWorkerRow[],
  agencyId: string
): Promise<ImportResult> {
  const result: ImportResult = { successful: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      // Check if worker with passport exists
      const existingWorker = await prisma.tbl_Worker_PersonalInfo.findFirst({
        where: { Passport_Number: row.passport_number },
        select: { Worker_Id: true },
      });

      if (existingWorker) {
        // Link existing worker to agency
        await linkWorkerToAgency(existingWorker.Worker_Id, agencyId, row.employer_id);
        result.successful++;
      } else {
        // Create new worker
        await createNewWorker(row, agencyId);
        result.successful++;
      }
    } catch (err: any) {
      result.failed++;
      result.errors.push({ row: rowNum, reason: err.message || "Unknown error" });
    }
  }

  // Update job record
  await prisma.tbl_Import_Jobs.update({
    where: { Id: jobId },
    data: {
      Status: result.failed > 0 ? "done" : "done",
      Successful: result.successful,
      Failed: result.failed,
      Error_Log: result.errors.length > 0 
        ? { errors: result.errors.map(e => ({ row: e.row, reason: e.reason })) } as Prisma.InputJsonValue
        : Prisma.DbNull,
    },
  });

  return result;
}

async function linkWorkerToAgency(workerId: string, agencyId: string, employerId: string) {
  // Update worker employer if provided
  if (employerId) {
    await prisma.tbl_Worker_PersonalInfo.updateMany({
      where: { Worker_Id: workerId },
      data: { Employer_Id: employerId },
    });
  }

  // Create recruit agent link
  await prisma.tbl_Worker_RecruitAgent.upsert({
    where: { Worker_Id: workerId },
    create: {
      Worker_Id: workerId,
      Malaysian_Reqruitment_Agency: agencyId,
      Source_Country_Requirtment_Agency: agencyId,
    },
    update: {
      Malaysian_Reqruitment_Agency: agencyId,
      Source_Country_Requirtment_Agency: agencyId,
    },
  });
}

async function createNewWorker(row: CsvWorkerRow, agencyId: string) {
  const workerId = `W${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  
  // Generate password: first name (before first space) + last 4 digits of passport + "@"
  const firstName = row.full_name.split(" ")[0];
  const passportSuffix = row.passport_number.slice(-4);
  const tempPassword = `${firstName}${passportSuffix}@`;
  const encryptedPassword = encryptLegacyPassword(tempPassword, workerId);

  // Create user account
  await prisma.tbl_User.create({
    data: {
      User_Id: workerId,
      Email_Id: row.email || `${workerId}@mwmsys.local`,
      Login_Pwd: encryptedPassword,
      User_Status: 1,
      User_Role: 2, // Worker role
      User_Name: row.full_name,
      Created_On: new Date(),
    },
  });

  // Create worker personal info
  await prisma.tbl_Worker_PersonalInfo.create({
    data: {
      Worker_Id: workerId,
      Name: row.full_name,
      Passport_Number: row.passport_number,
      Nationality: parseNationality(row.nationality),
      Date_Of_Birth: new Date(row.date_of_birth),
      Email_Id: row.email || null,
      Contact_Number: row.phone_number,
      Employer_Id: row.employer_id,
      Created_On: new Date(),
    },
  });

  // Create permit/insurance info if provided
  if (row.permit_number || row.permit_expiry || row.insurance_expiry) {
    await prisma.tbl_Worker_PermitInsurance.create({
      data: {
        Worker_Id: workerId,
        Insurance_Policy_Number: row.permit_number || null,
        Permit_Expire_Date: row.permit_expiry ? new Date(row.permit_expiry) : null,
        Insurance_Expire_Date: row.insurance_expiry ? new Date(row.insurance_expiry) : null,
        Created_By: agencyId,
        Created_On: new Date(),
      },
    });
  }

  // Link to agency
  await prisma.tbl_Worker_RecruitAgent.create({
    data: {
      Worker_Id: workerId,
      Malaysian_Reqruitment_Agency: agencyId,
      Source_Country_Requirtment_Agency: agencyId,
    },
  });

  // Create link to employer
  await prisma.tbl_Worker_EmployerLink.create({
    data: {
      workerId: workerId,
      employerId: row.employer_id,
      status: "Active",
      createdBy: agencyId,
    },
  });
}

function parseNationality(nationality: string): number | null {
  // Map common nationalities to codes or return null for free text
  const map: Record<string, number> = {
    "malaysian": 1,
    "indonesian": 2,
    "bangladeshi": 3,
    "indian": 4,
    "nepali": 5,
    "myanmar": 6,
    "filipino": 7,
    "thai": 8,
    "vietnamese": 9,
    "cambodian": 10,
  };
  const key = nationality.toLowerCase().trim();
  return map[key] || null;
}

export function generateCsvTemplate(): string {
  const headers = [
    "full_name",
    "passport_number",
    "nationality",
    "date_of_birth",
    "employer_id",
    "phone_number",
    "email",
    "permit_number",
    "permit_expiry",
    "insurance_expiry",
    "job_title",
    "department",
  ];
  
  const example = [
    "Ahmad bin Abdullah",
    "A12345678",
    "Indonesian",
    "1990-05-15",
    "EMP001",
    "+60123456789",
    "ahmad@example.com",
    "WP123456",
    "2025-12-31",
    "2025-12-31",
    "Construction Worker",
    "Site A",
  ];
  
  return [headers.join(","), example.join(",")].join("\n");
}
