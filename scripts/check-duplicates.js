// File: scripts/check-duplicates.js
import { Octokit } from "@octokit/rest";
import fetch from "node-fetch";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_REPOSITORY.split("/")[0];
const REPO = process.env.GITHUB_REPOSITORY.split("/")[1];
const ISSUE_NUMBER = process.env.ISSUE_NUMBER;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || "0.85");

function cosineSim(A, B) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < A.length; i++) {
    dot += A[i] * B[i];
    normA += A[i] * A[i];
    normB += B[i] * B[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Get semantic representation using Gemini generateContent
async function getGeminiRepresentation(text) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          { parts: [{ text }] }
        ]
      }),
    }
  );
  const data = await response.json();
  return data.candidates?.[0]?.content || "";
}

async function run() {
  const { data: newIssue } = await octokit.issues.get({
    owner: OWNER,
    repo: REPO,
    issue_number: ISSUE_NUMBER,
  });

  const newText = `${newIssue.title} ${newIssue.body || ""}`;
  const newRepresentation = await getGeminiRepresentation(newText);

  let allIssues = [];
  let page = 1;
  while (true) {
    const { data: issues } = await octokit.issues.listForRepo({
      owner: OWNER,
      repo: REPO,
      state: "open",
      per_page: 100,
      page,
    });
    if (issues.length === 0) break;
    allIssues = allIssues.concat(issues);
    page++;
  }

  let duplicates = [];
  for (const issue of allIssues) {
    if (issue.number === ISSUE_NUMBER) continue;
    const otherText = `${issue.title} ${issue.body || ""}`;
    const otherRepresentation = await getGeminiRepresentation(otherText);

    // Convert string to char vector for simple similarity
    const sim = cosineSim(
      Array.from(newRepresentation).map(c => c.charCodeAt(0)),
      Array.from(otherRepresentation).map(c => c.charCodeAt(0))
    );

    if (sim > THRESHOLD) duplicates.push({ number: issue.number, similarity: sim });
  }

  if (duplicates.length > 0) {
    let body = "⚠️ This issue looks similar to the following:\n\n";
    duplicates.forEach(d => { body += `- #${d.number} (similarity: ${d.similarity.toFixed(2)})\n`; });

    await octokit.issues.createComment({ owner: OWNER, repo: REPO, issue_number: ISSUE_NUMBER, body });

    const existingLabels = newIssue.labels.map(l => l.name);
    if (!existingLabels.includes("duplicate?")) {
      await octokit.issues.addLabels({ owner: OWNER, repo: REPO, issue_number: ISSUE_NUMBER, labels: ["duplicate?"] });
    }
  }
}

run().catch(err => { console.error(err); process.exit(1); });