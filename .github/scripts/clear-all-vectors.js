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

async function clearAllVectors() {
  logger.header(`\n🚨 === CLEARING ALL VECTORS FROM PINECONE INDEX ===`);
  logger.info(`Pinecone Index: ${indexName}`);
  logger.warn(`WARNING: This will delete ALL vectors permanently!`);

  try {
    const index = pinecone.Index(indexName);
    logger.success("Connected to Pinecone index");

    // Get current stats
    logger.info("📊 Getting current index statistics...");
    const initialStats = await index.describeIndexStats();
    const totalVectors = initialStats.totalRecordCount || 0;
    
    logger.data(`Current state:`);
    logger.data(`  - Total vectors: ${totalVectors}`);
    logger.data(`  - Index dimension: ${initialStats.dimension}`);
    logger.data(`  - Index fullness: ${initialStats.indexFullness}`);

    if (totalVectors === 0) {
      logger.info("Index is already empty. Nothing to clear.");
      return;
    }

    // Final confirmation in logs
    logger.warn(`\n🚨 PROCEEDING TO DELETE ALL ${totalVectors} VECTORS`);
    logger.warn("This action cannot be undone!");

    // Method 1: Try to delete all vectors by namespace (fastest)
    try {
      logger.log("\n🧹 Attempting to clear entire namespace...");
      await index.deleteAll();
      logger.success("Successfully cleared entire namespace");
      
      // Wait for operation to complete
      await delay(5000);
      
    } catch (deleteAllError) {
      logger.warn("deleteAll() failed, trying alternative method...");
      logger.error("Error:", deleteAllError.message);
      
      // Method 2: Get all vectors and delete them in batches
      logger.log("🔍 Fetching all vectors for batch deletion...");
      
      const allVectors = await index.query({
        vector: Array(1024).fill(0.1),
        topK: 10000, // Max limit
        includeMetadata: false,
        includeValues: false
      });

      if (allVectors.matches && allVectors.matches.length > 0) {
        logger.data(`Found ${allVectors.matches.length} vectors to delete`);
        
        // Delete in batches
        const batchSize = 1000;
        let deleted = 0;
        
        for (let i = 0; i < allVectors.matches.length; i += batchSize) {
          const batch = allVectors.matches.slice(i, i + batchSize);
          const batchIds = batch.map(v => v.id);
          
          try {
            await index.deleteMany(batchIds);
            deleted += batch.length;
            logger.log(`  🗑️  Deleted batch: ${batch.length} vectors (total: ${deleted}/${allVectors.matches.length})`);
            
            await delay(1000);
          } catch (batchError) {
            logger.error(`  Failed to delete batch:`, batchError.message);
          }
        }
        
        logger.success(`Batch deletion completed: ${deleted}/${allVectors.matches.length} vectors`);
      }
    }

    // Verify the clearing
    logger.info("\n🔍 Verifying index is cleared...");
    await delay(3000); // Wait for Pinecone to sync
    
    const finalStats = await index.describeIndexStats();
    const remainingVectors = finalStats.totalRecordCount || 0;
    
    logger.header(`\nFinal Results:`);
    logger.data(`  - Initial vectors: ${totalVectors}`);
    logger.data(`  - Remaining vectors: ${remainingVectors}`);
    logger.data(`  - Vectors cleared: ${totalVectors - remainingVectors}`);
    
    if (remainingVectors === 0) {
      logger.success("SUCCESS: All vectors have been cleared from the index!");
      logger.info("💡 You can now repopulate with fresh data using the populate script.");
    } else {
      logger.warn(`WARNING: ${remainingVectors} vectors still remain in the index.`);
      logger.log("This might be due to Pinecone sync delays. Check again in a few minutes.");
    }

  } catch (error) {
    logger.error("Error during clearing:", error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  logger.log(`
📖 Usage: node .github/scripts/clear-all-vectors.js --force

🔧 Required Environment Variables:
  - PINECONE_API_KEY: Pinecone API key
  - PINECONE_INDEX: Pinecone index name

📝 This script will:
  1. Connect to your Pinecone index
  2. Delete ALL vectors in the index
  3. Verify the clearing operation
  
🚨 WARNING: This will permanently delete ALL data in your Pinecone index!
⚠️  This action cannot be undone!

🛡️  Safety: Requires --force flag to run
  `);
  process.exit(0);
}

// Safety check - require --force flag
if (!args.includes('--force')) {
  logger.log(`
🚨 DANGER: This script will delete ALL vectors from your Pinecone index!

📋 What it will do:
  • Connect to index: ${indexName}
  • Delete every single vector in the database
  • Clear all issue embeddings and similarity data

🚨 THIS ACTION CANNOT BE UNDONE!

🛡️  For safety, this script requires the --force flag:
     node .github/scripts/clear-all-vectors.js --force

💡 Alternative: Use the cleanup script to remove only duplicates:
     node .github/scripts/cleanup-duplicates.js --force

📖 For help: node .github/scripts/clear-all-vectors.js --help
  `);
  process.exit(0);
}

// Final confirmation before destruction
logger.warn(`
⚠️  FINAL WARNING ⚠️

You are about to DELETE ALL VECTORS from Pinecone index: ${indexName}

This will:
- Remove all issue embeddings
- Destroy all similarity data
- Require repopulation from scratch

Proceeding in 3 seconds...
`);

// 3 second countdown
setTimeout(() => {
  logger.log("3...");
  setTimeout(() => {
    logger.log("2...");
    setTimeout(() => {
      logger.log("1...");
      setTimeout(() => {
        clearAllVectors().catch(error => {
          logger.error("💥 Script failed:", error);
          process.exit(1);
        });
      }, 1000);
    }, 1000);
  }, 1000);
}, 1000);