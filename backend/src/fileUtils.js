import fs from "fs";
import path from "path";

export const ROOT = process.cwd();
export const UPLOAD_DIR = path.join(ROOT, "uploads");
export const GENERATED_DIR = path.join(ROOT, "generated");
export const MASTER_DOCX = path.join(UPLOAD_DIR, "master_resume.docx");
export const MASTER_TEXT = path.join(UPLOAD_DIR, "master_resume.txt");

export function ensureFolders() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

export function sanitizeFilePart(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

export function readMasterResumeText() {
  if (!fs.existsSync(MASTER_TEXT)) {
    throw new Error("Master resume not found. Upload your DOCX resume first.");
  }
  return fs.readFileSync(MASTER_TEXT, "utf8");
}
