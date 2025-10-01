# 🤖 Database Management Workflows

This repository includes several GitHub Actions workflows for managing your Pinecone vector database and duplicate detection system.

## 📋 Available Workflows

### 1. 🔧 Database Management & Validation (Manual)
**File:** `.github/workflows/database-management.yml`

A comprehensive workflow for database operations with built-in API validation.

**Actions Available:**
- **Validate Connections** - Test all API connections (Pinecone, GitHub, Gemini)
- **Populate Issues** - Safely add existing issues to the database (skips duplicates)
- **Cleanup Duplicates** - Remove duplicate vectors (requires force flag)
- **Debug Database** - View database contents and statistics
- **Clear All Vectors** - ⚠️ **DANGER:** Delete all vectors (requires force flag)

**How to use:**
1. Go to **Actions** tab in your repository
2. Select **"Database Management & Validation"**
3. Click **"Run workflow"**
4. Choose your action and enable force flag if needed
5. Click **"Run workflow"**

### 2. ⚡ Quick Database Actions (Manual)
**File:** `.github/workflows/quick-actions.yml`

Fast validation and safe operations with granular API testing.

**Actions Available:**
- **Validate All APIs** - Test all connections (Pinecone, GitHub, Gemini)
- **Validate Pinecone Only** - Test only Pinecone database connection
- **Validate GitHub Only** - Test only GitHub API connection
- **Validate Gemini Only** - Test only Gemini API connection
- **Populate Issues Safe** - Add existing issues (includes pre-validation)
- **Debug Database Status** - Check database status (includes validation)

### 3. 🔍 Duplicate Issue Management (Automatic + Manual)
**File:** `.github/workflows/duplicate-issue.yml`

Handles duplicate detection automatically and allows manual checks.

**Automatic triggers:**
- When issues are opened, edited, or reopened
- Automatically cleans up when issues are closed

**Manual triggers:**
- Check any specific issue number for duplicates

## 🛠️ Local Scripts (npm commands)

You can also run these operations locally:

```bash
# API Validation (NEW!)
npm run validate              # Test all API connections
npm run validate:pinecone     # Test only Pinecone connection  
npm run validate:github       # Test only GitHub connection
npm run validate:gemini       # Test only Gemini API connection

# Safe operations
npm run populate-issues       # Add existing issues to database
npm run debug-db             # Check database status
npm run check-duplicates     # Check for duplicates

# Cleanup operations  
npm run cleanup-duplicates --force    # Remove duplicates
npm run cleanup-issue                 # Remove specific closed issue

# Dangerous operations (use with caution!)
npm run clear-all:force              # ⚠️ Delete ALL vectors
```

## 🔐 Required Secrets

Make sure these secrets are configured in your repository:

- `GITHUB_TOKEN` - Automatically provided by GitHub
- `GEMINI_API_KEY` - Your Google Gemini API key
- `PINECONE_API_KEY` - Your Pinecone API key
- `PINECONE_INDEX` - Your Pinecone index name

## 🚨 Safety Features

- **Force flags required** for destructive operations
- **Confirmation prompts** in scripts
- **Continue-on-error** for non-critical operations
- **Detailed logging** for troubleshooting
- **Verification steps** after dangerous operations

## 📊 Workflow Status

Check the **Actions** tab to see:
- ✅ Successful operations
- ❌ Failed operations with detailed logs
- 📋 Summary reports for each run

## 🆘 Troubleshooting

### Common Issues:

1. **API Rate Limits**
   - Wait a few minutes and retry
   - Check the logs for specific error messages

2. **Connection Failures**
   - Use "Test Connection" in Quick Actions
   - Verify your API keys are correct

3. **Database Issues**
   - Use "Debug Database" to check current state
   - Check Pinecone dashboard for index status

4. **Permission Errors**
   - Ensure GitHub token has `issues: write` permission
   - Check repository secrets are properly set

### Getting Help:

1. Check workflow logs for detailed error messages
2. Use the debug tools to understand current state
3. Run test connections to verify API access
4. Check this README for common solutions

## 🎯 Best Practices

1. **Regular Maintenance:**
   - Run "Populate Issues" after major issue imports
   - Use "Debug Status" to monitor database health
   - Clean up duplicates periodically

2. **Before Major Operations:**
   - Always run "Debug Database" first
   - Test connections to ensure APIs are working
   - Have a backup plan (you can repopulate from scratch)

3. **Safety First:**
   - Never use force flags unless you understand the consequences
   - Test operations in a development environment first
   - Keep your API keys secure and rotated regularly