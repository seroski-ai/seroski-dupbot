import { Pinecone } from "@pinecone-database/pinecone";
import { maybeLoadDotenv } from "./utils/env.js";
import logger from "./utils/logger.js";
await maybeLoadDotenv();

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const indexName = process.env.PINECONE_INDEX;

async function debugPinecone() {
  logger.header("=== Pinecone Debug Information ===");
  logger.info(`Index: ${indexName}`);

  try {
    const index = pinecone.Index(indexName);
    
    // Get index stats
    logger.log("\n1. Index Statistics:");
    const stats = await index.describeIndexStats();
    logger.data("Full stats object:", JSON.stringify(stats, null, 2));
    
    // Try to query some vectors
    logger.log("\n2. Sample Query (first 10 vectors):");
    try {
      const queryResult = await index.query({
        vector: Array(1024).fill(0.1),
        topK: 10,
        includeMetadata: true,
        includeValues: false
      });
      
      logger.data(`Found ${queryResult.matches?.length || 0} vectors`);
      if (queryResult.matches && queryResult.matches.length > 0) {
        queryResult.matches.forEach((match, i) => {
          logger.log(`  ${i + 1}. ID: ${match.id}, Score: ${match.score}`);
          if (match.metadata) {
            logger.log(`     Metadata:`, match.metadata);
          }
        });
      }
    } catch (queryError) {
      logger.error("Query failed:", queryError.message);
    }
    
    // Try specific fetch for known IDs
    logger.log("\n3. Testing specific ID fetch:");
    const testIds = ['issue-1', 'issue-3', 'issue-4', 'issue-5', 'issue-6', 'issue-7', 'issue-8'];
    
    try {
      const fetchResult = await index.fetch(testIds);
      logger.data(`Fetch result keys: ${Object.keys(fetchResult.vectors || {}).join(', ')}`);
      
      if (fetchResult.vectors) {
        Object.entries(fetchResult.vectors).forEach(([id, vector]) => {
          logger.log(`  Found: ${id}`);
          if (vector.metadata) {
            logger.log(`    Issue #: ${vector.metadata.issue_number}`);
            logger.log(`    Title: ${vector.metadata.title?.substring(0, 50)}...`);
          }
        });
      }
    } catch (fetchError) {
      logger.error("Fetch failed:", fetchError.message);
    }
    
    // Try with different ID patterns (in case they have timestamps)
    logger.log("\n4. Checking for timestamped IDs:");
    try {
      const allQuery = await index.query({
        vector: Array(1024).fill(0.1),
        topK: 100,
        includeMetadata: true,
        includeValues: false
      });
      
      if (allQuery.matches && allQuery.matches.length > 0) {
        logger.log("All vector IDs found:");
        allQuery.matches.forEach(match => {
          logger.log(`  - ${match.id} (issue #${match.metadata?.issue_number || 'unknown'})`);
        });
      } else {
        logger.warn("No vectors found in query");
      }
    } catch (allQueryError) {
      logger.error("All query failed:", allQueryError.message);
    }
    
  } catch (error) {
    logger.error("Debug failed:", error);
  }
}

debugPinecone().catch(logger.error);