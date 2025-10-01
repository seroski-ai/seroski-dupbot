import { Octokit } from "@octokit/rest";
import fetch from "node-fetch";
import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";

// Load environment variables (for local development)
// In GitHub Actions, variables come from secrets
dotenv.config();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_REPOSITORY?.split("/")[0] || process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPOSITORY?.split("/")[1] || process.env.GITHUB_REPO;
const ISSUE_NUMBER = Number(process.env.ISSUE_NUMBER);
const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || "0.7");

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const indexName = process.env.PINECONE_INDEX;

// Retry logic for API calls
async function retryApiCall(apiCall, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      if (error.status === 429 || error.status >= 500) {
        console.log(`API call failed (attempt ${i + 1}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
}

// Safe vector operation with fallback
async function safeVectorOperation(operation, fallbackMessage) {
  try {
    return await operation();
  } catch (error) {
    console.error("❌ Vector database error:", error.message);
    
    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: ISSUE_NUMBER,
      body: `🔧 **Temporary Service Issue** 🔧\n\n` +
            `${fallbackMessage}\n\n` +
            `Our duplicate detection service is temporarily unavailable. ` +
            `A maintainer will review this issue manually.\n\n` +
            `**Error**: ${error.message}\n\n` +
            `*This comment was generated automatically by Seroski-DupBot 🤖*`,
    });
    
    throw error;
  }
}

async function run() {
  console.log(`\n=== Checking issue #${ISSUE_NUMBER} for duplicates ===`);

  const { data: newIssue } = await retryApiCall(async () => {
    return await octokit.issues.get({
      owner: OWNER,
      repo: REPO,
      issue_number: ISSUE_NUMBER,
    });
  });

  if (newIssue.pull_request) {
    console.log("⏭️ Skipping pull request - not an issue");
    return;
  }

  const newText = `${newIssue.title} ${newIssue.body || ""}`.trim();
  console.log(`Issue text: ${newText.substring(0, 100)}...`);

  if (newText.length < 10) {
    console.log("⚠️ Issue text too short for meaningful duplicate detection");
    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: ISSUE_NUMBER,
      body: `📝 **Issue Too Short for Analysis** 📝\n\n` +
            `This issue appears to have very little content. For better duplicate detection, please consider:\n\n` +
            `- Adding more details about the problem\n` +
            `- Including steps to reproduce\n` +
            `- Describing expected vs actual behavior\n\n` +
            `*This comment was generated automatically by Seroski-DupBot 🤖*`,
    });
    return;
  }

  console.log("Generating embedding for the new issue...");
  
  const generateEmbedding = async (text) => {
    return await retryApiCall(async () => {
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
      
      if (data.error || !data.embedding || !data.embedding.values) {
        console.error("Embedding error:", data.error || "Invalid response");
        return Array(1024).fill(0.01);
      }
      
      let embedding = data.embedding.values;
      if (embedding.length < 1024) {
        embedding = [...embedding, ...Array(1024 - embedding.length).fill(0)];
      } else if (embedding.length > 1024) {
        embedding = embedding.slice(0, 1024);
      }
      
      return embedding;
    });
  };

  const newEmbedding = await generateEmbedding(newText);
  console.log("✅ Generated embedding for new issue");

  const index = pinecone.Index(indexName);
  console.log("Checking if issue already exists in vector database...");
  
  let existingVectorIds = [];
  let isEditingExistingIssue = false;

  try {
    await safeVectorOperation(async () => {
      // Try to find existing vectors using metadata filter
      const queryResponse = await index.query({
        vector: Array(1024).fill(0.1),
        topK: 100,
        includeValues: false,
        includeMetadata: true,
        filter: {
          issue_number: ISSUE_NUMBER
        }
      });

      if (queryResponse.matches && queryResponse.matches.length > 0) {
        for (const match of queryResponse.matches) {
          existingVectorIds.push(match.id);
          console.log(`   📌 Found existing vector via filter: ${match.id}`);
        }
      } else {
        console.log("   🔄 Filter query returned no results, trying list approach...");
        let paginationToken = null;
        
        do {
          const listOptions = { limit: 100 };
          if (paginationToken) {
            listOptions.paginationToken = paginationToken;
          }
          
          const listResponse = await index.listPaginated(listOptions);
          
          if (listResponse.vectors) {
            for (const vector of listResponse.vectors) {
              if (vector.metadata?.issue_number === ISSUE_NUMBER) {
                existingVectorIds.push(vector.id);
                console.log(`   📌 Found existing vector via list: ${vector.id}`);
              }
            }
          }
          
          paginationToken = listResponse.pagination?.next;
        } while (paginationToken);
      }

      isEditingExistingIssue = existingVectorIds.length > 0;
      console.log(`Issue exists in DB: ${isEditingExistingIssue ? 'YES' : 'NO'} (${existingVectorIds.length} vectors found)`);
    }, "Could not check for existing issue vectors in the database.");
  } catch (error) {
    console.error("Vector database check failed, continuing with basic processing...");
  }

  let results = [];
  let filteredResults = [];
  let duplicates = [];

  try {
    await safeVectorOperation(async () => {
      console.log("Querying Pinecone for similar issues...");
      const queryResponse = await index.query({
        vector: newEmbedding,
        topK: 10,
        includeValues: false,
        includeMetadata: true,
      });

      results = queryResponse.matches || [];
      console.log(`Found ${results.length} potential matches`);

      filteredResults = results.filter(r => 
        r.metadata?.issue_number !== ISSUE_NUMBER
      );

      console.log(`After filtering out current issue: ${filteredResults.length} matches`);

      duplicates = filteredResults
        .filter(r => r.score >= SIMILARITY_THRESHOLD)
        .map(r => ({ 
          number: r.metadata?.issue_number || 'Unknown', 
          similarity: r.score,
          title: r.metadata?.title || 'Unknown'
        }));

      console.log(`Found ${duplicates.length} duplicates above threshold (${SIMILARITY_THRESHOLD})`);
      
      filteredResults.forEach((result, index) => {
        const score = result.score || 0;
        console.log(`  ${index + 1}. Issue #${result.metadata?.issue_number || 'Unknown'} - Score: ${score.toFixed(4)} ${score >= SIMILARITY_THRESHOLD ? '🚨 DUPLICATE' : '✅ Below threshold'}`);
        console.log(`     Title: "${result.metadata?.title || 'No title'}"`);
      });
    }, "Could not query the vector database for similar issues.");
  } catch (error) {
    console.error("Duplicate detection failed, treating as unique issue...");
  }

  let commentBody = '';
  let shouldUpdateVector = true;

  if (duplicates.length > 0) {
    shouldUpdateVector = false;
    
    if (isEditingExistingIssue) {
      commentBody = `🚨 **Warning: Edited Issue Now Appears Similar to Existing Issues** 🚨\n\n`;
      commentBody += `After your recent edit, this issue now appears to be similar to the following existing issue(s):\n\n`;
    } else {
      commentBody = `🚨 **Potential Duplicate Issues Detected** 🚨\n\n`;
      commentBody += `This issue appears to be similar to the following existing issue(s):\n\n`;
    }
    
    duplicates.forEach(dup => {
      const similarityPercent = (dup.similarity * 100).toFixed(1);
      commentBody += `- Issue #${dup.number}: "${dup.title}" (${similarityPercent}% similar)\n`;
      commentBody += `  Link: https://github.com/${OWNER}/${REPO}/issues/${dup.number}\n\n`;
    });
    
    commentBody += `\nPlease check if your issue is already covered by the above issue(s). If your issue is different, please provide more specific details to help us distinguish it.\n\n`;
    
    if (isEditingExistingIssue) {
      commentBody += `⚠️ **Note**: Since this was previously a unique issue, we've kept it in our database but flagged this similarity for your attention.\n\n`;
    }
    
    commentBody += `*This comment was generated automatically by Seroski-DupBot 🤖*`;
    
    console.log(`⚠️  Duplicate detected! ${isEditingExistingIssue ? 'Will keep existing vectors but flag similarity.' : 'Will NOT add to vector store.'}`);
  } else {
    shouldUpdateVector = true;
    
    if (isEditingExistingIssue) {
      commentBody = `✅ **Issue Updated Successfully** ✅\n\n`;
      commentBody += `Your edit has been processed and the issue still appears to be unique. Our duplicate detection database has been updated with your changes.\n\n`;
      commentBody += `Thank you for keeping your issue up to date! 🔄\n\n`;
    } else {
      commentBody = `✅ **Unique Issue Detected** ✅\n\n`;
      commentBody += `Thank you for finding and contributing this unique issue! This appears to be a new problem that hasn't been reported before.\n\n`;
      commentBody += `Your contribution helps make this project better. We appreciate you taking the time to report this! 🙏\n\n`;
    }
    
    commentBody += `*This comment was generated automatically by Seroski-DupBot 🤖*`;
    
    console.log(`✅ No duplicates found. ${isEditingExistingIssue ? 'Will update existing vectors.' : 'Will add new vectors.'}`);
  }

  await retryApiCall(async () => {
    return await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: ISSUE_NUMBER,
      body: commentBody,
    });
  });
  console.log("Comment posted on the issue.");

  if (shouldUpdateVector) {
    try {
      await safeVectorOperation(async () => {
        if (isEditingExistingIssue) {
          console.log("Updating existing issue vectors in Pinecone...");
          
          if (existingVectorIds.length > 0) {
            await index.deleteMany(existingVectorIds);
            console.log(`🗑️  Deleted ${existingVectorIds.length} old vector(s)`);
          }
          
          const vectorId = `issue-${ISSUE_NUMBER}-${Date.now()}`;
          await index.upsert([{
            id: vectorId,
            values: newEmbedding,
            metadata: {
              issue_number: ISSUE_NUMBER,
              title: newIssue.title,
              content: newText,
              created_at: newIssue.created_at,
              updated_at: newIssue.updated_at,
              url: newIssue.html_url
            }
          }]);
          
          console.log("✅ Updated issue embedding in Pinecone with new content.");
        } else {
          console.log("Adding new issue embedding to Pinecone...");
          
          const vectorId = `issue-${ISSUE_NUMBER}-${Date.now()}`;
          await index.upsert([{
            id: vectorId,
            values: newEmbedding,
            metadata: {
              issue_number: ISSUE_NUMBER,
              title: newIssue.title,
              content: newText,
              created_at: newIssue.created_at,
              url: newIssue.html_url
            }
          }]);
          
          console.log("✅ New issue embedding stored in Pinecone for future duplicate detection.");
        }
      }, "Could not update the vector database.");
    } catch (error) {
      console.error("Failed to update vector database, but issue processing completed.");
    }
  } else {
    if (isEditingExistingIssue && duplicates.length > 0) {
      console.log("⚠️  Keeping existing vectors unchanged due to similarity detected after edit.");
    } else {
      console.log("⏭️  Skipped adding to Pinecone due to duplicate detection.");
    }
  }

  console.log(`\n=== Duplicate check completed for issue #${ISSUE_NUMBER} ===\n`);
}

run().catch(err => console.error(err));
