# 🔒 Security Policy

## Reporting Security Vulnerabilities

We take the security of Seroski-DupBot seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing one of the following addresses:

- **arun.ofc09@gmail.com**
- **jasonwilliam9894@gmail.com**

Include as much information as possible:

- **Type of vulnerability** (e.g., API key exposure, injection, authentication bypass)
- **Steps to reproduce** the issue
- **Affected versions** or components
- **Potential impact** of the vulnerability
- **Suggested fix** (if you have one)

### What to Expect

- **Initial Response**: We will acknowledge receipt of your report within **48 hours**
- **Status Updates**: We will provide status updates every **5-7 business days**
- **Resolution Timeline**: We aim to resolve critical vulnerabilities within **30 days**
- **Credit**: We will credit you in the security advisory (unless you prefer to remain anonymous)

### Disclosure Policy

- Please allow us reasonable time to fix the issue before public disclosure
- We will coordinate with you on the disclosure timeline
- We will publish a security advisory once a fix is available

## Supported Versions

We currently support security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < 1.0   | :x:                |

## Security Best Practices

### For Contributors and Users

#### API Keys and Secrets

**Never commit sensitive credentials to the repository.** Always use environment variables or GitHub Secrets.

✅ **DO:**
```bash
# Use .env file (never commit this file)
GITHUB_TOKEN=your_token_here
GEMINI_API_KEY=your_api_key_here
PINECONE_API_KEY=your_api_key_here
```

❌ **DON'T:**
```javascript
// Never hardcode credentials
const apiKey = "AIzaSyAbc123...";  // BAD!
```

#### Rotating Tokens

If you suspect a token or API key has been compromised:

1. **Revoke** the compromised key immediately
2. **Generate** a new key
3. **Update** your GitHub Secrets or local `.env` file
4. **Test** that the new key works
5. **Report** the incident if the key was committed to the repository

#### GitHub Actions Secrets

When using this bot in your repository:

1. Store all API keys in **GitHub Secrets** (Settings → Secrets and variables → Actions)
2. Never log or print secret values in workflows
3. Limit secret access to specific workflows when possible
4. Regularly rotate API keys (every 90 days recommended)

#### Pinecone Database Security

- Use **API key authentication** (enabled by default)
- Restrict API keys to specific indexes when possible
- Monitor database access logs for unusual activity
- Delete test/development indexes when no longer needed

### For Maintainers

- Review all PRs for potential security issues before merging
- Run security audits regularly: `npm audit`
- Keep dependencies up to date
- Use Dependabot for automated security updates
- Enable branch protection on `main` branch
- Require code reviews for all changes

## Known Security Considerations

### API Rate Limits

- **Google Gemini**: Rate limits apply based on your API tier
- **Pinecone**: Rate limits apply based on your plan
- **GitHub API**: Rate limits apply (5,000 requests/hour for authenticated requests)

Implement proper error handling and backoff strategies to avoid service disruptions.

### Data Privacy

- Issue data is stored in Pinecone vector database
- Only public issue data is processed
- No personal information beyond what's in public issues is collected
- Database vectors can be cleared using cleanup scripts

### Environment Variables

The following environment variables contain sensitive data:

- `GITHUB_TOKEN` - GitHub personal access token or GitHub Actions token
- `GEMINI_API_KEY` - Google Gemini API key
- `PINECONE_API_KEY` - Pinecone database API key

**Never share these values or commit them to version control.**

## Security Checklist for Deployments

Before deploying or using this bot:

- [ ] All API keys stored in GitHub Secrets (not hardcoded)
- [ ] `.env.demo` does not contain real credentials
- [ ] `.gitignore` includes `.env` file
- [ ] Workflow permissions are set to minimum required
- [ ] API validation workflow passes
- [ ] Dependencies are up to date (`npm audit` clean)
- [ ] No sensitive data in commit history

## Additional Resources

- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [OWASP API Security](https://owasp.org/www-project-api-security/)
- [Pinecone Security Documentation](https://docs.pinecone.io/docs/security)
- [Google Cloud Security](https://cloud.google.com/security/best-practices)

## Security Hall of Fame

We appreciate security researchers who responsibly disclose vulnerabilities:

- *Your name could be here!*

---

**Questions about security?** Contact us at arun.ofc09@gmail.com or jasonwilliam9894@gmail.com

Thank you for helping keep Seroski-DupBot and our community safe! 🛡️
