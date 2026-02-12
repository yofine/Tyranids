#!/bin/bash

# Install Tyranids swarm skills to Claude Code

SKILLS_DIR="$HOME/.pi/agent/skills/tyranids"

echo "🦎 Installing Tyranids swarm skills..."
echo ""

# Create skills directory
mkdir -p "$SKILLS_DIR"

# Copy skill files
if [ -d "skills" ]; then
  cp skills/*.md "$SKILLS_DIR/" 2>/dev/null || true
  echo "✅ Copied skill definitions to $SKILLS_DIR"
else
  echo "⚠️  Skills directory not found (will be created in Phase 6)"
fi

# Build the package
if [ -f "package.json" ]; then
  npm run build
  echo "✅ Built swarm-skills package"
fi

echo ""
echo "📦 Installation complete!"
echo ""
echo "Available skills:"
echo "  /swarm-spawn     - Generate swarm to explore solutions"
echo "  /swarm-query     - Query swarm status"
echo "  /swarm-report    - Generate execution report"
echo "  /swarm-consume   - Consume genes and evolve"
echo ""
echo "Example:"
echo "  /swarm-spawn task=\"Add priority field to Todo\" file=\"src/todo.ts\" agents=5"
