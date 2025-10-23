# 🤖 Seroski-DupBot

> AI-powered GitHub bot that automatically detects duplicate issues using semantic similarity

[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/seroski-ai/seroski-dupbot/duplicate-issue.yml?branch=main)](https://github.com/seroski-ai/seroski-dupbot/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-contributor%20covenant-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security-policy-red.svg)](./SECURITY.md)

## 🎯 What It Does

Seroski-DupBot automatically detects duplicate GitHub issues using AI-powered semantic similarity. When someone creates or edits an issue, the bot:

1. **Analyzes** the issue content using Google Gemini AI
2. **Compares** it against existing issues using vector similarity
3. **Flags** potential duplicates with detailed similarity scores
4. **Comments** on the issue with findings and suggestions

## ⚡ Quick Start

### 1. Repository Setup
1. Fork or use this repository as a template
2. Configure the required secrets in your repository settings

### 2. Required Secrets
Add these secrets in your GitHub repository (`Settings` → `Secrets and variables` → `Actions`):

```bash
GITHUB_TOKEN          # Automatically provided by GitHub
GEMINI_API_KEY        # Get from Google AI Studio
PINECONE_API_KEY      # Get from Pinecone dashboard
PINECONE_INDEX        # Your Pinecone index name
```

### 3. Initial Setup
1. **Validate APIs**: Go to `Actions` → `API Validation` → Run workflow
2. **Populate Database**: Go to `Actions` → `Database Operations` → `populate-issues` → Run
3. **Test Detection**: Create a test issue to see the bot in action

## 🔧 API Keys Setup

### Google Gemini API
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Add as `GEMINI_API_KEY` secret

### Pinecone Database
1. Sign up at [Pinecone](https://www.pinecone.io/)
2. Create a new index with dimension `1024`
3. Get your API key and index name
4. Add as `PINECONE_API_KEY` and `PINECONE_INDEX` secrets

## 🚀 How It Works

The bot follows this process:
1. **Issue Event** → Triggers duplicate detection
2. **Generate Embedding** → Uses Gemini AI to understand content
3. **Search Database** → Finds similar issues using vector search
4. **Calculate Similarity** → Compares with existing issues
5. **Report Results** → Comments on issue if duplicates found

## 🎛️ Configuration

### Similarity Threshold
Default: `0.7` (70% similarity)

Adjust in `.github/workflows/duplicate-issue.yml`:
```yaml
env:
  SIMILARITY_THRESHOLD: 0.5  # Adjust between 0.1-0.9
```

## 📊 Management Tools

### GitHub Actions Workflows
- **API Validation**: Test all connections
- **Database Operations**: Manage your vector database  
- **Duplicate Detection**: Automatic and manual duplicate checking

### Local Development
```bash
# Validate APIs
npm run validate

# Populate database
npm run populate-issues  

# Debug database
npm run debug-db

# Check for duplicates manually
npm run check-duplicates
```

## 📈 Features

- ✅ **AI-Powered**: Uses Google Gemini for semantic understanding
- ✅ **Fast & Scalable**: Pinecone vector database for millisecond searches  
- ✅ **Automatic**: Triggers on issue events with zero configuration
- ✅ **Safe**: Includes validation, cleanup, and error handling
- ✅ **Flexible**: Configurable similarity thresholds and filters
- ✅ **Maintainable**: Comprehensive tooling and documentation

## 🛠️ Advanced Usage

For detailed workflow management and troubleshooting, see [WORKFLOWS.md](./WORKFLOWS.md)

## 🔒 Security

Security is a top priority. Please review our [Security Policy](./SECURITY.md) for:

- **Vulnerability Reporting**: How to responsibly report security issues
- **API Key Safety**: Best practices for handling secrets and credentials
- **Response Timeline**: What to expect when reporting vulnerabilities
- **Security Checklist**: Guidelines for safe deployment

**Found a security issue?** Please report it privately to arun.ofc09@gmail.com or jasonwilliam9894@gmail.com

## 🆘 Troubleshooting

### Common Issues
- **API Connection Failures**: Run `API Validation` workflow
- **No Duplicates Detected**: Lower similarity threshold or populate more issues
- **Bot Not Responding**: Check workflow permissions and secrets

### Getting Help
1. Check [WORKFLOWS.md](./WORKFLOWS.md) for detailed guides
2. Run diagnostic workflows in Actions tab
3. Open an issue for bugs or questions

---

<div align="center">

**[🚀 Get Started](../../actions)** • **[📚 Documentation](./WORKFLOWS.md)** • **[🐛 Report Issue](../../issues)**

Made with ❤️ by [Seroski AI](https://github.com/seroski-ai)

</div>
