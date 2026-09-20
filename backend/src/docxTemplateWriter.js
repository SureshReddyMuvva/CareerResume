import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFile, execFileSync } from "child_process";

/*
=========================================================
RUN PYTHON
=========================================================
*/

function runPython(args) {
  const pythonCommand =
    process.env.PYTHON_PATH || "py";

  /*
    IMPORTANT:

    Resolve docx_writer.py relative to THIS FILE,
    not relative to wherever npm was started.
  */

  const currentFile =
    fileURLToPath(import.meta.url);

  const currentDir =
    path.dirname(currentFile);

  const scriptPath =
    path.join(
      currentDir,
      "docx_writer.py"
    );

  console.log(
    "===================================="
  );

  console.log(
    "USING DOCX WRITER:"
  );

  console.log(
    scriptPath
  );

  console.log(
    "===================================="
  );


  if (!fs.existsSync(scriptPath)) {
    throw new Error(
      `docx_writer.py was not found at: ${scriptPath}`
    );
  }


  let result;


  if (pythonCommand === "py") {

    result = execFileSync(
      "py",
      [
        "-3",
        scriptPath,
        ...args
      ],
      {
        encoding: "utf8"
      }
    );

  } else {

    result = execFileSync(
      pythonCommand,
      [
        scriptPath,
        ...args
      ],
      {
        encoding: "utf8"
      }
    );

  }


  if (result?.trim()) {

    console.log(
      "PYTHON OUTPUT:"
    );

    console.log(
      result.trim()
    );

  }


  return result;
}


/*
=========================================================
EXTRACT MASTER RESUME LINES
=========================================================
*/

export function extractDocxVisibleLines(docxPath) {
  const tempJsonPath = path.join(
    path.dirname(docxPath),
    `extract-lines-${Date.now()}.json`
  );

  try {
    runPython([
      "extract",
      path.resolve(docxPath),
      tempJsonPath
    ]);

    const result = JSON.parse(
      fs.readFileSync(
        tempJsonPath,
        "utf8"
      )
    );

    return Array.isArray(result.lines)
      ? result.lines
      : [];

  } catch (error) {

    const stderr = error.stderr
      ? error.stderr.toString()
      : "";

    const stdout = error.stdout
      ? error.stdout.toString()
      : "";

    throw new Error(
      `DOCX line extraction failed. ${
        stderr ||
        stdout ||
        error.message
      }`
    );

  } finally {

    if (fs.existsSync(tempJsonPath)) {
      fs.unlinkSync(tempJsonPath);
    }
  }
}


/*
=========================================================
CREATE NEW DOCX USING MASTER RESUME FORMAT
=========================================================
*/

export function createDocxFromMasterLines(
  masterDocxPath,
  tailoredResumeText,
  outputPath
) {
  const tempJsonPath = path.join(
    path.dirname(outputPath),
    `docx-input-${Date.now()}.json`
  );

  const payload = {
    masterDocxPath:
      path.resolve(masterDocxPath),

    outputPath:
      path.resolve(outputPath),

    tailoredResumeText:
      String(tailoredResumeText || "")
  };

  fs.writeFileSync(
    tempJsonPath,
    JSON.stringify(
      payload,
      null,
      2
    ),
    "utf8"
  );

  try {
    runPython([
      "write",
      tempJsonPath
    ]);

  } catch (error) {
    const stderr = error.stderr
      ? error.stderr.toString()
      : "";

    const stdout = error.stdout
      ? error.stdout.toString()
      : "";

    throw new Error(
      `DOCX writing failed. ${
        stderr ||
        stdout ||
        error.message
      }`
    );

  } finally {
    if (fs.existsSync(tempJsonPath)) {
      fs.unlinkSync(tempJsonPath);
    }
  }
}


/*
=========================================================
CONVERT DOCX TO PDF
=========================================================
*/

export function convertDocxToPdf(
  docxPath,
  pdfPath
) {
  return new Promise((resolve, reject) => {

    const sourceDocx =
      path.resolve(docxPath);

    const finalPdf =
      path.resolve(pdfPath);

    if (!fs.existsSync(sourceDocx)) {
      reject(
        new Error(
          `DOCX file does not exist: ${sourceDocx}`
        )
      );
      return;
    }

    /*
    =====================================================
    POWERSHELL SCRIPT
    =====================================================

    Uses installed Microsoft Word to open the generated
    DOCX and export it directly to PDF.

    wdExportFormatPDF = 17
    =====================================================
    */

    const escapePowerShellPath = (value) =>
      String(value).replace(/'/g, "''");

    const safeDocx =
      escapePowerShellPath(sourceDocx);

    const safePdf =
      escapePowerShellPath(finalPdf);

    const powerShellScript = `
$ErrorActionPreference = "Stop"

$word = $null
$document = $null

try {

    $word = New-Object -ComObject Word.Application

    $word.Visible = $false
    $word.DisplayAlerts = 0

    $docxPath = '${safeDocx}'
    $pdfPath = '${safePdf}'

    $document = $word.Documents.Open(
        $docxPath,
        $false,
        $true
    )

    $document.ExportAsFixedFormat(
        $pdfPath,
        17
    )

}
finally {

    if ($document -ne $null) {
        $document.Close($false)
    }

    if ($word -ne $null) {
        $word.Quit()
    }

    if ($document -ne $null) {
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject(
            $document
        ) | Out-Null
    }

    if ($word -ne $null) {
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject(
            $word
        ) | Out-Null
    }

    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
`;

    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        powerShellScript
      ],
      {
        windowsHide: true
      },
      (error, stdout, stderr) => {

        if (error) {

          reject(
            new Error(
              `Microsoft Word PDF conversion failed: ${
                stderr ||
                stdout ||
                error.message
              }`
            )
          );

          return;
        }

        console.log("====================================");
console.log("PDF CONVERSION METHOD: MICROSOFT WORD");
console.log("DOCX:", sourceDocx);
console.log("PDF:", finalPdf);
console.log("====================================");
        if (!fs.existsSync(finalPdf)) {

          reject(
            new Error(
              "Microsoft Word finished, but the PDF file was not created."
            )
          );

          return;
        }

        resolve({
          stdout,
          method: "Microsoft Word"
        });
      }
    );
  });
}