import fs from "fs";
import path from "path";
import { fromPath } from "pdf2pic";

/**
 * Convert a file (PDF or image) to base64 encoded image.
 * For PDFs: converts first page to JPEG.
 * For images: reads and encodes directly.
 * 
 * Returns null if conversion fails or file type is unsupported.
 */
export async function convertFileToBase64(
  filePath: string,
  mimeType: string = "application/octet-stream"
): Promise<string | null> {
  try {
    if (!fs.existsSync(filePath)) {
      console.error("[pdfToImage] File not found:", filePath);
      return null;
    }

    const isPdf = mimeType === "application/pdf" || filePath.toLowerCase().endsWith(".pdf");
    const isImage = mimeType.startsWith("image/") || 
      [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".tif"].some(ext => 
        filePath.toLowerCase().endsWith(ext)
      );
    const isWord = mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
      mimeType === "application/msword" ||
      filePath.toLowerCase().endsWith(".docx") || 
      filePath.toLowerCase().endsWith(".doc");

    if (isPdf) {
      return await convertPdfFirstPageToBase64(filePath);
    }

    if (isImage) {
      const buffer = fs.readFileSync(filePath);
      return buffer.toString("base64");
    }

    if (isWord) {
      // Word documents not supported for AI extraction - return special marker
      console.log("[pdfToImage] Word document detected - AI extraction skipped (manual review required)");
      return "__UNSUPPORTED_WORD_DOC__";
    }

    console.error("[pdfToImage] Unsupported file type:", mimeType);
    return "__UNSUPPORTED_TYPE__";
  } catch (err) {
    console.error("[pdfToImage] Conversion failed:", err);
    return null;
  }
}

/**
 * Convert first page of PDF to base64 JPEG using pdf2pic.
 * Returns base64 string without data URL prefix.
 */
async function convertPdfFirstPageToBase64(pdfPath: string): Promise<string | null> {
  try {
    const outputDir = path.dirname(pdfPath);
    const baseName = path.basename(pdfPath, path.extname(pdfPath));
    const outputFileName = `${baseName}_page1.jpg`;
    const outputPath = path.join(outputDir, outputFileName);

    // Clean up any existing temp file
    if (fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    const convert = fromPath(pdfPath, {
      density: 150, // DPI - good balance of quality vs size
      saveFilename: baseName,
      savePath: outputDir,
      format: "jpg",
      width: 1200, // Max width - keeps file size reasonable
      height: 1600, // Max height
      quality: 85, // JPEG quality
    });

    // Convert only first page (page 1)
    await convert(1);

    // pdf2pic saves with pattern: {saveFilename}-1.jpg or {saveFilename}.1.jpg depending on version
    const possiblePaths = [
      outputPath,
      path.join(outputDir, `${baseName}-1.jpg`),
      path.join(outputDir, `${baseName}.1.jpg`),
      path.join(outputDir, `${baseName}_1.jpg`),
    ];

    let imagePath: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        imagePath = p;
        break;
      }
    }

    if (!imagePath) {
      // Try to find any jpg file created in the directory
      const files = fs.readdirSync(outputDir);
      const matchingFile = files.find(f => 
        f.startsWith(baseName) && f.endsWith(".jpg")
      );
      if (matchingFile) {
        imagePath = path.join(outputDir, matchingFile);
      }
    }

    if (!imagePath || !fs.existsSync(imagePath)) {
      console.error("[pdfToImage] Converted image not found for:", pdfPath);
      return null;
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString("base64");

    // Clean up temporary image file
    try {
      fs.unlinkSync(imagePath);
    } catch {
      // Ignore cleanup errors
    }

    return base64;
  } catch (err) {
    console.error("[pdfToImage] PDF conversion failed:", err);
    return null;
  }
}

/**
 * Get MIME type from file extension for common document types.
 */
export function getMimeTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
  };
  return mimeTypes[ext] || "application/octet-stream";
}
