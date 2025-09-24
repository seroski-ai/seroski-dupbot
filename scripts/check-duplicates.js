import { Octokit } from "@octokit/rest";
import fetch from "node-fetch";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_REPOSITORY.split("/")[0];
const REPO = process.env.GITHUB_REPOSITORY.split("/")[1];
const ISSUE_NUMBER = Number(process.env.ISSUE_NUMBER);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const THRESHOLD_DUPLICATE = parseFloat(process.env.SIMILARITY_THRESHOLD || "0.85");
const THRESHOLD_LOOKS_LIKE = parseFloat(process.env.THRESHOLD_LOOKS_LIKE || "0.5");

// Cosine similarity for numeric arrays with safety checks
function cosineSim(vecA, vecB) {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;

  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

// Get Gemini numeric embeddings with fallback
async function getGeminiEmbedding(text) {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/textembedding-gecko-001:embedText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({ input: text }),
      }
    );
    const data = await response.json();

    if (!data.embedding || !Array.isArray(data.embedding)) {
      console.warn("Warning: embedding missing, using zero vector fallback.");
      return Array(512).fill(0); // fallback zero vector
    }

    return data.embedding;
  } catch (err) {
    console.warn("Error fetching embedding:", err);
    return Array(512).fill(0); // fallback zero vector
  }
}

async function run() {
  console.log(`\n=== Checking issue #${ISSUE_NUMBER} for duplicates ===`);

  // Fetch the new issue
  const { data: newIssue } = await octokit.issues.get({
    owner: OWNER,
    repo: REPO,
    issue_number: ISSUE_NUMBER,
  });

  const newText = `${newIssue.title} ${newIssue.body || ""}`;
  console.log("Fetching embedding for new issue...");
  const newEmbedding = await getGeminiEmbedding(newText);
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
      page,
    });
    if (issues.length === 0) break;
    allIssues = allIssues.concat(issues);
    page++;
  }
  console.log(`Total issues to compare: ${allIssues.length}\n`);

  const duplicates = [];
  const looksLike = [];

  for (const issue of allIssues) {
    if (issue.number === ISSUE_NUMBER) continue;

    console.log(`Fetching embedding for issue #${issue.number}...`);
    const otherEmbedding = await getGeminiEmbedding(`${issue.title} ${issue.body || ""}`);
    console.log(`Fetched embedding for #${issue.number}`);

    const sim = cosineSim(newEmbedding, otherEmbedding);
    console.log(`Similarity with #${issue.number}: ${sim.toFixed(2)}`);

    if (sim >= THRESHOLD_DUPLICATE) duplicates.push({ number: issue.number, similarity: sim });
    else if (sim >= THRESHOLD_LOOKS_LIKE) looksLike.push({ number: issue.number, similarity: sim });
  }

  console.log(`\nFound ${duplicates.length} duplicates and ${looksLike.length} looks-like issues.`);

  // Build comment
  let commentBody = '';
  if (duplicates.length > 0) {
    commentBody += '⚠️ This issue is a **duplicate** of the following:\n';
    duplicates.forEach(d => {
      commentBody += `- #${d.number} (similarity: ${d.similarity.toFixed(2)})\n`;
    });
  }
  if (looksLike.length > 0) {
    commentBody += '\n⚠️ This issue **looks like** the following:\n';
    looksLike.forEach(d => {
      commentBody += `- #${d.number} (similarity: ${d.similarity.toFixed(2)})\n`;
    });
  }

  commentBody = commentBody || `Debug: ${duplicates.length} duplicates, ${looksLike.length} looks-like issues`;

  if (commentBody) {
    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: ISSUE_NUMBER,
      body: commentBody,
    });
    console.log("Comment posted on the issue.\n");
  }
}

run().catch(err => console.error(err));