import OpenAI from "openai";

/**
 * AI-assisted document data extraction using OpenAI Vision (`gpt-4o` by
 * default; override with `OPENAI_MODEL`). The service is deliberately
 * defensive: if the API key is missing, the network call fails, or the
 * model returns un-parseable text, callers get a structured low-confidence
 * result instead of an exception. This keeps the existing upload path
 * working even when AI is unavailable.
 */

export type DocumentType =
  | "passport"
  | "work_permit"
  | "permit"
  | "insurance"
  | "contract"
  | "medical"
  | "demand_letter"
  | string;

export type ExtractedDocumentData = {
  fullName?: string;
  documentNumber?: string;
  expiryDate?: string;
  nationality?: string;
  dateOfBirth?: string;
  confidence: "high" | "medium" | "low";
  rawText?: string;
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
    console.error("[documentAi] failed to create OpenAI client", err);
    return null;
  }
}

function buildPromptForDocType(type: string): string {
  const t = (type ?? "").toString().trim().toLowerCase();
  const base =
    "Extract the following information from this document image. " +
    "Return ONLY a JSON object with these exact fields, no other text, " +
    "no markdown, no commentary. Use null for missing fields.";

  if (t === "passport") {
    return `${base}
{
  "fullName": "full name on document",
  "documentNumber": "passport number",
  "expiryDate": "expiry date in YYYY-MM-DD format",
  "nationality": "nationality/country",
  "dateOfBirth": "date of birth in YYYY-MM-DD format",
  "confidence": "high|medium|low based on image quality"
}`;
  }

  if (t === "work_permit" || t === "permit") {
    return `${base}
{
  "fullName": "full name on permit",
  "documentNumber": "permit number",
  "expiryDate": "expiry date in YYYY-MM-DD format",
  "nationality": "nationality",
  "confidence": "high|medium|low"
}`;
  }

  if (t === "insurance") {
    return `${base}
{
  "documentNumber": "policy number",
  "expiryDate": "expiry/valid until date in YYYY-MM-DD",
  "confidence": "high|medium|low"
}`;
  }

  if (t === "contract") {
    return `${base}
{
  "fullName": "employee name",
  "expiryDate": "contract end date in YYYY-MM-DD",
  "confidence": "high|medium|low"
}`;
  }

  if (t === "medical") {
    return `${base}
{
  "fullName": "patient name",
  "expiryDate": "valid until date in YYYY-MM-DD",
  "confidence": "high|medium|low"
}`;
  }

  return `${base}
{
  "documentNumber": "any ID or reference number",
  "expiryDate": "any expiry date in YYYY-MM-DD format",
  "confidence": "high|medium|low"
}`;
}

function normaliseDate(value: unknown): string | undefined {
  if (value == null) return undefined;
  const raw = value.toString().trim();
  if (!raw || raw.toLowerCase() === "null" || raw === "-") return undefined;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const d = new Date(raw);
  if (Number.isFinite(d.getTime())) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return undefined;
}

function normaliseConfidence(value: unknown): "high" | "medium" | "low" {
  const v = (value ?? "").toString().trim().toLowerCase();
  if (v === "high") return "high";
  if (v === "medium" || v === "med") return "medium";
  return "low";
}

function parseAiResponse(text: string): ExtractedDocumentData {
  const cleaned = (text ?? "").toString().replace(/```json|```/g, "").trim();
  if (!cleaned) {
    return { confidence: "low", rawText: text };
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      fullName:
        typeof parsed.fullName === "string" && parsed.fullName.trim()
          ? parsed.fullName.trim()
          : undefined,
      documentNumber:
        typeof parsed.documentNumber === "string" && parsed.documentNumber.trim()
          ? parsed.documentNumber.trim()
          : undefined,
      expiryDate: normaliseDate(parsed.expiryDate),
      nationality:
        typeof parsed.nationality === "string" && parsed.nationality.trim()
          ? parsed.nationality.trim()
          : undefined,
      dateOfBirth: normaliseDate(parsed.dateOfBirth),
      confidence: normaliseConfidence(parsed.confidence),
      rawText: cleaned,
    };
  } catch {
    return { confidence: "low", rawText: cleaned };
  }
}

/**
 * Extract structured data from a document image. Accepts either a raw
 * base64 string or a complete `data:` URL. Returns a low-confidence
 * placeholder if AI extraction is disabled or fails — callers should
 * always check `confidence` before auto-filling fields.
 */
export async function extractDocumentData(
  imageBase64: string,
  documentType: DocumentType,
  mimeType: string = "image/jpeg"
): Promise<ExtractedDocumentData> {
  const client = getOpenAIClient();
  if (!client) {
    return { confidence: "low", rawText: "AI extraction disabled (OPENAI_API_KEY not set)" };
  }

  const raw = (imageBase64 ?? "").toString();
  if (!raw) {
    return { confidence: "low", rawText: "no image data provided" };
  }

  const dataUrl = raw.startsWith("data:")
    ? raw
    : `data:${mimeType || "image/jpeg"};base64,${raw}`;

  const prompt = buildPromptForDocType(documentType);
  const model = (process.env.OPENAI_MODEL ?? "gpt-4o").toString().trim() || "gpt-4o";

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: prompt },
          ] as any,
        },
      ],
      max_tokens: 500,
    });

    const text = response.choices?.[0]?.message?.content ?? "";
    const flat = Array.isArray(text)
      ? text.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("")
      : text;
    return parseAiResponse(flat as string);
  } catch (err: any) {
    console.error("[documentAi] extraction failed", err?.message ?? err);
    return { confidence: "low", rawText: `extraction error: ${err?.message ?? "unknown"}` };
  }
}
