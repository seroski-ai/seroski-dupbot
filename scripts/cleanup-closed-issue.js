import { Octokit } from "@octokit/rest";
import { Pinecone } from "@pinecone-database/pinecone";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_REPOSITORY?.split("/")[0] || process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPOSITORY?.split("/")[1] || process.env.GITHUB_REPO;
const ISSUE_NUMBER = Number(process.env.ISSUE_NUMBER);

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
        delay *= 2; // Exponential backoff
      } else {
        throw error; // Don't retry for other errors
      }
    }
  }
}

async function cleanupClosedIssue() {
  console.log(`\n=== Cleaning up closed issue #${ISSUE_NUMBER} from vector database ===`);
  console.log(`Repository: ${OWNER}/${REPO}`);
  console.log(`Pinecone Index: ${indexName}`);

  if (!OWNER || !REPO) {
    console.error("❌ Repository owner and name must be specified via GITHUB_REPOSITORY or GITHUB_OWNER/GITHUB_REPO environment variables");
    process.exit(1);
  }

  if (!ISSUE_NUMBER) {
    console.error("❌ Issue number must be specified via ISSUE_NUMBER environment variable");
    process.exit(1);
  }

  try {
    // Initialize Pinecone index
    const index = pinecone.Index(indexName);
    console.log("✅ Connected to Pinecone index");

    // Fetch the closed issue details for logging with retry logic
    const { data: closedIssue } = await retryApiCall(async () => {
      return await octokit.issues.get({
        owner: OWNER,
        repo: REPO,
        issue_number: ISSUE_NUMBER,
      });
    });

    // Skip if it's actually a pull request
    if (closedIssue.pull_request) {
      console.log("⏭️ Skipping pull request cleanup - not an issue");
      return;
    }

    console.log(`📄 Issue details:`);
    console.log(`   Title: "${closedIssue.title}"`);
    console.log(`   State: ${closedIssue.state}`);
    console.log(`   Closed at: ${closedIssue.closed_at}`);

    // Query Pinecone to find vectors for this issue with retry logic
    console.log(`🔍 Searching for vectors related to issue #${ISSUE_NUMBER}...`);
    
    const vectorsToDelete = [];
    
    try {
      await retryApiCall(async () => {
        // List all vectors and filter by issue_number in metadata
        // Note: Pinecone doesn't support metadata-based deletion directly via query,
        // so we need to list and filter
        const listResponse = await index.listPaginated();
        
        if (listResponse.vectors) {
          for (const vector of listResponse.vectors) {
            if (vector.metadata?.issue_number === ISSUE_NUMBER) {
              vectorsToDelete.push(vector.id);
              console.log(`   📌 Found vector: ${vector.id}`);
            }
          }
        }
      });
    } catch (error) {
      console.error("❌ Failed to list vectors from Pinecone:", error.message);
      throw error;
    }

    console.log(`Found ${vectorsToDelete.length} vector(s) to delete`);

    if (vectorsToDelete.length === 0) {
      console.log(`ℹ️  No vectors found for issue #${ISSUE_NUMBER}. It may have been a duplicate issue that was never added to the vector database.`);
      
      // Still post a cleanup confirmation comment with retry logic
      await retryApiCall(async () => {
        return await octokit.issues.createComment({
          owner: OWNER,
          repo: REPO,
          issue_number: ISSUE_NUMBER,
          body: `🧹 **Issue Cleanup Completed** 🧹\n\n` +
                `This issue has been closed and checked for cleanup. No vectors were found in the database ` +
                `(likely because it was detected as a duplicate and never stored).\n\n` +
                `*This comment was generated automatically by Seroski-DupBot 🤖*`,
        });
      });
      
      console.log("✅ Cleanup confirmation comment posted");
      return;
    }

    // Delete the vectors from Pinecone with retry logic
    console.log(`🗑️  Deleting ${vectorsToDelete.length} vector(s) from Pinecone...`);
    
    try {
      await retryApiCall(async () => {
        return await index.deleteMany(vectorsToDelete);
      });
      console.log(`✅ Successfully deleted ${vectorsToDelete.length} vector(s) from Pinecone`);
    } catch (deleteError) {
      console.error(`❌ Error deleting vectors:`, deleteError.message);
      throw deleteError;
    }

    // Post a comment on the closed issue confirming cleanup with retry logic
    const commentBody = `🧹 **Issue Cleanup Completed** 🧹\n\n` +
                       `This closed issue has been automatically removed from our duplicate detection database.\n\n` +
                       `**Cleanup Details:**\n` +
                       `- Vectors removed: ${vectorsToDelete.length}\n` +
                       `- Cleaned at: ${new Date().toISOString()}\n\n` +
                       `This helps keep our duplicate detection system accurate and prevents closed issues ` +
                       `from being referenced in future duplicate checks.\n\n` +
                       `*This comment was generated automatically by Seroski-DupBot 🤖*`;

    await retryApiCall(async () => {
      return await octokit.issues.createComment({
        owner: OWNER,
        repo: REPO,
        issue_number: ISSUE_NUMBER,
        body: commentBody,
      });
    });

    console.log("✅ Cleanup confirmation comment posted on the issue");

    console.log(`\n=== Cleanup Summary ===`);
    console.log(`📊 Issue #${ISSUE_NUMBER}: "${closedIssue.title}"`);
    console.log(`🗑️  Vectors deleted: ${vectorsToDelete.length}`);
    console.log(`✅ Database cleanup completed successfully`);
    console.log(`💬 Confirmation comment posted`);

  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    
    // Try to post an error comment if possible with retry logic
    try {
      await retryApiCall(async () => {
        return await octokit.issues.createComment({
          owner: OWNER,
          repo: REPO,
          issue_number: ISSUE_NUMBER,
          body: `⚠️ **Issue Cleanup Failed** ⚠️\n\n` +
                `There was an error while trying to clean up this closed issue from our duplicate detection database.\n\n` +
                `**Error:** ${error.message}\n\n` +
                `A maintainer may need to manually review the vector database cleanup.\n\n` +
                `*This comment was generated automatically by Seroski-DupBot 🤖*`,
        });
      });
    } catch (commentError) {
      console.error("❌ Failed to post error comment:", commentError.message);
    }
    
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
📖 Usage: node scripts/cleanup-closed-issue.js

🔧 Required Environment Variables:
  - GITHUB_TOKEN: GitHub personal access token
  - GITHUB_REPOSITORY: Repository in format "owner/repo" (or use GITHUB_OWNER + GITHUB_REPO)
  - ISSUE_NUMBER: Issue number to clean up
  - PINECONE_API_KEY: Pinecone API key
  - PINECONE_INDEX: Pinecone index name

📝 This script will:
  1. Find all vectors in Pinecone related to the specified issue number
  2. Delete those vectors from the Pinecone index
  3. Post a confirmation comment on the closed issue
  
⚠️  Note: This script is typically called automatically by GitHub Actions when issues are closed.
  `);
  process.exit(0);
}

// Run the cleanup script
cleanupClosedIssue().catch(error => {
  console.error("💥 Cleanup script failed:", error);
  process.exit(1);
});