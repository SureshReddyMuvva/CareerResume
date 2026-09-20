import fs from "fs";
import mammoth from "mammoth";
import { MASTER_DOCX, MASTER_TEXT } from "./fileUtils.js";

export async function saveUploadedResume(file) {
  if (!file) throw new Error("No file uploaded.");

  const originalName = file.originalname || "";
  if (!originalName.toLowerCase().endsWith(".docx")) {
    throw new Error("Please upload a DOCX resume. PDF support can be added later, but DOCX is best for editing.");
  }

  fs.copyFileSync(file.path, MASTER_DOCX);
  fs.unlinkSync(file.path);

  const result = await mammoth.extractRawText({ path: MASTER_DOCX });
  const text = result.value.trim();

  if (!text || text.length < 200) {
    throw new Error("I could not read enough text from this DOCX. Please upload a normal editable Word resume.");
  }

  fs.writeFileSync(MASTER_TEXT, text, "utf8");

  return {
    message: "Master resume uploaded successfully.",
    characters: text.length,
    preview: text.slice(0, 700)
  };
}
