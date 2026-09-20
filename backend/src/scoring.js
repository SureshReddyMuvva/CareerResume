const GENERIC_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "by", "for", "from",
  "has", "have", "had", "in", "into", "is", "it", "its", "of", "on", "or",
  "our", "that", "the", "their", "this", "to", "with", "will", "you", "your",
  "we", "who", "what", "when", "where", "why", "how", "both", "all", "any",
  "can", "may", "must", "should", "job", "role", "team", "company"
]);

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/node\.js/g, "nodejs")
    .replace(/back-end/g, "backend")
    .replace(/front-end/g, "frontend")
    .replace(/restful/g, "rest")
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsPhrase(text, phrase) {
  const resume = normalize(text);
  const term = normalize(phrase);

  if (!term || term.length < 2) return false;

  const exact = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");

  if (exact.test(resume)) return true;

  return resume.includes(term);
}

function importantTokens(text) {
  return normalize(text)
    .split(" ")
    .map((x) => x.trim())
    .filter((x) => x.length >= 3)
    .filter((x) => !GENERIC_STOP_WORDS.has(x));
}

function getRequirementWeight(requirement) {
  const priority = String(requirement.priority || "").toLowerCase();
  const weight = Number(requirement.weight || 0);

  if (weight > 0) return weight;

  if (priority === "critical") return 5;
  if (priority === "high") return 4;
  if (priority === "medium") return 2;
  return 1;
}

function requirementMatchLevel(resumeText, requirement) {
  const term = requirement.term || "";
  const variants = Array.isArray(requirement.variants)
    ? requirement.variants
    : [];

  const allTerms = [term, ...variants]
    .map(normalize)
    .filter(Boolean)
    .filter((x) => !GENERIC_STOP_WORDS.has(x));

  for (const phrase of allTerms) {
    if (containsPhrase(resumeText, phrase)) {
      return 1;
    }
  }

  const tokens = importantTokens(term);

  if (tokens.length >= 2) {
    const resume = normalize(resumeText);
    const foundCount = tokens.filter((token) => resume.includes(token)).length;
    const ratio = foundCount / tokens.length;

    if (ratio >= 0.8) return 0.75;
    if (ratio >= 0.5) return 0.45;
  }

  return 0;
}

function scoreLabel(score) {
  if (score >= 90) return "Excellent ATS match";
  if (score >= 80) return "Strong ATS match";
  if (score >= 70) return "Good ATS match";
  if (score >= 60) return "Medium ATS match";
  return "Weak ATS match";
}

export function calculateMatchScore(resumeText, jdAnalysis) {
  const requirements = Array.isArray(jdAnalysis?.requirements)
    ? jdAnalysis.requirements
    : [];

  const cleanRequirements = requirements.filter((req) => {
    const term = normalize(req.term || "");

    if (!term || term.length < 3) return false;
    if (GENERIC_STOP_WORDS.has(term)) return false;

    return true;
  });

  if (!cleanRequirements.length) {
    return {
      score: 0,
      label: "No JD requirements found",
      matchedKeywords: [],
      missingKeywords: [],
      matchedRequirements: [],
      missingRequirements: [],
      criticalMissing: []
    };
  }

  let totalWeight = 0;
  let matchedWeight = 0;

  const matchedRequirements = [];
  const missingRequirements = [];
  const criticalMissing = [];

  for (const req of cleanRequirements) {
    const weight = getRequirementWeight(req);
    const matchLevel = requirementMatchLevel(resumeText, req);
    const earned = weight * matchLevel;

    totalWeight += weight;
    matchedWeight += earned;

    if (matchLevel >= 0.75) {
      matchedRequirements.push({
        term: req.term,
        category: req.category,
        priority: req.priority,
        matchLevel
      });
    } else {
      missingRequirements.push({
        term: req.term,
        category: req.category,
        priority: req.priority,
        matchLevel
      });

      if (["critical", "high"].includes(String(req.priority || "").toLowerCase())) {
        criticalMissing.push(req.term);
      }
    }
  }

  const score = Math.round((matchedWeight / totalWeight) * 100);

  return {
    score,
    label: scoreLabel(score),
    matchedKeywords: matchedRequirements.map((x) => x.term).slice(0, 20),
    missingKeywords: missingRequirements.map((x) => x.term).slice(0, 20),
    matchedRequirements,
    missingRequirements,
    criticalMissing
  };
}