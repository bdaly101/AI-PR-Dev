# Contributing to AI-PR-Dev

Thank you for your interest in contributing to AI-PR-Dev! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/bdaly101/AI-PR-Dev/issues)
2. If not, create a new issue using the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md)
3. Include:
   - Clear description of the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (Node.js version, OS, etc.)
   - Relevant logs or error messages

### Suggesting Features

1. Check if the feature has already been suggested in [Issues](https://github.com/bdaly101/AI-PR-Dev/issues) or [Discussions](https://github.com/bdaly101/AI-PR-Dev/discussions)
2. Create a new issue using the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md)
3. Include:
   - Clear description of the feature
   - Use cases and benefits
   - Potential implementation approach (if you have ideas)

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Run linting (`npm run lint`)
7. Update documentation if needed
8. Commit your changes (`git commit -m 'Add amazing feature'`)
9. Push to your branch (`git push origin feature/amazing-feature`)
10. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 18+ and npm 9+
- Git
- A GitHub account

### Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/bdaly101/AI-PR-Dev.git
   cd AI-PR-Dev
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Run tests**
   ```bash
   npm test
   ```

### Development Workflow

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes**
   - Write code following the style guidelines below
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   # Run tests
   npm test
   
   # Run linting
   npm run lint
   
   # Type check
   npm run type-check
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "Description of your changes"
   ```
   
   Commit messages should:
   - Be clear and descriptive
   - Use present tense ("Add feature" not "Added feature")
   - Reference issue numbers if applicable ("Fix #123")

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Follow the existing code style
- Use meaningful variable and function names
- Add JSDoc comments for public functions
- Prefer `const` over `let`, avoid `var`
- Use async/await over promises where possible

### Code Formatting

- Use 2 spaces for indentation
- Use single quotes for strings (unless escaping)
- Add trailing commas in multi-line objects/arrays
- Maximum line length: 100 characters

### File Structure

- One class/interface per file
- Use kebab-case for file names
- Group related files in directories
- Keep files focused and small

### Example

```typescript
/**
 * Processes a pull request review request
 * @param prNumber - The pull request number
 * @param installationId - The GitHub App installation ID
 * @returns Review result
 */
export async function processReview(
  prNumber: number,
  installationId: number
): Promise<ReviewResult> {
  // Implementation
}
```

## Testing

### Writing Tests

- Write tests for all new functionality
- Use descriptive test names
- Follow the Arrange-Act-Assert pattern
- Test both success and error cases
- Mock external dependencies

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';

describe('functionName', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = functionName(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

## Documentation

### Code Documentation

- Add JSDoc comments for public functions and classes
- Document parameters and return values
- Include usage examples for complex functions

### User Documentation

- Update relevant documentation files in `docs/`
- Add examples where helpful
- Keep documentation up to date with code changes

## Pull Request Process

1. **Ensure your PR:**
   - Has a clear title and description
   - References related issues
   - Includes tests for new features
   - Passes all CI checks
   - Updates documentation if needed

2. **PR Title Format:**
   - `feat: Add new feature`
   - `fix: Fix bug description`
   - `docs: Update documentation`
   - `refactor: Refactor code`
   - `test: Add tests`

3. **PR Description should include:**
   - What changes were made
   - Why the changes were made
   - How to test the changes
   - Screenshots (if UI changes)

4. **Review Process:**
   - Maintainers will review your PR
   - Address any feedback
   - Once approved, a maintainer will merge

## Project Structure

```
AI-PR-Dev/
├── src/              # Source code
│   ├── ai/          # AI-related code
│   ├── api/         # API routes
│   ├── cli/         # CLI commands
│   ├── config/      # Configuration
│   ├── database/    # Database code
│   ├── github/      # GitHub integration
│   ├── services/    # Business logic
│   └── utils/       # Utilities
├── tests/           # Tests
├── docs/            # Documentation
├── dashboard/       # Dashboard app
└── scripts/         # Build scripts
```

## Areas for Contribution

- 🐛 Bug fixes
- ✨ New features
- 📚 Documentation improvements
- 🧪 Test coverage
- 🎨 UI/UX improvements
- ⚡ Performance optimizations
- 🔒 Security improvements
- 🌐 Internationalization

## Getting Help

- Check [Documentation](docs/)
- Search [Issues](https://github.com/bdaly101/AI-PR-Dev/issues)
- Ask in [Discussions](https://github.com/bdaly101/AI-PR-Dev/discussions)
- Review [FAQ](docs/faq.md)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing to AI-PR-Dev! 🎉

