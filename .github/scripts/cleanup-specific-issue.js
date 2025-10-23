import { Pinecone } from "@pinecone-database/pinecone";
import { maybeLoadDotenv } from "./utils/env.js";
import logger from "./utils/logger.js";
await maybeLoadDotenv();

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const indexName = process.env.PINECONE_INDEX;
const ISSUE_TO_DELETE = process.env.ISSUE_NUMBER || process.argv[2];

async function deleteIssueVectors() {
  logger.header(`\n=== Deleting vectors for Issue #${ISSUE_TO_DELETE} ===`);
  logger.info(`Pinecone Index: ${indexName}`);

  if (!ISSUE_TO_DELETE) {
    logger.error("Please provide an issue number:");
    logger.log("   Usage: ISSUE_NUMBER=6 node .github/scripts/cleanup-specific-issue.js");
    logger.log("   Or:    node .github/scripts/cleanup-specific-issue.js 6");
    process.exit(1);
  }

  try {
    const index = pinecone.Index(indexName);
    logger.success("Connected to Pinecone index");

    // Find all vectors for this issue
    logger.info(`🔍 Searching for vectors related to issue #${ISSUE_TO_DELETE}...`);
    
    const vectorsToDelete = [];
    
    try {
      // First, try using metadata filter
      const queryResponse = await index.query({
        vector: Array(1024).fill(0.1), // dummy vector for metadata filtering
        topK: 100,
        includeValues: false,
        includeMetadata: true,
        filter: {
          issue_number: parseInt(ISSUE_TO_DELETE)
        }
      });

      if (queryResponse.matches && queryResponse.matches.length > 0) {
        for (const match of queryResponse.matches) {
          vectorsToDelete.push(match.id);
          logger.log(`   📌 Found vector via filter: ${match.id}`);
          logger.log(`      Metadata:`, JSON.stringify(match.metadata, null, 2));
        }
      } else {
        logger.log("   🔄 Filter query returned no results, trying list approach...");
        
        // Fallback: List all vectors and filter
        let paginationToken = null;
        
        do {
          const listOptions = { limit: 100 };
          if (paginationToken) {
            listOptions.paginationToken = paginationToken;
          }
          
          const listResponse = await index.listPaginated(listOptions);
          
          if (listResponse.vectors) {
            for (const vector of listResponse.vectors) {
              if (vector.metadata?.issue_number === parseInt(ISSUE_TO_DELETE)) {
                vectorsToDelete.push(vector.id);
                logger.log(`   📌 Found vector via list: ${vector.id}`);
                logger.log(`      Metadata:`, JSON.stringify(vector.metadata, null, 2));
              }
            }
          }
          
          paginationToken = listResponse.pagination?.next;
        } while (paginationToken);
      }
    } catch (searchError) {
      logger.error("Error searching for vectors:", searchError.message);
      throw searchError;
    }

    logger.data(`\nFound ${vectorsToDelete.length} vector(s) to delete for Issue #${ISSUE_TO_DELETE}`);

    if (vectorsToDelete.length === 0) {
      logger.info(`No vectors found for Issue #${ISSUE_TO_DELETE}. Nothing to delete.`);
      return;
    }

    // Show what we're about to delete
    logger.log(`\n🗑️  About to delete the following vectors:`);
    vectorsToDelete.forEach((id, index) => {
      logger.log(`   ${index + 1}. ${id}`);
    });

    // Confirm deletion
    logger.warn(`\nThis action cannot be undone!`);
    
    // Delete the vectors
    logger.info(`\n🗑️  Deleting ${vectorsToDelete.length} vector(s)...`);
    
    try {
      await index.deleteMany(vectorsToDelete);
      logger.success(`Successfully deleted ${vectorsToDelete.length} vector(s) for Issue #${ISSUE_TO_DELETE}`);
    } catch (deleteError) {
      logger.error(`Error deleting vectors:`, deleteError.message);
      throw deleteError;
    }

    logger.header(`\n=== Cleanup Summary ===`);
    logger.data(`Issue #${ISSUE_TO_DELETE} vectors deleted: ${vectorsToDelete.length}`);
    logger.success(`Database cleanup completed successfully`);
    logger.info(`\n🎯 You can now edit Issue #${ISSUE_TO_DELETE} to test the update functionality!`);

  } catch (error) {
    logger.error("Error during cleanup:", error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  logger.log(`
📖 Usage: 
  ISSUE_NUMBER=6 node .github/scripts/cleanup-specific-issue.js
  node .github/scripts/cleanup-specific-issue.js 6

🔧 Required Environment Variables:
  - PINECONE_API_KEY: Pinecone API key
  - PINECONE_INDEX: Pinecone index name

📝 This script will:
  1. Find all vectors in Pinecone related to the specified issue number
  2. Delete those vectors from the Pinecone index
  3. Show a summary of what was deleted
  
⚠️  Note: This action cannot be undone! Use carefully.
  `);
  process.exit(0);
}

// Run the cleanup script
deleteIssueVectors().catch(error => {
  logger.error("💥 Cleanup script failed:", error);
  process.exit(1);
});