#!/bin/bash

# Remove one-time use scripts from Git
git rm diagnose-paths.sh
git rm initialize-git.sh
git rm create-repo.sh
git rm create-github-repo.sh
git rm git-fix.sh
git rm direct-test.sh
git rm test-bridge.sh
git rm utils/mvg_direct_debug.py

# Remove temporary files
git rm -f data/test-log.txt
git rm -f test-log.txt

# Commit the removal
git commit -m "Remove temporary scripts and debug files"

echo "Git repository cleaned up successfully!"

# Make this script remove itself after execution
rm -- "$0"
