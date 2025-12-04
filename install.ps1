# AI-PR-Dev Installation Script for Windows
# This script helps install AI-PR-Dev via npm or Docker

Write-Host "🚀 AI-PR-Dev Installation Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node -v
    Write-Host "✅ Node.js $nodeVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    Write-Host "   Visit: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check Node.js version
$majorVersion = [int](node -v).Substring(1).Split('.')[0]
if ($majorVersion -lt 18) {
    Write-Host "❌ Node.js version 18+ is required. Current version: $(node -v)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Ask for installation method
Write-Host "Select installation method:"
Write-Host "1) npm (global installation)"
Write-Host "2) npm (local installation)"
Write-Host "3) Docker"
Write-Host "4) From source"
$choice = Read-Host "Enter choice [1-4]"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Installing globally via npm..." -ForegroundColor Yellow
        npm install -g ai-pr-dev
        Write-Host ""
        Write-Host "✅ Installation complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Verify installation:"
        Write-Host "  ai-pr --version"
    }
    "2" {
        Write-Host ""
        Write-Host "Installing locally via npm..." -ForegroundColor Yellow
        npm install ai-pr-dev
        Write-Host ""
        Write-Host "✅ Installation complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Use via npx:"
        Write-Host "  npx ai-pr --version"
    }
    "3" {
        Write-Host ""
        Write-Host "Docker installation..." -ForegroundColor Yellow
        try {
            docker --version | Out-Null
        } catch {
            Write-Host "❌ Docker is not installed. Please install Docker first." -ForegroundColor Red
            Write-Host "   Visit: https://www.docker.com/get-started" -ForegroundColor Yellow
            exit 1
        }
        Write-Host ""
        Write-Host "Pulling Docker image..." -ForegroundColor Yellow
        docker pull ai-pr-dev:latest
        Write-Host ""
        Write-Host "✅ Docker image pulled!" -ForegroundColor Green
        Write-Host ""
        Write-Host "To run:"
        Write-Host "  docker run -d --name ai-pr-reviewer -p 3000:3000 ai-pr-dev:latest"
        Write-Host ""
        Write-Host "Don't forget to:"
        Write-Host "  1. Copy .env.example to .env"
        Write-Host "  2. Configure environment variables"
        Write-Host "  3. Set up your GitHub App"
    }
    "4" {
        Write-Host ""
        Write-Host "Installing from source..." -ForegroundColor Yellow
        if (-not (Test-Path "package.json")) {
            Write-Host "❌ package.json not found. Are you in the project directory?" -ForegroundColor Red
            exit 1
        }
        Write-Host ""
        Write-Host "Installing dependencies..." -ForegroundColor Yellow
        npm install
        Write-Host ""
        Write-Host "Building project..." -ForegroundColor Yellow
        npm run build
        Write-Host ""
        Write-Host "✅ Installation complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:"
        Write-Host "  1. Copy .env.example to .env"
        Write-Host "  2. Configure environment variables"
        Write-Host "  3. Set up your GitHub App"
        Write-Host "  4. Run: npm start"
    }
    default {
        Write-Host "❌ Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "📖 Next steps:" -ForegroundColor Cyan
Write-Host "  - Read the documentation: docs/getting-started.md"
Write-Host "  - Set up your GitHub App: docs/github-app-setup.md"
Write-Host "  - Configure environment variables: .env.example"
Write-Host ""
Write-Host "For help, visit: https://github.com/bdaly101/AI-PR-Dev" -ForegroundColor Cyan

