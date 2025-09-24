import { Octokit } from "@octokit/rest";
import fetch from "node-fetch";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_REPOSITORY.split("/")[0];
const REPO = process.env.GITHUB_REPOSITORY.split("/")[1];
const ISSUE_NUMBER = Number(process.env.ISSUE_NUMBER);
const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || "0.85");

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const indexName = process.env.PINECONE_INDEX;
let vectorStore;

async function initVectorStore() {
  // Gemini embedding wrapper
  const embeddings = {
    embedQuery: async (text) => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            model: "models/text-embedding-004",
            content: { parts: [{ text: text }] }
          }),
        }
      );
      const data = await response.json();
      
      if (data.error) {
        console.error("Gemini API Error:", data.error);
        return Array(1024).fill(0.01); // Match index dimension
      }
      
      if (!data.embedding || !data.embedding.values) {
        console.error("Invalid embedding response:", data);
        return Array(1024).fill(0.01); // Match index dimension
      }
      
      // Pad or truncate to match Pinecone index dimension (1024)
      let embedding = data.embedding.values;
      if (embedding.length < 1024) {
        // Pad with zeros if too short
        embedding = [...embedding, ...Array(1024 - embedding.length).fill(0)];
      } else if (embedding.length > 1024) {
        // Truncate if too long
        embedding = embedding.slice(0, 1024);
      }
      
      return embedding;
    },
    embedDocuments: async (documents) => {
      const embeddings = [];
      for (const doc of documents) {
        // Call the embedQuery function directly instead of using 'this'
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
              model: "models/text-embedding-004",
              content: { parts: [{ text: doc }] }
            }),
          }
        );
        const data = await response.json();
        
        let embedding;
        if (data.error || !data.embedding || !data.embedding.values) {
          embedding = Array(1024).fill(0.01);
        } else {
          embedding = data.embedding.values;
          // Pad or truncate to match Pinecone index dimension (1024)
          if (embedding.length < 1024) {
            embedding = [...embedding, ...Array(1024 - embedding.length).fill(0)];
          } else if (embedding.length > 1024) {
            embedding = embedding.slice(0, 1024);
          }
        }
        embeddings.push(embedding);
      }
      return embeddings;
    }
  };

  vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: pinecone.Index(indexName),
    textKey: "content",
  });
}

function cosineSim(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return magA && magB ? dot / (magA * magB) : 0;
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
  console.log(`Issue text: ${newText.substring(0, 100)}...`);

  await initVectorStore();

  console.log("Querying Pinecone for similar issues...");
  const results = await vectorStore.similaritySearch(newText, 5); // top 5 similar issues
  
  console.log(`Found ${results.length} potential matches`);

  const duplicates = results
    .filter(r => r.score >= SIMILARITY_THRESHOLD)
    .map(r => ({ 
      number: r.metadata.issue_number, 
      similarity: r.score,
      title: r.metadata.title || 'Unknown'
    }));

  console.log(`Found ${duplicates.length} duplicates above threshold (${SIMILARITY_THRESHOLD})`);

  // Comment based on duplicate findings
  let commentBody = '';
  let shouldAddToVector = true;

  if (duplicates.length > 0) {
    // Similar issues found - don't add to Pinecone
    shouldAddToVector = false;
    commentBody = `🚨 **Potential Duplicate Issues Detected** 🚨\n\n`;
    commentBody += `This issue appears to be similar to the following existing issue(s):\n\n`;
    
    duplicates.forEach(dup => {
      const similarityPercent = (dup.similarity * 100).toFixed(1);
      commentBody += `- Issue #${dup.number} (${similarityPercent}% similar)\n`;
    });
    
    commentBody += `\nPlease check if your issue is already covered by the above issue(s). If your issue is different, please provide more specific details to help us distinguish it.\n\n`;
    commentBody += `*This comment was generated automatically by Seroski-DupBot 🤖*`;
    
    console.log(`⚠️  Duplicate detected! Will NOT add issue #${ISSUE_NUMBER} to vector store.`);
  } else {
    // No similar issues found - safe to add to Pinecone
    shouldAddToVector = true;
    commentBody = `✅ **No Duplicate Issues Found** ✅\n\n`;
    commentBody += `This appears to be a unique issue. Thank you for your contribution!\n\n`;
    commentBody += `*This comment was generated automatically by Seroski-DupBot 🤖*`;
    
    console.log(`✅ No duplicates found. Will add issue #${ISSUE_NUMBER} to vector store.`);
  }

  // Post comment on the issue
  await octokit.issues.createComment({
    owner: OWNER,
    repo: REPO,
    issue_number: ISSUE_NUMBER,
    body: commentBody,
  });
  console.log("Comment posted on the issue.");

  // Only add to vector store if no duplicates were found
  if (shouldAddToVector) {
    console.log("Adding new issue embedding to Pinecone...");
    await vectorStore.addDocuments([{ 
      pageContent: newText, 
      metadata: { 
        issue_number: ISSUE_NUMBER,
        title: newIssue.title,
        created_at: newIssue.created_at,
        url: newIssue.html_url
      } 
    }]);
    console.log("✅ New issue embedding stored in Pinecone for future duplicate detection.");
  } else {
    console.log("⏭️  Skipped adding to Pinecone due to duplicate detection.");
  }

  console.log(`\n=== Duplicate check completed for issue #${ISSUE_NUMBER} ===\n`);
}

run().catch(err => console.error(err));
