#!/bin/bash

# You need a GitHub personal access token with repo scope
# https://github.com/settings/tokens/new
read -p "Enter your GitHub personal access token: " TOKEN

# Create repository via GitHub API
curl -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d '{
    "name": "mvg-display",
    "description": "MVG public transport display application",
    "private": false
  }'

# Set the remote and push
git remote set-url origin https://github.com/tylerverry/mvg-display.git
git push -u origin main

echo "Repository created and code pushed successfully!"
