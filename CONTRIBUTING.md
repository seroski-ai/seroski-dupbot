# 🤝 Contributing to Seroski-DupBot

Thank you for your interest in contributing to Seroski-DupBot! We welcome contributions from the community and are grateful for your support.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Community](#community)

## 📜 Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Please:

- Be respectful and considerate
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing opinions and experiences

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Git** installed on your system
- A **GitHub account**
- API keys for development:
  - [Google Gemini API Key](https://aistudio.google.com/app/apikey)
  - [Pinecone Account](https://www.pinecone.io/)

### Fork and Clone

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/seroski-dupbot.git
   cd seroski-dupbot
   ```
3. **Add upstream** remote:
   ```bash
   git remote add upstream https://github.com/seroski-ai/seroski-dupbot.git
   ```

## 🔧 Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create environment file**:
   ```bash
   cp .env.demo .env
   ```

3. **Configure your `.env`** file with your API keys:
   ```env
   GITHUB_TOKEN=your_github_token
   GEMINI_API_KEY=your_gemini_api_key
   PINECONE_API_KEY=your_pinecone_api_key
   PINECONE_INDEX=your_pinecone_index_name
   ```

4. **Validate your setup**:
   ```bash
   npm run validate
   ```

5. **Populate test data** (optional):
   ```bash
   npm run populate-issues
   ```

## 🎯 How to Contribute

### 🐛 Reporting Bugs

If you find a bug, please create an issue with:

- **Clear title** describing the issue
- **Detailed description** of the problem
- **Steps to reproduce** the bug
- **Expected vs actual behavior**
- **Environment details** (OS, Node version, etc.)
- **Screenshots or logs** if applicable

### 💡 Suggesting Features

We love new ideas! To suggest a feature:

- Check if it's already been suggested in issues
- Create a new issue with the `enhancement` label
- Describe the feature and its benefits
- Explain how it would work
- Consider providing mockups or examples

### 🔨 Code Contributions

#### Types of Contributions We Welcome

- **Bug fixes** - Fix existing issues
- **New features** - Implement proposed enhancements
- **Documentation** - Improve or add documentation
- **Tests** - Add or improve test coverage
- **Performance** - Optimize existing code
- **Refactoring** - Improve code quality

#### Before Starting

1. **Check existing issues** - See if someone is already working on it
2. **Create or comment on an issue** - Let others know you're working on it
3. **Discuss major changes** - For large changes, discuss the approach first

## 📝 Pull Request Process

### Creating a Pull Request

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes**:
   - Write clean, readable code
   - Follow our coding standards
   - Add tests if applicable
   - Update documentation

3. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```
   
   Use [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting)
   - `refactor:` - Code refactoring
   - `test:` - Adding or updating tests
   - `chore:` - Maintenance tasks

4. **Keep your branch updated**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** on GitHub:
   - **Target the `dev` branch** (not `main`)
   - Use a clear, descriptive title
   - Reference related issues (e.g., "Fixes #123")
   - Describe what changed and why
   - Add screenshots for UI changes
   - List any breaking changes

### PR Review Process

- Maintainers will review your PR
- Address feedback and requested changes
- Once approved, a maintainer will merge your PR
- Your contribution will be credited!

## 💻 Coding Standards

### JavaScript/Node.js Guidelines

- **Use ES6+ features** (async/await, destructuring, etc.)
- **Use ESM imports** (not CommonJS require)
- **Follow consistent naming**:
  - `camelCase` for variables and functions
  - `PascalCase` for classes
  - `UPPER_CASE` for constants
- **Add comments** for complex logic
- **Handle errors** properly with try/catch
- **Use meaningful variable names**

### File Organization

```
seroski-dupbot/
├── .github/
│   ├── scripts/                          # Automation and utility scripts
│   │   ├── check-duplicates.js          # Manual duplicate detection
│   │   ├── cleanup-closed-issue.js      # Remove closed issues from DB
│   │   ├── cleanup-duplicates.js        # Clean duplicate vectors
│   │   ├── cleanup-specific-issue.js    # Remove specific issue
│   │   ├── clear-all-vectors.js         # Clear entire database
│   │   ├── debug-pinecone.js            # Debug database contents
│   │   ├── populate-existing-issues.js  # Initial DB population
│   │   └── validate-apis.js             # API connection validation
│   └── workflows/                        # GitHub Actions workflows
│       ├── api-validation.yml           # Validate API connections
│       ├── database-operations.yml      # Database management
│       └── duplicate-issue.yml          # Auto duplicate detection
├── .env.demo                             # Environment template
├── .gitignore                            # Git ignore rules
├── CONTRIBUTING.md                       # This file!
├── LICENSE                               # MIT License
├── README.md                             # Project documentation
├── WORKFLOWS.md                          # Workflow documentation
└── package.json                          # Dependencies and scripts
```

**Key Files to Know:**
- **Scripts** (`/.github/scripts/`): Core functionality for duplicate detection, database operations, and API validation
- **Workflows** (`/.github/workflows/`): GitHub Actions that automate the bot
- **Configuration** (`.env.demo`): Template for environment variables
- **Documentation** (`README.md`, `WORKFLOWS.md`): User guides and workflow details

### Example Code Style

```javascript
import { Pinecone } from '@pinecone-database/pinecone';

// Use async/await
async function searchSimilarIssues(embedding) {
  try {
    const results = await index.query({
      vector: embedding,
      topK: 5,
      includeMetadata: true
    });
    return results.matches;
  } catch (error) {
    console.error('Error searching issues:', error);
    throw error;
  }
}

// Use descriptive names
const SIMILARITY_THRESHOLD = 0.7;
```

## 🧪 Testing

### Running Tests

```bash
npm test
```

### Manual Testing

1. **Validate APIs**:
   ```bash
   npm run validate
   ```

2. **Test database operations**:
   ```bash
   npm run debug-db
   ```

3. **Test duplicate detection**:
   ```bash
   npm run check-duplicates
   ```

### Test Checklist

Before submitting a PR, ensure:

- [ ] Code runs without errors
- [ ] All scripts work as expected
- [ ] API validations pass
- [ ] No console errors or warnings
- [ ] Edge cases are handled

## 📚 Documentation

### Updating Documentation

- Update `README.md` for user-facing changes
- Update `WORKFLOWS.md` for workflow changes
- Add JSDoc comments to functions
- Update this guide if contributing process changes

### Documentation Style

- Use clear, simple language
- Include code examples
- Add emojis for visual scanning
- Keep formatting consistent

## 🌟 Community

### Getting Help

- **Issues**: Open an issue for bugs or questions
- **Discussions**: Use GitHub Discussions for general questions
- **Pull Requests**: We'll provide feedback and guidance

### Recognition

Contributors will be:

- Credited in release notes
- Mentioned in the README (for significant contributions)
- Appreciated by the community! 🎉

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You!

Every contribution, no matter how small, helps make Seroski-DupBot better. Thank you for being part of our community!

---

**Questions?** Feel free to open an issue or reach out to the maintainers.

Happy coding! 🚀
