import OpenAI from "openai";

/**
 * AI-assisted document data extraction for worker documents using OpenAI GPT-4o.
 * Based on documentAiService.ts pattern but with per-field confidence scores (0-100).
 * 
 * This service is deliberately defensive: if the API key is missing, the network
 * call fails, or the model returns un-parseable text, callers get a structured
 * result with success=false instead of an exception. This keeps the upload path
 * working even when AI is unavailable.
 */

export type WorkerDocumentType =
  | "passport"
  | "work_permit"
  | "permit"
  | "insurance"
  | "contract"
  | "medical"
  | "demand_letter"
  | string;

export type ConfidenceScores = {
  full_name?: number;
  document_number?: number;
  expiry_date?: number;
  date_of_birth?: number;
  nationality?: number;
  issuing_country?: number;
};

export type ExtractedWorkerDocumentData = {
  full_name?: string;
  document_number?: string;
  expiry_date?: string;
  date_of_birth?: string;
  nationality?: string;
  issuing_country?: string;
  confidence_scores: ConfidenceScores;
  overall_confidence: number; // 0-100
  raw_response?: string;
};

export type WorkerDocumentExtractionResult =
  | {
      success: true;
      data: ExtractedWorkerDocumentData;
      confidenceScores: ConfidenceScores;
      overallConfidence: number;
      rawResponse: string;
      error?: undefined;
    }
  | {
      success: false;
      data?: undefined;
      confidenceScores?: undefined;
      overallConfidence?: undefined;
      rawResponse?: string;
      error: string;
    };

let cachedClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  const key = (process.env.OPENAI_API_KEY ?? "").toString().trim();
  if (!key) return null;
  if (cachedClient) return cachedClient;
  try {
    cachedClient = new OpenAI({ apiKey: key });
    return cachedClient;
  } catch (err) {
    console.error("[workerDocumentAi] failed to create OpenAI client", err);
    return null;
  }
}

function buildPromptForDocType(type: string): string {
  const t = (type ?? "").toString().trim().toLowerCase();
  const base =
    "You are an expert OCR system for document data extraction. " +
    "Analyze this document image carefully, even if quality is low, blurry, or text is faint. " +
    "Look for Machine Readable Zone (MRZ) at the bottom - it contains reliable data even when other text is unclear. " +
    "Return ONLY a JSON object with these exact fields, no other text, no markdown, no commentary. " +
    "Use null for missing fields. Include confidence_score (0-100) for each extracted field based on clarity.";

  if (t === "passport") {
    return `${base}

For Pakistani/ICAO passports, extract from VISUAL ZONE first, MRZ second:
1. FULL NAME: Read from visual zone (e.g., "Surname GivenNames" format). MRZ Line 1 also has it after P<XXX
2. DOCUMENT NUMBER: Read from top of passport visual zone - it's clearly printed. Common format: BU8020002 (8 chars). In MRZ Line 2, it's variable length followed by <
3. EXPIRY DATE: Look for "Date of Expiry" in visual zone (e.g., "13 JAN 2036"). For MRZ: positions 22-27 are YYMMDD. If YY < 50, add 2000 (e.g., 36 = 2036). If YY >= 50, add 1900.
4. DATE OF BIRTH: Look for "Date of Birth" in visual zone. MRZ positions 14-19 (YYMMDD).
5. NATIONALITY: Three-letter code from MRZ Line 2 positions 11-13 (e.g., PAK)
6. ISSUING COUNTRY: Same as nationality

CRITICAL - Document Number Extraction:
- Read from the TOP of the passport page where it says "Passport No." or similar
- Do NOT include check digits or trailing filler characters
- Example visual: BU8020002
- In MRZ: BU8020002< (the < marks the end, do NOT include it)

CRITICAL - Date Century Calculation:
- MRZ uses 2-digit year (YY)
- If YY < 50: year = 2000 + YY (e.g., 36 = 2036 for expiry)
- If YY >= 50: year = 1900 + YY (e.g., 03 = 2003 for birth year)

Example Pakistani passport:
- Visual zone: Passport No. BU8020002, Date of Expiry: 13 JAN 2036
- MRZ Line 2: BU8020002<PAK0305129M360113...
- Document Number: BU8020002 (from visual zone, NOT BU80200023)
- Expiry: 360113 = 2036-01-13 (36 < 50, so 2000+36=2036)
- Birth: 030512 = 2003-05-12 (03 < 50, so 2000+03=2003)

{
  "full_name": "full name from visual zone, surname first",
  "document_number": "passport number from visual zone top of page",
  "expiry_date": "expiry YYYY-MM-DD, prefer visual zone 'Date of Expiry'",
  "date_of_birth": "birth date YYYY-MM-DD, prefer visual zone 'Date of Birth'",
  "nationality": "nationality code",
  "issuing_country": "issuing country",
  "confidence_scores": {
    "full_name": 0-100,
    "document_number": 0-100,
    "expiry_date": 0-100,
    "date_of_birth": 0-100,
    "nationality": 0-100,
    "issuing_country": 0-100
  }
}`;
  }

  if (t === "work_permit" || t === "permit") {
    return `${base}
{
  "full_name": "full name on permit",
  "document_number": "permit number",
  "expiry_date": "expiry date in YYYY-MM-DD format",
  "nationality": "nationality",
  "issuing_country": "country that issued the permit",
  "confidence_scores": {
    "full_name": 0-100,
    "document_number": 0-100,
    "expiry_date": 0-100,
    "nationality": 0-100,
    "issuing_country": 0-100
  }
}`;
  }

  if (t === "insurance") {
    return `${base}
{
  "full_name": "policy holder name",
  "document_number": "policy number",
  "expiry_date": "expiry/valid until date in YYYY-MM-DD",
  "nationality": "nationality if shown",
  "confidence_scores": {
    "full_name": 0-100,
    "document_number": 0-100,
    "expiry_date": 0-100,
    "nationality": 0-100
  }
}`;
  }

  if (t === "contract") {
    return `${base}
{
  "full_name": "employee name",
  "document_number": "contract reference number if any",
  "expiry_date": "contract end date in YYYY-MM-DD",
  "nationality": "nationality if shown",
  "confidence_scores": {
    "full_name": 0-100,
    "document_number": 0-100,
    "expiry_date": 0-100,
    "nationality": 0-100
  }
}`;
  }

  if (t === "medical") {
    return `${base}
{
  "full_name": "patient name",
  "document_number": "medical record number if any",
  "expiry_date": "valid until date in YYYY-MM-DD",
  "nationality": "nationality if shown",
  "confidence_scores": {
    "full_name": 0-100,
    "document_number": 0-100,
    "expiry_date": 0-100,
    "nationality": 0-100
  }
}`;
  }

  if (t === "demand_letter") {
    return `${base}
{
  "full_name": "employee name",
  "document_number": "reference number if any",
  "expiry_date": "deadline date in YYYY-MM-DD if shown",
  "nationality": "nationality if shown",
  "confidence_scores": {
    "full_name": 0-100,
    "document_number": 0-100,
    "expiry_date": 0-100,
    "nationality": 0-100
  }
}`;
  }

  return `${base}
{
  "full_name": "person name if shown",
  "document_number": "any ID or reference number",
  "expiry_date": "any expiry date in YYYY-MM-DD format",
  "date_of_birth": "date of birth in YYYY-MM-DD format if shown",
  "nationality": "nationality if shown",
  "issuing_country": "issuing country if shown",
  "confidence_scores": {
    "full_name": 0-100,
    "document_number": 0-100,
    "expiry_date": 0-100,
    "date_of_birth": 0-100,
    "nationality": 0-100,
    "issuing_country": 0-100
  }
}`;
}

function normaliseName(value: unknown): string | undefined {
  if (value == null) return undefined;
  const raw = value.toString().trim();
  if (!raw || raw.toLowerCase() === "null" || raw === "-") return undefined;
  
  // Clean up MRZ-style names (<< separators become spaces)
  let cleaned = raw.replace(/<<+/g, " ").replace(/</g, " ");
  
  // Normalize multiple spaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  // Handle common MRZ artifacts
  cleaned = cleaned.replace(/\s*,\s*/g, ", "); // Fix comma spacing
  
  return cleaned || undefined;
}

function normaliseDate(value: unknown): string | undefined {
  if (value == null) return undefined;
  const raw = value.toString().trim();
  if (!raw || raw.toLowerCase() === "null" || raw === "-") return undefined;

  // Already ISO format
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // MRZ format: YYMMDD (6 digits)
  const mrzMatch = raw.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (mrzMatch) {
    let yy = parseInt(mrzMatch[1], 10);
    const mm = mrzMatch[2];
    const dd = mrzMatch[3];
    
    // MRZ century rule: YY < 50 = 20xx, YY >= 50 = 19xx
    const year = yy < 50 ? 2000 + yy : 1900 + yy;
    return `${year}-${mm}-${dd}`;
  }

  // Try standard date parsing as fallback
  const d = new Date(raw);
  if (Number.isFinite(d.getTime())) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return undefined;
}

function normaliseConfidenceScore(value: unknown): number {
  if (value == null) return 0;
  const n = Number(value);
  if (Number.isFinite(n)) {
    return Math.max(0, Math.min(100, Math.round(n)));
  }
  return 0;
}

/**
 * Parse MRZ (Machine Readable Zone) lines from passport
 * Returns structured data with proper field extraction
 */
function parseMRZ(mrzLine1: string, mrzLine2: string): ExtractedWorkerDocumentData | null {
  try {
    // Clean up MRZ lines
    const line1 = mrzLine1.replace(/\s+/g, "").trim().toUpperCase();
    const line2 = mrzLine2.replace(/\s+/g, "").trim().toUpperCase();
    
    if (line1.length < 44 || line2.length < 44) {
      return null;
    }
    
    // Line 1: P<XXX[NAME]...
    // Skip "P<" and country code (3 chars) to get name
    const nameStart = 5; // P< + 3 char country code
    const namePart = line1.substring(nameStart);
    const nameEnd = namePart.indexOf("<<");
    const surname = nameEnd > 0 ? namePart.substring(0, nameEnd).replace(/</g, " ") : "";
    const givenNames = nameEnd > 0 ? namePart.substring(nameEnd + 2).replace(/</g, " ").trim() : "";
    const fullName = `${surname} ${givenNames}`.trim().replace(/\s+/g, " ");
    
    // Line 2 parsing with proper field boundaries
    // Format: DOC_NUM<CHK>NATION<CHK>DOB<CHK>SEX<CHK>EXP<CHK>PERSONAL<CHK><<FINAL
    
    // Find document number (variable length, ends at first <)
    let docNumEnd = line2.indexOf("<");
    if (docNumEnd < 0) docNumEnd = 9;
    const documentNumber = line2.substring(0, docNumEnd).trim();
    
    // Nationality at positions 10-13 (after doc num check digit)
    const nationality = line2.substring(10, 13);
    
    // Date of Birth at positions 13-19 (YYMMDD)
    const dobRaw = line2.substring(13, 19);
    const dobYear = parseInt(dobRaw.substring(0, 2), 10);
    const dobFullYear = dobYear < 50 ? 2000 + dobYear : 1900 + dobYear;
    const dob = `${dobFullYear}-${dobRaw.substring(2, 4)}-${dobRaw.substring(4, 6)}`;
    
    // Sex at position 20
    // const sex = line2.substring(20, 21);
    
    // Expiry at positions 21-27 (YYMMDD) - THIS is what we want
    const expRaw = line2.substring(21, 27);
    const expYear = parseInt(expRaw.substring(0, 2), 10);
    const expFullYear = expYear < 50 ? 2000 + expYear : 1900 + expYear;
    const expiry = `${expFullYear}-${expRaw.substring(2, 4)}-${expRaw.substring(4, 6)}`;
    
    return {
      full_name: fullName || undefined,
      document_number: documentNumber || undefined,
      expiry_date: expiry,
      date_of_birth: dob,
      nationality: nationality || undefined,
      issuing_country: nationality || undefined,
      confidence_scores: {
        full_name: fullName ? 90 : 0,
        document_number: documentNumber ? 95 : 0,
        expiry_date: 95,
        date_of_birth: 95,
        nationality: nationality ? 98 : 0,
        issuing_country: nationality ? 98 : 0,
      },
      overall_confidence: 95,
    };
  } catch (err) {
    console.error("[MRZ Parser] Failed to parse:", err);
    return null;
  }
}

/**
 * Extract MRZ lines from raw OCR text using pattern matching
 */
function extractMRZFromText(text: string): { line1: string; line2: string } | null {
  // Look for MRZ pattern: lines starting with P< followed by 44 characters
  const lines = text.split(/\r?\n/);
  
  for (let i = 0; i < lines.length - 1; i++) {
    const line1 = lines[i].trim().toUpperCase();
    const line2 = lines[i + 1].trim().toUpperCase();
    
    // MRZ Line 1 starts with P< (passport) or similar travel document codes
    if (line1.match(/^P<\w{3}/) && line1.length >= 44 && line2.length >= 44) {
      return { line1, line2 };
    }
  }
  
  // Try to find concatenated MRZ (no line breaks)
  const mrzMatch = text.match(/P<\w{3}.{40,}\w{9}/);
  if (mrzMatch) {
    const fullMrz = mrzMatch[0].replace(/\s/g, "");
    if (fullMrz.length >= 88) {
      return {
        line1: fullMrz.substring(0, 44),
        line2: fullMrz.substring(44, 88),
      };
    }
  }
  
  return null;
}

function parseWorkerAiResponse(text: string): WorkerDocumentExtractionResult {
  const cleaned = (text ?? "").toString().replace(/```json|```/g, "").trim();
  if (!cleaned) {
    return { success: false, error: "Empty AI response", rawResponse: text };
  }

  try {
    const parsed = JSON.parse(cleaned);
    const scores: ConfidenceScores = {
      full_name: normaliseConfidenceScore(parsed.confidence_scores?.full_name),
      document_number: normaliseConfidenceScore(parsed.confidence_scores?.document_number),
      expiry_date: normaliseConfidenceScore(parsed.confidence_scores?.expiry_date),
      date_of_birth: normaliseConfidenceScore(parsed.confidence_scores?.date_of_birth),
      nationality: normaliseConfidenceScore(parsed.confidence_scores?.nationality),
      issuing_country: normaliseConfidenceScore(parsed.confidence_scores?.issuing_country),
    };

    // Calculate overall confidence as average of present scores
    const presentScores = Object.values(scores).filter((s): s is number => s !== undefined && s > 0);
    const overallConfidence = presentScores.length > 0
      ? Math.round(presentScores.reduce((a, b) => a + b, 0) / presentScores.length)
      : 0;

    const data: ExtractedWorkerDocumentData = {
      full_name: normaliseName(parsed.full_name),
      document_number:
        typeof parsed.document_number === "string" && parsed.document_number.trim()
          ? parsed.document_number.trim()
          : undefined,
      expiry_date: normaliseDate(parsed.expiry_date),
      date_of_birth: normaliseDate(parsed.date_of_birth),
      nationality:
        typeof parsed.nationality === "string" && parsed.nationality.trim()
          ? parsed.nationality.trim()
          : undefined,
      issuing_country:
        typeof parsed.issuing_country === "string" && parsed.issuing_country.trim()
          ? parsed.issuing_country.trim()
          : undefined,
      confidence_scores: scores,
      overall_confidence: overallConfidence,
      raw_response: cleaned,
    };

    return {
      success: true,
      data,
      confidenceScores: scores,
      overallConfidence,
      rawResponse: cleaned,
    };
  } catch (e) {
    return { success: false, error: `Failed to parse AI response: ${(e as Error).message}`, rawResponse: cleaned };
  }
}

/**
 * HYBRID EXTRACTION: First extract raw text/MRZ with AI, then parse MRZ programmatically
 * This is much more accurate than pure AI extraction for structured MRZ data.
 * 
 * For passports: AI extracts raw MRZ text → Code parses MRZ with proper logic
 * For other docs: AI extracts structured JSON directly
 */
export async function extractWorkerDocumentData(
  imageBase64: string,
  documentType: WorkerDocumentType,
  mimeType: string = "image/jpeg"
): Promise<WorkerDocumentExtractionResult> {
  const client = getOpenAIClient();
  if (!client) {
    return { success: false, error: "AI extraction disabled (OPENAI_API_KEY not set)" };
  }

  const raw = (imageBase64 ?? "").toString();
  if (!raw) {
    return { success: false, error: "No image data provided" };
  }

  const dataUrl = raw.startsWith("data:")
    ? raw
    : `data:${mimeType || "image/jpeg"};base64,${raw}`;

  const isPassport = (documentType ?? "").toString().trim().toLowerCase() === "passport";
  
  // For passports: Use MRZ-first strategy
  if (isPassport) {
    return extractPassportWithMRZ(client, dataUrl);
  }
  
  // For other documents: Use standard JSON extraction
  return extractGenericDocument(client, dataUrl, documentType);
}

/**
 * Extract passport data using hybrid MRZ approach
 * 1. AI extracts raw text with MRZ lines
 * 2. Code parses MRZ with perfect accuracy
 */
async function extractPassportWithMRZ(
  client: OpenAI,
  dataUrl: string
): Promise<WorkerDocumentExtractionResult> {
  const mrzPrompt = `You are an OCR engine. Read this passport image and output ONLY the Machine Readable Zone (MRZ) lines at the bottom.

The MRZ consists of:
- Line 1: Starting with P< followed by country code and name (44 characters)
- Line 2: Document number, nationality, dates, personal number (44 characters)

Output EXACTLY these two lines, no other text:
P<XXX[NAME FIELD - 39 characters]
[DOCUMENT DATA LINE - 44 characters]

If MRZ is not readable, output "MRZ NOT READABLE".`;

  try {
    const response = await client.chat.completions.create({
      model: (process.env.OPENAI_MODEL ?? "gpt-4o").toString().trim() || "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            { type: "text", text: mrzPrompt },
          ] as any,
        },
      ],
      max_tokens: 200,
      temperature: 0,
    });

    const text = response.choices?.[0]?.message?.content ?? "";
    
    // Try to extract and parse MRZ
    const mrzLines = extractMRZFromText(text);
    if (mrzLines) {
      const parsed = parseMRZ(mrzLines.line1, mrzLines.line2);
      if (parsed) {
        return {
          success: true,
          data: parsed,
          confidenceScores: parsed.confidence_scores,
          overallConfidence: parsed.overall_confidence,
          rawResponse: text,
        };
      }
    }
    
    // MRZ parsing failed - fall back to visual zone extraction
    return extractPassportVisual(client, dataUrl, text);
    
  } catch (err: any) {
    console.error("[MRZ Extraction] failed:", err?.message ?? err);
    return { success: false, error: `MRZ extraction error: ${err?.message ?? "unknown"}` };
  }
}

/**
 * Fallback: Extract passport data from visual zone when MRZ fails
 */
async function extractPassportVisual(
  client: OpenAI,
  dataUrl: string,
  mrzAttempt: string
): Promise<WorkerDocumentExtractionResult> {
  const visualPrompt = `Extract passport data from the visual inspection zone (the main readable area, NOT the MRZ at bottom).

Look for these fields and return ONLY JSON:
- full_name: Name as printed (e.g., "JABBAR JAVED HUSSAIN")
- document_number: Passport number from top of page (e.g., "BU8020002")
- expiry_date: Date of Expiry in YYYY-MM-DD format
- date_of_birth: Date of Birth in YYYY-MM-DD format  
- nationality: Country name or code
- issuing_country: Issuing country

Return JSON with confidence_scores (0-100) for each field.

{
  "full_name": "...",
  "document_number": "...",
  "expiry_date": "YYYY-MM-DD",
  "date_of_birth": "YYYY-MM-DD",
  "nationality": "...",
  "issuing_country": "...",
  "confidence_scores": {
    "full_name": 0-100,
    "document_number": 0-100,
    "expiry_date": 0-100,
    "date_of_birth": 0-100,
    "nationality": 0-100,
    "issuing_country": 0-100
  }
}`;

  try {
    const response = await client.chat.completions.create({
      model: (process.env.OPENAI_MODEL ?? "gpt-4o").toString().trim() || "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            { type: "text", text: visualPrompt },
          ] as any,
        },
      ],
      max_tokens: 500,
      temperature: 0.1,
    });

    const text = response.choices?.[0]?.message?.content ?? "";
    return parseWorkerAiResponse(text);
    
  } catch (err: any) {
    return { 
      success: false, 
      error: `Visual extraction error: ${err?.message ?? "unknown"}`,
      rawResponse: mrzAttempt,
    };
  }
}

/**
 * Generic document extraction for non-passport documents
 */
async function extractGenericDocument(
  client: OpenAI,
  dataUrl: string,
  documentType: WorkerDocumentType,
): Promise<WorkerDocumentExtractionResult> {
  const prompt = buildPromptForDocType(documentType);
  
  try {
    const response = await client.chat.completions.create({
      model: (process.env.OPENAI_MODEL ?? "gpt-4o").toString().trim() || "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            { type: "text", text: prompt },
          ] as any,
        },
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    const text = response.choices?.[0]?.message?.content ?? "";
    const flat = Array.isArray(text)
      ? text.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("")
      : text;
    return parseWorkerAiResponse(flat as string);
  } catch (err: any) {
    console.error("[workerDocumentAi] extraction failed", err?.message ?? err);
    return { success: false, error: `Extraction error: ${err?.message ?? "unknown"}` };
  }
}
