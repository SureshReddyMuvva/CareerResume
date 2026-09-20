import { useState } from "react";

const API = `http://${window.location.hostname}:5000/api`;

function App() {
  const [originalResume, setOriginalResume] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [tailoredResumeText, setTailoredResumeText] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");


  async function generateResume() {
    setError("");
    setResult(null);


    if (!originalResume) {
      setError("Please upload your original DOCX resume.");
      return;
    }


    if (!companyName.trim()) {
      setError("Please enter the company name.");
      return;
    }


    if (!tailoredResumeText.trim()) {
      setError("Please paste your tailored resume.");
      return;
    }


    try {
      setLoading(true);


      const formData = new FormData();

      formData.append(
        "originalResume",
        originalResume
      );

      formData.append(
        "companyName",
        companyName
      );

      formData.append(
        "tailoredResumeText",
        tailoredResumeText
      );


      const response = await fetch(
        `${API}/generate`,
        {
          method: "POST",
          body: formData
        }
      );


      const data = await response.json();


      if (!response.ok) {
        throw new Error(
          data.error ||
          "Resume generation failed."
        );
      }


      setResult(data);

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);

    }
  }


  return (
    <main className="page">

      {/* =========================
          HERO
      ========================== */}

      <section className="hero">

        <div>

          <p className="eyebrow">
            Resume Formatter
          </p>

          <h1>
            Create your formatted
            resume faster.
          </h1>

          <p className="subtext">
            Upload your original DOCX resume,
            paste your tailored resume content,
            and generate a new Word and PDF
            using the original resume format.
          </p>

        </div>


        <div className="glow-card">

          <span>
            Original DOCX Format
          </span>

          <span>
            New Tailored Content
          </span>

          <span>
            Word + PDF
          </span>

        </div>

      </section>


      {/* =========================
          ERROR
      ========================== */}

      {error && (
        <div className="error">
          {error}
        </div>
      )}


      {/* =========================
          MAIN FORM
      ========================== */}

      <section className="grid">


        {/* ORIGINAL RESUME */}

        <div className="panel">

          <h2>
            1. Original Resume
          </h2>

          <p className="hint">
            Upload the DOCX resume whose
            formatting you want to keep.
          </p>


          <input
            type="file"
            accept=".docx"
            onChange={(e) => {

              const file =
                e.target.files?.[0] || null;

              setOriginalResume(file);

              setResult(null);
              setError("");

            }}
          />


          {originalResume && (

            <div className="success">

              <b>Selected:</b>{" "}
              {originalResume.name}

            </div>

          )}

        </div>


        {/* COMPANY */}

        <div className="panel">

          <h2>
            2. Company
          </h2>


          <label>
            Company Name
          </label>


          <input
            className="text-input"
            type="text"
            placeholder="Example: Google"
            value={companyName}
            onChange={(e) =>
              setCompanyName(
                e.target.value
              )
            }
          />

        </div>


        {/* TAILORED RESUME */}

        <div className="panel">

          <h2>
            3. Tailored Resume
          </h2>


          <p className="hint">
            Paste the complete tailored
            resume content here.
          </p>


          <textarea
            placeholder="Paste your complete tailored resume here..."
            value={tailoredResumeText}
            onChange={(e) =>
              setTailoredResumeText(
                e.target.value
              )
            }
          />

        </div>


        {/* GENERATE */}

        <div className="panel">

          <h2>
            4. Generate
          </h2>


          <p className="hint">
            The uploaded DOCX will be used
            as the formatting reference.
          </p>


          <button
            className="primary"
            onClick={generateResume}
            disabled={loading}
          >

            {loading
              ? "Creating Resume..."
              : "Generate Resume"}

          </button>

        </div>

      </section>


      {/* =========================
          RESULT
      ========================== */}

      {result && (

        <section className="result-panel">


          <div className="result-head">


            <div>

              <p className="eyebrow">
                Resume Ready
              </p>


              <h2>
                {result.companyName}
              </h2>


              <p>
                Your new resume was created
                using the formatting from{" "}
                <b>
                  {result.originalFileName}
                </b>
              </p>

            </div>


            <div className="download-actions">


              {result.downloads?.docx && (

                <a
                  href={
                    result.downloads.docx
                  }
                >
                  Download Word
                </a>

              )}


              {result.downloads?.pdf ? (

                <a
                  href={
                    result.downloads.pdf
                  }
                >
                  Download PDF
                </a>

              ) : (

                <span className="pdf-warning">
                  PDF not created
                </span>

              )}

            </div>

          </div>


          {result.pdfWarning && (

            <div className="error">

              PDF Warning:{" "}
              {result.pdfWarning}

            </div>

          )}


          <p className="filename">

            Word:{" "}
            {result.fileNames?.docx ||
              "Not created"}

            <br />

            PDF:{" "}
            {result.fileNames?.pdf ||
              "Not created"}

          </p>

        </section>

      )}

    </main>
  );
}

export default App;