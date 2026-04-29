/**
 * Server-side validity checklist for an uploaded attestation document.
 *
 * Rules are computed per `documentType` against the AI-extracted fields
 * plus the current worker profile snapshot. Each check returns a label,
 * a `passed` boolean, and a severity (`error` => hard fail, `warning` =>
 * soft fail). Overall verdict:
 *   - `invalid` when any error-severity check fails
 *   - `review`  when any warning-severity check fails
 *   - `valid`   when every check passes
 *
 * Admins see the checklist on the agency review page; workers see it
 * right after upload so they know what to fix.
 */

export type CheckSeverity = "error" | "warning";

export type ValidityCheck = {
  label: string;
  passed: boolean;
  severity: CheckSeverity;
};

export type ValidityReport = {
  verdict: "valid" | "review" | "invalid";
  checks: ValidityCheck[];
};

export type ExtractedFields = {
  name?: string | null;
  documentNumber?: string | null;
  expiryDate?: string | Date | null;
  nationality?: string | null;
  confidence?: string | null;
};

export type WorkerSnapshot = {
  name?: string | null;
  passportNumber?: string | null;
};

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

function normalisedName(value: string | null | undefined): string {
  return (value ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyNameMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalisedName(a);
  const y = normalisedName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return x.includes(y) || y.includes(x);
}

function exactDocNumberMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = (a ?? "").toString().toLowerCase().replace(/\s+/g, "");
  const y = (b ?? "").toString().toLowerCase().replace(/\s+/g, "");
  if (!x || !y) return false;
  return x === y;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function confidenceAtLeastMedium(level: string | null | undefined): boolean {
  const v = (level ?? "").toString().toLowerCase();
  return v === "high" || v === "medium";
}

function aggregate(checks: ValidityCheck[]): ValidityReport["verdict"] {
  if (checks.some((c) => !c.passed && c.severity === "error")) return "invalid";
  if (checks.some((c) => !c.passed && c.severity === "warning")) return "review";
  return "valid";
}

export function evaluateDocument(
  documentType: string | null | undefined,
  extracted: ExtractedFields,
  worker: WorkerSnapshot,
): ValidityReport {
  const t = (documentType ?? "").toString().trim().toLowerCase();
  const now = Date.now();
  const expiry = toDate(extracted.expiryDate);

  const checks: ValidityCheck[] = [];

  if (t === "passport") {
    checks.push({
      label: "Name on document matches account name",
      passed: fuzzyNameMatch(extracted.name, worker.name),
      severity: "error",
    });
    checks.push({
      label: "Passport number matches account passport number",
      passed: exactDocNumberMatch(extracted.documentNumber, worker.passportNumber),
      severity: "error",
    });
    checks.push({
      label: "Passport has not expired",
      passed: !!expiry && expiry.getTime() > now,
      severity: "error",
    });
    checks.push({
      label: "At least 6 months validity remaining",
      passed: !!expiry && expiry.getTime() - now >= SIX_MONTHS_MS,
      severity: "warning",
    });
    checks.push({
      label: "AI confidence is medium or higher",
      passed: confidenceAtLeastMedium(extracted.confidence),
      severity: "warning",
    });
  } else if (t === "permit" || t === "work_permit") {
    checks.push({
      label: "Permit number is readable",
      passed: !!(extracted.documentNumber ?? "").toString().trim(),
      severity: "error",
    });
    checks.push({
      label: "Permit has not expired",
      passed: !!expiry && expiry.getTime() > now,
      severity: "error",
    });
    checks.push({
      label: "AI confidence is medium or higher",
      passed: confidenceAtLeastMedium(extracted.confidence),
      severity: "warning",
    });
  } else if (t === "insurance") {
    checks.push({
      label: "Insurance has not expired",
      passed: !!expiry && expiry.getTime() > now,
      severity: "error",
    });
    checks.push({
      label: "AI confidence is medium or higher",
      passed: confidenceAtLeastMedium(extracted.confidence),
      severity: "warning",
    });
  } else if (t === "contract") {
    checks.push({
      label: "Name on contract matches account name",
      passed: fuzzyNameMatch(extracted.name, worker.name),
      severity: "warning",
    });
    checks.push({
      label: "Contract has not expired",
      passed: !!expiry && expiry.getTime() > now,
      severity: "error",
    });
    checks.push({
      label: "AI confidence is medium or higher",
      passed: confidenceAtLeastMedium(extracted.confidence),
      severity: "warning",
    });
  } else if (t === "medical") {
    checks.push({
      label: "Name on certificate matches account name",
      passed: fuzzyNameMatch(extracted.name, worker.name),
      severity: "warning",
    });
    checks.push({
      label: "Medical certificate has not expired",
      passed: !!expiry && expiry.getTime() > now,
      severity: "error",
    });
    checks.push({
      label: "AI confidence is medium or higher",
      passed: confidenceAtLeastMedium(extracted.confidence),
      severity: "warning",
    });
  } else {
    // demand_letter / unknown
    checks.push({
      label: "AI confidence is medium or higher",
      passed: confidenceAtLeastMedium(extracted.confidence),
      severity: "warning",
    });
  }

  return { verdict: aggregate(checks), checks };
}
