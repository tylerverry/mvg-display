#!/bin/bash

# Remove one-time use and debugging scripts
echo "Removing unnecessary scripts..."
rm -f diagnose-paths.sh
rm -f initialize-git.sh
rm -f create-repo.sh
rm -f create-github-repo.sh
rm -f git-fix.sh
rm -f direct-test.sh
rm -f test-bridge.sh
rm -f utils/mvg_direct_debug.py

# Remove temporary files
rm -f data/test-log.txt
rm -f test-log.txt

echo "Cleanup complete!"

# Make the cleanup script remove itself after execution
rm -- "$0"
