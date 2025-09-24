import { Octokit } from "@octokit/rest";
import fetch from "node-fetch";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_REPOSITORY.split("/")[0];
const REPO = process.env.GITHUB_REPOSITORY.split("/")[1];
const ISSUE_NUMBER = Number(process.env.ISSUE_NUMBER);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const THRESHOLD_DUPLICATE = parseFloat(process.env.SIMILARITY_THRESHOLD || "0.85");
const THRESHOLD_LOOKS_LIKE = 0.5;

// Simple cosine similarity using char codes
function cosineSim(A, B) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < A.length; i++) {
    dot += A[i] * B[i];
    normA += A[i] * A[i];
    normB += B[i] * B[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Get Gemini embedding for text
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
        contents: [{ parts: [{ text }] }]
      }),
    }
  );
  const data = await response.json();
  return data.candidates?.[0]?.content || "";
}

async function run() {
  console.log(`\n=== Checking issue #${ISSUE_NUMBER} for duplicates ===`);

  // Fetch the new issue
  const { data: newIssue } = await octokit.issues.get({
    owner: OWNER,
    repo: REPO,
    issue_number: ISSUE_NUMBER
  });

  const newText = `${newIssue.title} ${newIssue.body || ""}`;
  console.log("Fetching embedding for new issue...");
  const newRepresentation = await getGeminiRepresentation(newText);
  console.log("Fetched embedding for new issue.\n");

  // Fetch all open issues
  let allIssues = [];
  let page = 1;
  while (true) {
    const { data: issues } = await octokit.issues.listForRepo({
      owner: OWNER,
      repo: REPO,
      state: "open",
      per_page: 100,
      page
    });
    if (issues.length === 0) break;
    allIssues = allIssues.concat(issues);
    page++;
  }
  console.log(`Total issues to compare: ${allIssues.length}\n`);

  let duplicates = [];
  let looksLike = [];

  // Compare each issue sequentially
  for (const issue of allIssues) {
    if (issue.number === ISSUE_NUMBER) continue;

    console.log(`Fetching embedding for issue #${issue.number}...`);
    const otherRepresentation = await getGeminiRepresentation(`${issue.title} ${issue.body || ""}`);
    console.log(`Fetched embedding for #${issue.number}`);

    const sim = cosineSim(
      Array.from(newRepresentation).map(c => c.charCodeAt(0)),
      Array.from(otherRepresentation).map(c => c.charCodeAt(0))
    );

    console.log(`Similarity with #${issue.number}: ${sim.toFixed(2)}`);

    if (sim >= THRESHOLD_DUPLICATE) duplicates.push({ number: issue.number, similarity: sim });
    else if (sim >= THRESHOLD_LOOKS_LIKE) looksLike.push({ number: issue.number, similarity: sim });
  }

  console.log(`\nFound ${duplicates.length} duplicates and ${looksLike.length} looks-like issues.`);

  // Build comment
  let commentBody = '';
  if (duplicates.length > 0) {
    commentBody += '⚠️ This issue is a **duplicate** of the following:\n';
    duplicates.forEach(d => { commentBody += `- #${d.number} (similarity: ${d.similarity.toFixed(2)})\n`; });
  }
  if (looksLike.length > 0) {
    commentBody += '\n⚠️ This issue **looks like** the following:\n';
    looksLike.forEach(d => { commentBody += `- #${d.number} (similarity: ${d.similarity.toFixed(2)})\n`; });
  }

  // Temporary debug: always post comment to see results in Actions
  commentBody = commentBody || `Debug: ${duplicates.length} duplicates, ${looksLike.length} looks-like issues`;

  if (commentBody) {
    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: ISSUE_NUMBER,
      body: commentBody
    });
    console.log("Comment posted on the issue.\n");
  }
}

run().catch(err => console.error(err));