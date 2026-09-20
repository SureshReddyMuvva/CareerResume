import "dotenv/config";

import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";

import {
  ensureFolders,
  GENERATED_DIR,
  sanitizeFilePart,
  UPLOAD_DIR
} from "./src/fileUtils.js";

import {
  createDocxFromMasterLines,
  convertDocxToPdf
} from "./src/docxTemplateWriter.js";


ensureFolders();

const app = express();
const port = process.env.PORT || 5000;

const upload = multer({
  dest: UPLOAD_DIR
});


app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://192.168.1.221:5173"
    ]
  })
);

app.use(
  express.json({
    limit: "10mb"
  })
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/api/health",
  (_req, res) => {

    res.json({
      ok: true,
      message:
        "Resume Formatter backend is running."
    });

  }
);


/* =========================================================
   GET CANDIDATE NAME FROM PASTED RESUME
========================================================= */

function extractCandidateName(
  tailoredResumeText
) {

  const lines =
    String(tailoredResumeText || "")
      .replace(/\r/g, "")
      .split("\n")
      .map(line =>
        line
          .replace(/^#+\s*/, "")
          .replace(/\*\*/g, "")
          .trim()
      )
      .filter(Boolean);


  if (!lines.length) {
    return "Resume";
  }


  /*
    First meaningful line of the pasted resume
    should normally be the candidate name.
  */

  let name = lines[0];


  /*
    Prevent obvious section headings from
    becoming the filename.
  */

  const headings = [
    "SUMMARY",
    "PROFESSIONAL SUMMARY",
    "PROFESSIONAL EXPERIENCE",
    "EXPERIENCE",
    "EDUCATION",
    "TECHNICAL SKILLS",
    "SKILLS"
  ];


  if (
    headings.includes(
      name.toUpperCase()
    )
  ) {
    return "Resume";
  }


  /*
    Keep filename reasonably short.
  */

  if (name.length > 80) {
    return "Resume";
  }


  return name;
}


/* =========================================================
   GENERATE RESUME
========================================================= */

app.post(
  "/api/generate",
  upload.single("originalResume"),

  async (req, res) => {

    let uploadedFilePath = null;


    try {

      /* =====================================================
         ORIGINAL DOCX
      ===================================================== */

      if (!req.file) {

        return res.status(400).json({
          error:
            "Please upload the original DOCX resume."
        });

      }


      uploadedFilePath =
        req.file.path;


      const originalFileName =
        req.file.originalname || "";


      if (
        path
          .extname(originalFileName)
          .toLowerCase() !== ".docx"
      ) {

        return res.status(400).json({
          error:
            "Original resume must be a DOCX file."
        });

      }


      /* =====================================================
         COMPANY
      ===================================================== */

      const companyName =
        String(
          req.body.companyName || ""
        ).trim();


      if (!companyName) {

        return res.status(400).json({
          error:
            "Company name is required."
        });

      }


      /* =====================================================
         FINAL TAILORED RESUME CONTENT
      ===================================================== */

      const tailoredResumeText =
        String(
          req.body.tailoredResumeText || ""
        )
          .replace(/\r/g, "")
          .trim();


      if (
        tailoredResumeText.length < 100
      ) {

        return res.status(400).json({
          error:
            "Paste the complete tailored resume."
        });

      }


      /*
        IMPORTANT:

        The uploaded DOCX is ONLY the formatting reference.

        The pasted tailoredResumeText is the COMPLETE
        FINAL RESUME CONTENT.

        We do NOT:
        - compare old and new bullets
        - match old skill counts
        - preserve old resume text
        - calculate fixed paragraph positions
        - merge old content into new content
      */


      /* =====================================================
         FILE NAME
      ===================================================== */

      const candidateName =
        extractCandidateName(
          tailoredResumeText
        );


      const safeCandidate =
        sanitizeFilePart(
          candidateName
        );


      const safeCompany =
        sanitizeFilePart(
          companyName
        );


      const baseFile =
        sanitizeFilePart(
          `${safeCandidate}_${safeCompany}`
        );


      const docxFile =
        `${baseFile}.docx`;


      const pdfFile =
        `${baseFile}.pdf`;


      const docxPath =
        path.join(
          GENERATED_DIR,
          docxFile
        );


      const pdfPath =
        path.join(
          GENERATED_DIR,
          pdfFile
        );


      /* =====================================================
         CREATE WORD DOCUMENT
      ===================================================== */

      /*
        We are passing the COMPLETE pasted resume text
        directly to the Python writer.

        docx_writer.py will be changed next so it dynamically
        creates exactly the number of headings, experience
        bullets, skill lines, education lines, projects, etc.
        contained in this text.
      */

// Always remove old generated files first.
if (fs.existsSync(docxPath)) {
  fs.unlinkSync(docxPath);
}

if (fs.existsSync(pdfPath)) {
  fs.unlinkSync(pdfPath);
}

      createDocxFromMasterLines(
        uploadedFilePath,
        tailoredResumeText,
        docxPath
      );


      /* =====================================================
         CREATE PDF
      ===================================================== */

      let pdfCreated = false;
      let pdfWarning = null;


      try {

        await convertDocxToPdf(
          docxPath,
          pdfPath
        );

        pdfCreated = true;

      } catch (pdfError) {

        console.warn(
          "PDF conversion failed:",
          pdfError.message
        );


        pdfWarning =
          pdfError.message;

      }


      /* =====================================================
         RESPONSE
      ===================================================== */

      const downloadVersion = Date.now();
      res.json({

        success: true,

        companyName,

        candidateName,

        originalFileName,

        message:
          "Resume formatted successfully.",

        pdfCreated,

        pdfWarning,

        downloads: {

          docx:
  `http://localhost:${port}/api/download/${encodeURIComponent(docxFile)}?v=${downloadVersion}`,

pdf:
  pdfCreated
    ? `http://localhost:${port}/api/download/${encodeURIComponent(pdfFile)}?v=${downloadVersion}`
    : null

        },

        fileNames: {

          docx:
            docxFile,

          pdf:
            pdfCreated
              ? pdfFile
              : null

        }

      });


    } catch (error) {

      console.error(error);


      res.status(500).json({

        error:
          error.message ||
          "Something went wrong while generating the resume."

      });


    } finally {

      /* =====================================================
         DELETE TEMP UPLOAD
      ===================================================== */

      if (
        uploadedFilePath &&
        fs.existsSync(
          uploadedFilePath
        )
      ) {

        try {

          fs.unlinkSync(
            uploadedFilePath
          );

        } catch {

          // Ignore temporary file cleanup errors.

        }

      }

    }

  }
);


/* =========================================================
   DOWNLOAD
========================================================= */

app.get(
  "/api/download/:filename",
  (req, res) => {

    const filename =
      req.params.filename;

    const safeName =
      path.basename(filename);

    const filePath =
      path.join(
        GENERATED_DIR,
        safeName
      );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: "File not found."
      });
    }

    // IMPORTANT:
    // Never let the browser reuse an older resume.
    res.set({
      "Cache-Control":
        "no-store, no-cache, must-revalidate, proxy-revalidate",

      "Pragma":
        "no-cache",

      "Expires":
        "0",

      "Surrogate-Control":
        "no-store"
    });

    res.download(
      filePath,
      safeName
    );
  }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
  port,

  () => {

    console.log(
      `Resume Formatter backend running at http://localhost:${port}`
    );

  }
);