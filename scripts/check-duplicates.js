import { Octokit } from "@octokit/rest";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Read environment variables
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const OWNER = process.env.GITHUB_REPOSITORY.split("/")[0];
const REPO = process.env.GITHUB_REPOSITORY.split("/")[1];
const ISSUE_NUMBER = process.env.ISSUE_NUMBER;
const THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || "0.85");

// Cosine similarity function
function cosineSim(A, B) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < A.length; i++) {
    dot += A[i] * B[i];
    normA += A[i] * A[i];
    normB += B[i] * B[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embedText(text) {
  const model = gemini.getGenerativeModel({ model: "embedding-001" });
  const res = await model.embedContent(text);
  return res.embedding.values;
}

async function run() {
  // Get the new issue
  const { data: newIssue } = await octokit.issues.get({
    owner: OWNER,
    repo: REPO,
    issue_number: ISSUE_NUMBER,
  });

  const newText = `${newIssue.title} ${newIssue.body || ""}`;
  const newEmbedding = await embedText(newText);

  // Fetch all open issues with pagination
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
    const otherEmbedding = await embedText(otherText);
    const similarity = cosineSim(newEmbedding, otherEmbedding);

    if (similarity > THRESHOLD) {
      duplicates.push({ number: issue.number, similarity });
    }
  }

  // Post comment if duplicates found
  if (duplicates.length > 0) {
    let body = "⚠️ This issue looks similar to the following:\n\n";
    duplicates.forEach((d) => {
      body += `- #${d.number} (similarity: ${d.similarity.toFixed(2)})\n`;
    });

    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: ISSUE_NUMBER,
      body,
    });

    // Add optional label
    const existingLabels = newIssue.labels.map((l) => l.name);
    if (!existingLabels.includes("duplicate?")) {
      await octokit.issues.addLabels({
        owner: OWNER,
        repo: REPO,
        issue_number: ISSUE_NUMBER,
        labels: ["duplicate?"],
      });
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});