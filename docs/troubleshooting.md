# Troubleshooting Guide

Common issues and their solutions.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Configuration Issues](#configuration-issues)
- [Webhook Issues](#webhook-issues)
- [API Issues](#api-issues)
- [Review Issues](#review-issues)
- [Performance Issues](#performance-issues)

## Installation Issues

### Node.js Version Mismatch

**Error**: `The engine "node" is incompatible with this module`

**Solution**:
```bash
# Check Node.js version
node --version

# Should be 18+
# Use nvm to switch versions
nvm use 20
```

### Build Errors

**Error**: TypeScript compilation fails

**Solution**:
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Missing Dependencies

**Error**: `Cannot find module`

**Solution**:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## Configuration Issues

### Environment Variables Not Loading

**Symptom**: App can't find required environment variables

**Solution**:
1. Verify `.env` file exists: `ls -la .env`
2. Check file format (no spaces around `=`)
3. Ensure variables are not quoted incorrectly
4. Restart the server after changing `.env`

### GitHub App Credentials Invalid

**Error**: `Invalid GitHub App credentials`

**Solution**:
1. Verify `GITHUB_APP_ID` is correct
2. Check `GITHUB_PRIVATE_KEY` includes newlines (`\n`)
3. Ensure private key is complete (starts with `-----BEGIN RSA PRIVATE KEY-----`)
4. Regenerate key if needed

### API Keys Not Working

**Error**: `Invalid API key` or `Rate limit exceeded`

**Solution**:
1. Verify API key is correct
2. Check API quota/limits
3. Ensure you have access to GPT-4 (not just GPT-3.5)
4. Try regenerating the API key

## Webhook Issues

### Webhooks Not Received

**Symptom**: PRs aren't being reviewed automatically

**Diagnosis**:
1. Check GitHub App webhook URL is correct
2. Verify webhook secret matches
3. Check GitHub's webhook delivery logs
4. Ensure server is accessible from internet

**Solution**:
```bash
# For local development, use ngrok
ngrok http 3000

# Update webhook URL in GitHub App settings
# Use the ngrok URL: https://your-id.ngrok.io/webhooks/github
```

### Webhook Signature Verification Failed

**Error**: `Webhook signature verification failed`

**Solution**:
1. Verify `GITHUB_WEBHOOK_SECRET` matches GitHub App settings
2. Check secret doesn't have extra spaces
3. Regenerate secret if needed

### Webhook Delivery Failures

**Symptom**: GitHub shows webhook delivery failures

**Solution**:
1. Check server logs for errors
2. Verify server is running and accessible
3. Check firewall/network settings
4. Ensure HTTPS is used in production

## API Issues

### API Endpoints Not Responding

**Symptom**: CLI/API calls fail

**Solution**:
```bash
# Check server is running
curl http://localhost:3000/health

# Check server logs
# Look for errors in console or log files
```

### Authentication Errors

**Error**: `Unauthorized` or `Invalid API key`

**Solution**:
1. Verify `API_KEY` is set (if required)
2. Check API key in request header/query
3. Ensure API key matches server configuration

### Rate Limiting

**Error**: `Rate limit exceeded`

**Solution**:
1. Reduce request frequency
2. Increase rate limit in configuration
3. Use caching where possible
4. Check API provider rate limits

## Review Issues

### Reviews Not Appearing

**Symptom**: PRs aren't getting reviewed

**Solution**:
1. Check app is installed on repository
2. Verify app has required permissions
3. Check server logs for errors
4. Ensure webhook is configured correctly

### Reviews Taking Too Long

**Symptom**: Reviews take several minutes

**Solution**:
1. Large PRs take longer - this is normal
2. Check API response times
3. Use configuration to limit files reviewed
4. Consider using faster models for simple reviews

### Incomplete Reviews

**Symptom**: Reviews missing some files

**Solution**:
1. Check `maxFilesReviewed` in configuration
2. Verify files aren't in `ignorePaths`
3. Check for API errors in logs
4. Large files may be skipped

### Poor Review Quality

**Symptom**: Reviews aren't helpful

**Solution**:
1. Adjust `strictness` in configuration
2. Provide better PR descriptions
3. Use more specific AI models
4. Adjust `temperature` for more/less creative reviews

## Performance Issues

### High Memory Usage

**Symptom**: Server using too much memory

**Solution**:
1. Limit `maxFilesReviewed` in configuration
2. Reduce concurrent reviews
3. Increase server memory
4. Use database cleanup scripts

### Slow Response Times

**Symptom**: API calls are slow

**Solution**:
1. Check database performance
2. Optimize queries
3. Use caching where possible
4. Check network latency to API providers

### Database Issues

**Error**: Database locked or corrupted

**Solution**:
```bash
# Backup database
cp data/app.db data/app.db.backup

# Check database integrity
sqlite3 data/app.db "PRAGMA integrity_check;"

# Rebuild if needed
rm data/app.db
# Server will create new database on startup
```

## Cursor Integration Issues

### Tools Not Showing Up

**Symptom**: MCP tools not available in Cursor

**Solution**:
1. Restart Cursor completely (not just reload)
2. Check MCP configuration file exists
3. Verify paths are correct
4. Check Cursor developer console for errors

### MCP Server Not Starting

**Error**: MCP server fails to start

**Solution**:
1. Verify `dist/mcp/server.js` exists
2. Check Node.js is in PATH
3. Verify environment variables are set
4. Test server manually: `node dist/mcp/server.js`

## Docker Issues

### Container Won't Start

**Error**: Container exits immediately

**Solution**:
```bash
# Check logs
docker logs ai-pr-reviewer

# Verify environment variables
docker exec ai-pr-reviewer env

# Check container health
docker ps -a
```

### Volume Mount Issues

**Error**: Database not persisting

**Solution**:
1. Verify volume is mounted correctly
2. Check volume permissions
3. Use named volumes instead of bind mounts
4. Verify volume path in container

## Getting Help

If you're still having issues:

1. **Check Logs**: Review server logs for errors
2. **Search Issues**: Check [GitHub Issues](https://github.com/bdaly101/AI-PR-Dev/issues)
3. **Ask for Help**: Start a [Discussion](https://github.com/bdaly101/AI-PR-Dev/discussions)
4. **Report Bug**: Open an issue with:
   - Error messages
   - Steps to reproduce
   - Environment details
   - Relevant logs

## Common Error Messages

### `Environment variable X is required but not set`

**Solution**: Set the missing environment variable in `.env`

### `Invalid GitHub App credentials`

**Solution**: Verify GitHub App ID and private key

### `Review not found`

**Solution**: PR hasn't been reviewed yet, or review was deleted

### `Missing installationId`

**Solution**: Provide installation ID in API calls or CLI commands

### `Webhook signature verification failed`

**Solution**: Check webhook secret matches GitHub App settings

## Debug Mode

Enable debug logging:

```bash
# Set log level
export LOG_LEVEL=debug

# Or in .env
LOG_LEVEL=debug

# Restart server
npm start
```

## Health Checks

Test server health:

```bash
# Health endpoint
curl http://localhost:3000/health

# Should return:
# {"status":"ok","timestamp":"..."}
```

## Still Need Help?

- 📖 [Documentation](.)
- 💬 [Discussions](https://github.com/bdaly101/AI-PR-Dev/discussions)
- 🐛 [Issue Tracker](https://github.com/bdaly101/AI-PR-Dev/issues)
- ❓ [FAQ](faq.md)

