import { Pinecone } from "@pinecone-database/pinecone";
import { Octokit } from "@octokit/rest";
import fetch from "node-fetch";
import { maybeLoadDotenv } from "./utils/env.js";
import logger from "./utils/logger.js";
await maybeLoadDotenv();

// Validation functions
async function validatePinecone() {
  try {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY not found in environment variables");
    }
    if (!process.env.PINECONE_INDEX) {
      throw new Error("PINECONE_INDEX not found in environment variables");
    }

    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.Index(process.env.PINECONE_INDEX);
    
    const stats = await index.describeIndexStats();
    
    logger.success('Pinecone connection successful');
    logger.data(`📊 Index: ${process.env.PINECONE_INDEX}`);
    logger.data(`📈 Total vectors: ${stats.totalRecordCount || 0}`);
    logger.data(`📐 Dimension: ${stats.dimension}`);
    
    return { success: true, stats };
  } catch (error) {
    logger.error('Pinecone validation failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function validateGitHub() {
  try {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error("GITHUB_TOKEN not found in environment variables");
    }

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    
    // Test with current repository or fallback
    const owner = process.env.GITHUB_REPOSITORY?.split("/")[0] || process.env.GITHUB_OWNER || "seroski-ai";
    const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] || process.env.GITHUB_REPO || "seroski-dupbot";
    
    const result = await octokit.repos.get({ owner, repo });
    
    logger.success('GitHub connection successful');
    logger.data(`📋 Repository: ${result.data.full_name}`);
    logger.data(`🔓 Access: ${result.data.permissions?.admin ? 'Admin' : result.data.permissions?.push ? 'Write' : 'Read'}`);
    
    return { success: true, repo: result.data };
  } catch (error) {
    logger.error('GitHub validation failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function validateGemini() {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not found in environment variables");
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          model: "models/text-embedding-004",
          content: { parts: [{ text: "connection test" }] }
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorData}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'Unknown Gemini API error');
    }

    logger.success('Gemini API connection successful');
    logger.data('🧠 Model: text-embedding-004');
    logger.data(`📊 Embedding dimension: ${data.embedding?.values?.length || 'unknown'}`);
    
    return { success: true, embedding: data.embedding };
  } catch (error) {
    logger.error('Gemini validation failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function validateAllConnections() {
  logger.header('🔍 === API Connection Validation ===\n');
  
  const results = {
    pinecone: await validatePinecone(),
    github: await validateGitHub(),
    gemini: await validateGemini()
  };
  
  logger.header('\n📋 === Validation Summary ===');
  
  const successful = Object.values(results).filter(r => r.success).length;
  const total = Object.keys(results).length;
  
  logger.log(`✅ Successful: ${successful}/${total}`);
  logger.log(`❌ Failed: ${total - successful}/${total}`);
  
  if (successful === total) {
    logger.success('\n🎉 All API connections are working correctly!');
    process.exit(0);
  } else {
    logger.warn('\nSome API connections failed. Check the errors above.');
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const service = args[0];

if (args.includes('--help') || args.includes('-h')) {
  logger.info(`
📖 Usage: node .github/scripts/validate-apis.js [service]

🔧 Available Services:
  pinecone  - Test Pinecone vector database connection
  github    - Test GitHub API connection
  gemini    - Test Google Gemini API connection
  all       - Test all connections (default)

🔧 Required Environment Variables:
  - PINECONE_API_KEY: Pinecone API key
  - PINECONE_INDEX: Pinecone index name
  - GITHUB_TOKEN: GitHub personal access token
  - GEMINI_API_KEY: Google Gemini API key
  - GITHUB_REPOSITORY: Repository in format "owner/repo" (optional)

📝 Examples:
  node .github/scripts/validate-apis.js          # Test all connections
  node .github/scripts/validate-apis.js pinecone # Test only Pinecone
  node .github/scripts/validate-apis.js gemini   # Test only Gemini
  `);
  process.exit(0);
}

// Run specific service or all
switch (service) {
  case 'pinecone':
    validatePinecone().then(result => {
      process.exit(result.success ? 0 : 1);
    });
    break;
  case 'github':
    validateGitHub().then(result => {
      process.exit(result.success ? 0 : 1);
    });
    break;
  case 'gemini':
    validateGemini().then(result => {
      process.exit(result.success ? 0 : 1);
    });
    break;
  default:
    validateAllConnections();
}