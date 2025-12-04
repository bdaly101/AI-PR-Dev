# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow these steps:

### 1. Do Not Open a Public Issue

**Do not** open a public GitHub issue for security vulnerabilities. This could expose the vulnerability to malicious actors.

### 2. Report Privately

Please report security vulnerabilities by emailing the maintainers at: **security@your-domain.com**

Or, if you prefer, you can use GitHub's [Private Vulnerability Reporting](https://github.com/bdaly101/AI-PR-Dev/security/advisories/new).

### 3. Include Details

In your report, please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)
- Your contact information

### 4. Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity, typically 30-90 days

### 5. Disclosure

We will:
- Acknowledge receipt of your report
- Keep you informed of the progress
- Credit you in the security advisory (if you wish)
- Not disclose the vulnerability until a fix is available

## Security Best Practices

### For Users

1. **Keep Dependencies Updated**
   ```bash
   npm audit
   npm audit fix
   ```

2. **Use Environment Variables**
   - Never commit `.env` files
   - Use strong, unique secrets
   - Rotate secrets regularly

3. **Secure Your GitHub App**
   - Use strong webhook secrets
   - Limit app permissions to minimum required
   - Regularly review installed apps

4. **API Key Security**
   - Store API keys securely
   - Use separate keys for development/production
   - Rotate keys if compromised
   - Monitor API usage for anomalies

5. **Network Security**
   - Use HTTPS for all webhook endpoints
   - Implement rate limiting
   - Use API key authentication in production

6. **Database Security**
   - Secure database file permissions
   - Regular backups
   - Encrypt sensitive data if needed

### For Developers

1. **Code Review**
   - All code changes require review
   - Security-sensitive changes need extra scrutiny

2. **Dependency Management**
   - Regularly update dependencies
   - Review dependency changes
   - Use `npm audit` before merging

3. **Secrets Management**
   - Never commit secrets
   - Use environment variables
   - Use secret management services in production

4. **Input Validation**
   - Validate all user inputs
   - Sanitize data before processing
   - Use parameterized queries

5. **Error Handling**
   - Don't expose sensitive information in errors
   - Log errors securely
   - Handle errors gracefully

## Known Security Considerations

### GitHub App Permissions

The app requires the following permissions:
- **Contents: Read & Write** - Required for Dev Agent to create branches and commits
- **Pull requests: Read & Write** - Required to post reviews and comments
- **Issues: Read & Write** - Required to respond to slash commands

**Recommendation**: Install the app only on repositories where these permissions are acceptable.

### API Keys

- OpenAI and Anthropic API keys are stored in environment variables
- Keys are never logged or exposed in error messages
- Consider using API key rotation policies

### Webhook Security

- All webhooks are verified using HMAC signatures
- Webhook secrets should be strong and unique
- Use HTTPS for webhook endpoints

### Database

- SQLite database stores review data
- No sensitive user data is stored
- Database file should have restricted permissions

## Security Updates

Security updates will be:
- Released as patch versions (e.g., 1.0.1)
- Documented in the CHANGELOG
- Announced via GitHub releases
- Tagged with security labels

## Security Audit

We regularly:
- Review dependencies for vulnerabilities
- Audit code for security issues
- Update security best practices
- Monitor for reported vulnerabilities

## Contact

For security-related questions or concerns:
- Email: security@your-domain.com
- GitHub Security Advisories: [View Advisories](https://github.com/bdaly101/AI-PR-Dev/security/advisories)

## Acknowledgments

We appreciate the security research community's efforts to keep this project secure. Security researchers who responsibly disclose vulnerabilities will be credited in security advisories.

---

**Last Updated**: 2025-01-XX

