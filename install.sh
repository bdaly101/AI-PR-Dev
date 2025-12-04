#!/bin/bash

# AI-PR-Dev Installation Script
# This script helps install AI-PR-Dev via npm or Docker

set -e

echo "🚀 AI-PR-Dev Installation Script"
echo "================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Ask for installation method
echo "Select installation method:"
echo "1) npm (global installation)"
echo "2) npm (local installation)"
echo "3) Docker"
echo "4) From source"
read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        echo ""
        echo "Installing globally via npm..."
        npm install -g ai-pr-dev
        echo ""
        echo "✅ Installation complete!"
        echo ""
        echo "Verify installation:"
        echo "  ai-pr --version"
        ;;
    2)
        echo ""
        echo "Installing locally via npm..."
        npm install ai-pr-dev
        echo ""
        echo "✅ Installation complete!"
        echo ""
        echo "Use via npx:"
        echo "  npx ai-pr --version"
        ;;
    3)
        echo ""
        echo "Docker installation..."
        if ! command -v docker &> /dev/null; then
            echo "❌ Docker is not installed. Please install Docker first."
            echo "   Visit: https://www.docker.com/get-started"
            exit 1
        fi
        echo ""
        echo "Pulling Docker image..."
        docker pull ai-pr-dev:latest
        echo ""
        echo "✅ Docker image pulled!"
        echo ""
        echo "To run:"
        echo "  docker run -d --name ai-pr-reviewer -p 3000:3000 ai-pr-dev:latest"
        echo ""
        echo "Don't forget to:"
        echo "  1. Copy .env.example to .env"
        echo "  2. Configure environment variables"
        echo "  3. Set up your GitHub App"
        ;;
    4)
        echo ""
        echo "Installing from source..."
        if [ ! -f "package.json" ]; then
            echo "❌ package.json not found. Are you in the project directory?"
            exit 1
        fi
        echo ""
        echo "Installing dependencies..."
        npm install
        echo ""
        echo "Building project..."
        npm run build
        echo ""
        echo "✅ Installation complete!"
        echo ""
        echo "Next steps:"
        echo "  1. Copy .env.example to .env"
        echo "  2. Configure environment variables"
        echo "  3. Set up your GitHub App"
        echo "  4. Run: npm start"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "📖 Next steps:"
echo "  - Read the documentation: docs/getting-started.md"
echo "  - Set up your GitHub App: docs/github-app-setup.md"
echo "  - Configure environment variables: .env.example"
echo ""
echo "For help, visit: https://github.com/bdaly101/AI-PR-Dev"

