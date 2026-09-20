import fs from "fs";
import PDFDocument from "pdfkit";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
  UnderlineType
} from "docx";

const FONT = "Calibri";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function sectionTitle(text) {
  return new Paragraph({
    children: [new TextRun({ text: String(text).toUpperCase(), bold: true, size: 20, font: FONT })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 120, after: 40 },
    border: { bottom: { color: "999999", space: 1, style: "single", size: 6 } }
  });
}

function bullet(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 19, font: FONT })],
    bullet: { level: 0 },
    spacing: { after: 25 }
  });
}

function line(text, options = {}) {
  return new Paragraph({
    alignment: options.align || AlignmentType.LEFT,
    children: [new TextRun({ text: text || "", size: options.size || 19, bold: options.bold, font: FONT })],
    spacing: { after: options.after ?? 35 }
  });
}

function roleLine(exp) {
  const left = [exp.title, exp.company].filter(Boolean).join(" | ");
  const dates = exp.dates || "";
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: left, bold: true, size: 19, font: FONT }),
      new TextRun({ text: `\t${dates}`, size: 19, font: FONT })
    ],
    spacing: { before: 60, after: 20 }
  });
}

export async function createResumeDocx(resumeData, outputPath) {
  const r = resumeData.resume || resumeData;
  const children = [];

  children.push(line(r.name || "Resume", { align: AlignmentType.CENTER, bold: true, size: 28, after: 10 }));
  children.push(line(r.contact || "", { align: AlignmentType.CENTER, size: 18, after: 60 }));

  if (r.summary) {
    children.push(sectionTitle("Summary"));
    children.push(line(r.summary, { size: 19, after: 40 }));
  }

  if (safeArray(r.skills).length) {
    children.push(sectionTitle("Skills"));
    children.push(line(safeArray(r.skills).join(" • "), { size: 18, after: 40 }));
  }

  if (safeArray(r.experience).length) {
    children.push(sectionTitle("Experience"));
    for (const exp of safeArray(r.experience)) {
      children.push(roleLine(exp));
      safeArray(exp.bullets).slice(0, 4).forEach(b => children.push(bullet(b)));
    }
  }

  if (safeArray(r.projects).length) {
    children.push(sectionTitle("Projects"));
    for (const project of safeArray(r.projects).slice(0, 2)) {
      children.push(line(project.name || "Project", { bold: true, size: 19, after: 15 }));
      safeArray(project.bullets).slice(0, 2).forEach(b => children.push(bullet(b)));
    }
  }

  if (safeArray(r.education).length) {
    children.push(sectionTitle("Education"));
    safeArray(r.education).forEach(e => children.push(line(e, { size: 18, after: 20 })));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 450, right: 450, bottom: 450, left: 450 }
        }
      },
      children
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
}

function drawSection(doc, title) {
  doc.moveDown(0.35);
  doc.font("Helvetica-Bold").fontSize(10).text(String(title).toUpperCase());
  const y = doc.y + 2;
  doc.moveTo(40, y).lineTo(572, y).stroke();
  doc.moveDown(0.35);
}

function drawBullet(doc, text) {
  const left = doc.x;
  const y = doc.y;
  doc.font("Helvetica").fontSize(9).text("•", left, y, { continued: true });
  doc.text(` ${text}`, { width: 505, continued: false });
}

export function createResumePdf(resumeData, outputPath) {
  const r = resumeData.resume || resumeData;
  const doc = new PDFDocument({ size: "LETTER", margins: { top: 36, bottom: 36, left: 40, right: 40 } });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  doc.font("Helvetica-Bold").fontSize(17).text(r.name || "Resume", { align: "center" });
  doc.font("Helvetica").fontSize(8.5).text(r.contact || "", { align: "center" });

  if (r.summary) {
    drawSection(doc, "Summary");
    doc.font("Helvetica").fontSize(9).text(r.summary, { width: 532 });
  }

  if (safeArray(r.skills).length) {
    drawSection(doc, "Skills");
    doc.font("Helvetica").fontSize(8.8).text(safeArray(r.skills).join(" • "), { width: 532 });
  }

  if (safeArray(r.experience).length) {
    drawSection(doc, "Experience");
    for (const exp of safeArray(r.experience)) {
      const left = [exp.title, exp.company].filter(Boolean).join(" | ");
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(9).text(left, 40, y, { width: 380 });
      doc.font("Helvetica").fontSize(9).text(exp.dates || "", 430, y, { width: 142, align: "right" });
      doc.moveDown(0.15);
      safeArray(exp.bullets).slice(0, 4).forEach(b => drawBullet(doc, b));
      doc.moveDown(0.1);
    }
  }

  if (safeArray(r.projects).length) {
    drawSection(doc, "Projects");
    for (const p of safeArray(r.projects).slice(0, 2)) {
      doc.font("Helvetica-Bold").fontSize(9).text(p.name || "Project");
      safeArray(p.bullets).slice(0, 2).forEach(b => drawBullet(doc, b));
    }
  }

  if (safeArray(r.education).length) {
    drawSection(doc, "Education");
    safeArray(r.education).forEach(e => doc.font("Helvetica").fontSize(8.8).text(e));
  }

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}
