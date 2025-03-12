#!/bin/bash

# Initialize Git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit of MVG Display"

# If main is not the default branch name, create and switch to it
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  git branch -M main
fi

# Remote is already added, so push to GitHub
git push -u origin main

echo "Repository initialized and pushed to GitHub successfully!"
