import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { jsonrepair } from "jsonrepair";

function extractJson(text) {
  let raw = String(text || "").trim();

  raw = raw
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(raw);
  } catch (_) {
    // continue
  }

  const match = raw.match(/\{[\s\S]*\}/);
  const jsonText = match ? match[0] : raw;

  try {
    return JSON.parse(jsonText);
  } catch (_) {
    // continue
  }

  try {
    const repaired = jsonrepair(jsonText);
    return JSON.parse(repaired);
  } catch (error) {
    console.error("Broken AI JSON:", jsonText);
    throw new Error(
      "AI returned broken JSON. The backend tried to repair it but could not. Please generate again."
    );
  }
}

function createAIClient() {
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();

  if (provider === "grok") {
    if (!process.env.XAI_API_KEY) {
      throw new Error("XAI_API_KEY is missing. Add your Groq key in backend/.env first.");
    }

    return {
      provider,
      model: process.env.XAI_MODEL || "llama-3.3-70b-versatile",
      client: new OpenAI({
        apiKey: process.env.XAI_API_KEY,
        baseURL: process.env.XAI_BASE_URL || "https://api.groq.com/openai/v1"
      })
    };
  }

  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is missing. Add your OpenAI key in backend/.env first.");
    }

    return {
      provider,
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      client: new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      })
    };
  }

  if (provider === "claude") {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is missing. Add your Claude key in backend/.env first.");
    }

    return {
      provider,
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      client: new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      })
    };
  }

  if (provider === "gemini") {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing. Add your Gemini key in backend/.env first.");
    }

    return {
      provider,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      client: new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
      })
    };
  }

  throw new Error("Invalid AI_PROVIDER. Use 'grok', 'openai', 'claude', or 'gemini'.");
}

async function callAI({ client, provider, model, systemPrompt, userPrompt }) {
  if (provider === "claude") {
    const response = await client.messages.create({
      model,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt
        }
      ]
    });

    return response.content
      .map((item) => item.text || "")
      .join("\n")
      .trim();
  }

  if (provider === "gemini") {
    const response = await client.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 4000
      }
    });

    return response.text;
  }

  const response = await client.responses.create({
    model,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    store: false
  });

  return response.output_text;
}

export async function tailorResumeWithAI({
  masterResumeText,
  jobDescription,
  companyName,
  masterLines
}) {
  const { client, provider, model } = createAIClient();

  const systemPrompt = `
You are an expert US resume tailoring and ATS optimization assistant.

Your task is to tailor the supplied master resume specifically for the supplied job description.

MAIN GOAL:
Produce one strong tailored resume in the FIRST response.
Target a genuine ATS alignment of 93-100 against the important requirements of the job.

TAILORING DEPTH:
Decide dynamically how much of the resume needs to change.

If the resume already matches the JD strongly:
- change only the lines that need improvement.

If the resume partially matches:
- rewrite as many summary, skills, and experience lines as necessary.

If the resume is substantially different from the JD:
- you may rewrite most editable resume content.

Do not change lines merely for the sake of changing them.

JOB DESCRIPTION ANALYSIS:
Ignore:
- equal opportunity statements
- diversity statements
- disability/accommodation language
- privacy policies
- benefits
- legal notices
- application instructions
- generic company marketing
- generic company mission text

Extract only meaningful hiring requirements from:
- responsibilities
- required skills
- preferred skills
- technologies
- tools
- programming languages
- frameworks
- databases
- cloud platforms
- DevOps/infrastructure
- architecture expectations
- technical qualifications

Extract enough distinct meaningful ATS requirements to represent the actual job.

Do not use a fixed skill list.
Do not force a fixed number of requirements.
Do not return only one broad requirement.

Each requirement must come from the CURRENT pasted job description.

The requirements should represent the real hiring needs of this specific role, including the most important skills, technologies, responsibilities, platforms, and qualifications.

Combine closely related requirements when that makes sense.
Ignore boilerplate and unrelated job-posting text.

RESUME TAILORING:

You may rewrite:
- professional summary
- all technical skills lines
- any professional experience bullet

You decide how many lines need to change.

SUMMARY:
Rewrite the summary when needed so it aligns with the target role.

TECHNICAL SKILLS:
You may:
- reorder skills
- replace less relevant skills
- add important missing JD skills
- remove skills that are less useful for the target role
- use exact JD terminology when useful

Do not dump every keyword from the JD.

EXPERIENCE:
You may rewrite complete experience bullets when needed.

Emphasize the experience most relevant to the JD.

You may replace a weak or irrelevant bullet with a stronger JD-aligned bullet when appropriate.

Do not change:
- candidate name
- contact information
- company names
- job titles
- employment dates
- locations
- education
- section headings

MISSING SKILLS:
If the JD contains important technical skills missing from the resume, you may add the most valuable ones where appropriate.

Prefer adding standalone technologies and tools to Technical Skills.

Do not add every missing term simply for keyword stuffing.

Do not invent:
- a different employer
- a different job title
- fake dates
- fake degree
- fake certification
- fake project
- fake numerical achievement

ATS OPTIMIZATION:
Use the extracted JD requirements as a checklist.

Before returning the final JSON:
- review every extracted requirement
- make sure each critical requirement is represented in the tailored resume when possible
- make sure nearly all high-priority requirements are represented
- use exact JD terminology naturally when appropriate
- if an important requirement is missing from the resume, add it to the most appropriate editable line
- prefer Technical Skills for standalone technologies/tools
- prefer Summary for role-level capabilities
- prefer Experience bullets for responsibilities and applied work
- remove or replace less relevant resume content when space is needed

The goal is not just to identify requirements.
The goal is to make the final tailored resume actually contain enough of those requirements to reach a 93-100 ATS match.

Do not return the JSON until you have checked the tailored lines against the extracted requirements.

FORMAT:
Preserve the existing resume structure and layout.
Keep the result concise and one-page friendly.
Editable lines may become shorter or longer when necessary.

LINE EDITING:
You receive the original resume as numbered lines.

Return only lines that should change.
Use the exact original lineNumber.

There is no required minimum or maximum number of edits.

OUTPUT:
IMPORTANT FINAL CHECK:

After creating lineEdits, mentally apply those edits to the resume.

Compare the resulting tailored resume against every requirement you extracted.

If important requirements are still missing, revise the lineEdits before returning.

Use as many editable lines as needed to create a strong match.

Do not stop after a few edits if the resume still does not strongly represent the JD.

The final tailored resume should target 93-100 ATS alignment.
Return valid JSON only.
No markdown.
No explanation outside JSON.

JSON schema:
{
  "jdAnalysis": {
    "detectedJobTitle": "string",
    "roleCategory": "string",
    "requirements": [
      {
        "term": "important JD requirement",
        "category": "technical_skill | tool | responsibility | qualification | domain",
        "priority": "critical | high | medium",
        "weight": 1,
        "variants": ["close wording or ATS variants"],
        "evidenceFromJD": "short evidence from the JD"
      }
    ]
  },
  "detectedJobTitle": "string",
  "roleCategory": "string",
  "lineEdits": [
    {
      "lineNumber": 1,
      "newText": "complete replacement text for that line"
    }
  ],
  "changeNotes": ["short description of important tailoring changes"]
}
`.trim();

  const numberedLines = masterLines
    .map((line, index) => `${index + 1}. ${line}`)
    .join("\n");

  const userPrompt = `
COMPANY:
${companyName}

MASTER RESUME:
${masterResumeText}

NUMBERED MASTER RESUME LINES:
${numberedLines}

FULL JOB DESCRIPTION:
${jobDescription}

Tailor this resume specifically for this job.

First:
- identify the actual important job requirements
- ignore legal, EEO, benefits, privacy, accommodation, and generic company text

Then:
- compare the JD with the resume
- decide how much of the resume needs to change
- tailor only a few lines if that is enough
- tailor many or most editable lines if necessary

You may rewrite:
- summary
- technical skills
- experience bullets

You may add important missing technical skills from the JD where appropriate.

You may remove or replace less relevant resume content when space is needed for more important JD-aligned content.

Use exact JD terminology naturally where it improves ATS alignment.

Keep unchanged:
- name
- contact
- employers
- job titles
- dates
- locations
- education
- section structure

Target a highly tailored professional resume with ATS alignment as close as possible to 93-100.

Return valid JSON only.
`.trim();

  const aiText = await callAI({
    client,
    provider,
    model,
    systemPrompt,
    userPrompt
  });

  const result = extractJson(aiText);

if (
  !result.jdAnalysis ||
  !Array.isArray(result.jdAnalysis.requirements) ||
  result.jdAnalysis.requirements.length < 5
) {
  throw new Error(
    "AI did not extract enough meaningful requirements from this job description."
  );
}

  if (!Array.isArray(result.lineEdits)) {
    result.lineEdits = [];
  }

  if (!Array.isArray(result.changeNotes)) {
    result.changeNotes = [];
  }

  return result;
}