import { Pinecone } from "@pinecone-database/pinecone";
import { maybeLoadDotenv } from "./utils/env.js";
import logger from "./utils/logger.js";
await maybeLoadDotenv();

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const indexName = process.env.PINECONE_INDEX;

// Add delay to respect API rate limits
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function cleanupDuplicates() {
  logger.header(`\n=== Cleaning up duplicate vectors in Pinecone ===`);
  logger.data(`Pinecone Index: ${indexName}`);

  try {
    const index = pinecone.Index(indexName);
    logger.success("Connected to Pinecone index");

    // Get all vectors
    logger.log("📥 Fetching all vectors...");
    const allVectors = await index.query({
      vector: Array(1024).fill(0.1),
      topK: 1000, // Should be enough for all vectors
      includeMetadata: true,
      includeValues: false
    });

    if (!allVectors.matches || allVectors.matches.length === 0) {
      logger.info("No vectors found in the index.");
      return;
    }

    logger.data(`📊 Found ${allVectors.matches.length} total vectors`);

    // Group vectors by issue number
    const vectorsByIssue = new Map();
    
    for (const vector of allVectors.matches) {
      const issueNumber = vector.metadata?.issue_number;
      if (issueNumber) {
        if (!vectorsByIssue.has(issueNumber)) {
          vectorsByIssue.set(issueNumber, []);
        }
        vectorsByIssue.get(issueNumber).push(vector);
      }
    }

    logger.data(`🔍 Found vectors for ${vectorsByIssue.size} different issues`);

    // Find duplicates and decide which to keep
    const vectorsToDelete = [];
    const vectorsToKeep = [];

    for (const [issueNumber, vectors] of vectorsByIssue) {
      logger.log(`\n📋 Issue #${issueNumber}: ${vectors.length} vector(s)`);
      
      if (vectors.length === 1) {
        logger.success(`  No duplicates for issue #${issueNumber}`);
        vectorsToKeep.push(vectors[0]);
      } else {
        logger.log(`  🔍 Found ${vectors.length} vectors, selecting which to keep...`);
        
        // Sort vectors: prefer non-timestamped IDs (clean format)
        vectors.sort((a, b) => {
          const aHasTimestamp = /-\d{13}/.test(a.id);
          const bHasTimestamp = /-\d{13}/.test(b.id);
          
          if (!aHasTimestamp && bHasTimestamp) return -1; // a comes first (keep a)
          if (aHasTimestamp && !bHasTimestamp) return 1;  // b comes first (keep b)
          return a.id.localeCompare(b.id); // alphabetical if both same type
        });
        
        const toKeep = vectors[0];
        const toDelete = vectors.slice(1);
        
        logger.success(`    Keeping: ${toKeep.id}`);
        vectorsToKeep.push(toKeep);
        
        toDelete.forEach(v => {
          logger.log(`    🗑️  Deleting: ${v.id}`);
          vectorsToDelete.push(v.id);
        });
      }
    }

    logger.data(`\n📊 Summary:`);
    logger.data(`  ✅ Vectors to keep: ${vectorsToKeep.length}`);
    logger.data(`  🗑️  Vectors to delete: ${vectorsToDelete.length}`);

    if (vectorsToDelete.length === 0) {
      logger.success("🎉 No cleanup needed! All vectors are unique.");
      return;
    }

    // Confirm before deletion
    logger.warn(`\nAbout to delete ${vectorsToDelete.length} duplicate vectors.`);
    logger.log("🔍 Vectors to delete:");
    vectorsToDelete.forEach(id => logger.log(`  - ${id}`));
    
    // Delete in batches
    logger.log("\n🧹 Starting cleanup...");
    const batchSize = 100; // Pinecone delete limit
    let deleted = 0;

    for (let i = 0; i < vectorsToDelete.length; i += batchSize) {
      const batch = vectorsToDelete.slice(i, i + batchSize);
      
      try {
        await index.deleteMany(batch);
        deleted += batch.length;
        logger.log(`  🗑️  Deleted batch: ${batch.length} vectors (total: ${deleted}/${vectorsToDelete.length})`);
        
        // Add delay between batches
        await delay(1000);
      } catch (error) {
        logger.error(`  Failed to delete batch:`, error.message);
        logger.error(`     Batch IDs: ${batch.join(', ')}`);
      }
    }

    logger.success(`\n🎉 Cleanup completed!`);
    logger.success(`Deleted: ${deleted}/${vectorsToDelete.length} duplicate vectors`);
    logger.data(`📊 Remaining vectors: ${vectorsToKeep.length} (one per issue)`);
    
    // Verify cleanup
    logger.log("\n🔍 Verifying cleanup...");
    await delay(2000); // Wait for Pinecone to sync
    
    const finalStats = await index.describeIndexStats();
    const finalCount = finalStats.totalRecordCount || 0;
    logger.data(`📊 Final vector count: ${finalCount}`);
    
    if (finalCount === vectorsToKeep.length) {
      logger.success("Cleanup verification successful!");
    } else {
      logger.warn(`Expected ${vectorsToKeep.length} vectors, but found ${finalCount}`);
    }

  } catch (error) {
    logger.error("Error during cleanup:", error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  logger.info(`
📖 Usage: node .github/scripts/cleanup-duplicates.js

🔧 Required Environment Variables:
  - PINECONE_API_KEY: Pinecone API key
  - PINECONE_INDEX: Pinecone index name

📝 This script will:
  1. Find all vectors in your Pinecone index
  2. Group them by issue number  
  3. Identify and remove duplicate vectors
  4. Keep only one vector per issue (preferring clean IDs)
  
⚠️  WARNING: This will permanently delete duplicate vectors!
  `);
  process.exit(0);
}

// Confirmation prompt for safety
if (!args.includes('--force')) {
  logger.warn(`
WARNING: This script will delete duplicate vectors from your Pinecone index!

📋 What it will do:
  • Find all vectors with the same issue_number
  • Keep the vector with the cleanest ID format (without timestamp)
  • Delete all other duplicate vectors

🚨 This action cannot be undone!

To proceed, run: node .github/scripts/cleanup-duplicates.js --force
To see help: node .github/scripts/cleanup-duplicates.js --help
  `);
  process.exit(0);
}

// Run the cleanup
cleanupDuplicates().catch(error => {
  logger.error("💥 Script failed:", error);
  process.exit(1);
});