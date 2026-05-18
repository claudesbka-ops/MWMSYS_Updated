-- Migration: Add AI extraction columns to Tbl_Worker_Attachments
-- Run after deployment: npx prisma migrate dev --name add_worker_doc_ai_extraction
-- Or apply manually to existing database

ALTER TABLE "Tbl_Worker_Attachments" 
ADD COLUMN IF NOT EXISTS "Ai_Extraction_Status" VARCHAR(20) NULL,
ADD COLUMN IF NOT EXISTS "Ai_Extracted_Data" JSONB NULL,
ADD COLUMN IF NOT EXISTS "Ai_Confidence_Scores" JSONB NULL,
ADD COLUMN IF NOT EXISTS "Ai_Confidence_Overall" INTEGER NULL,
ADD COLUMN IF NOT EXISTS "Ai_Raw_Response" TEXT NULL,
ADD COLUMN IF NOT EXISTS "Ai_Extraction_Error" TEXT NULL,
ADD COLUMN IF NOT EXISTS "Ai_Extracted_At" TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS "Worker_Confirmed_At" TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS "Worker_Corrected_Data" JSONB NULL;

-- Add comment/documentation for columns
COMMENT ON COLUMN "Tbl_Worker_Attachments"."Ai_Extraction_Status" IS 'AI extraction status: completed, failed, or NULL if not processed';
COMMENT ON COLUMN "Tbl_Worker_Attachments"."Ai_Extracted_Data" IS 'JSON with extracted fields: full_name, document_number, expiry_date, date_of_birth, nationality, issuing_country';
COMMENT ON COLUMN "Tbl_Worker_Attachments"."Ai_Confidence_Scores" IS 'JSON with per-field confidence scores 0-100';
COMMENT ON COLUMN "Tbl_Worker_Attachments"."Ai_Confidence_Overall" IS 'Overall confidence score 0-100 (average of per-field scores)';
COMMENT ON COLUMN "Tbl_Worker_Attachments"."Ai_Raw_Response" IS 'Full raw JSON response from GPT-4o API';
COMMENT ON COLUMN "Tbl_Worker_Attachments"."Ai_Extraction_Error" IS 'Error message if AI extraction failed';
COMMENT ON COLUMN "Tbl_Worker_Attachments"."Ai_Extracted_At" IS 'Timestamp when AI extraction completed';
COMMENT ON COLUMN "Tbl_Worker_Attachments"."Worker_Confirmed_At" IS 'Timestamp when worker confirmed/corrected extracted data';
COMMENT ON COLUMN "Tbl_Worker_Attachments"."Worker_Corrected_Data" IS 'JSON with worker corrections to AI extracted data';

-- Create index for faster queries on extraction status
CREATE INDEX IF NOT EXISTS "IX_Tbl_Worker_Attachments_Ai_Status" 
ON "Tbl_Worker_Attachments"("Ai_Extraction_Status") 
WHERE "Ai_Extraction_Status" IS NOT NULL;
