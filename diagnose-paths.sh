#!/bin/bash

echo "===== PATH AND PERMISSION DIAGNOSTIC ====="
echo "Running as user: $(whoami)"
echo "Current directory: $(pwd)"

echo -e "\n===== DIRECTORY STRUCTURE ====="
echo "Listing /app directory:"
ls -la /app 2>/dev/null || echo "Cannot access /app directory"

echo -e "\nListing current directory:"
ls -la ./

echo -e "\nListing data directory:"
ls -la ./data 2>/dev/null || echo "Data directory doesn't exist"

echo -e "\n===== TESTING WRITE PERMISSIONS ====="
# Try writing to various locations to see which work
echo "Testing write to ./test-log.txt"
echo "Test content" > ./test-log.txt && echo "✅ SUCCESS" || echo "❌ FAILED"

echo "Testing write to ./data/test-log.txt"
mkdir -p ./data
echo "Test content" > ./data/test-log.txt && echo "✅ SUCCESS" || echo "❌ FAILED"

echo "Testing write to /app/data/test-log.txt"
mkdir -p /app/data 2>/dev/null
echo "Test content" > /app/data/test-log.txt 2>/dev/null && echo "✅ SUCCESS" || echo "❌ FAILED"

echo -e "\n===== MOUNT POINTS ====="
mount | grep -e "/app" -e "$(pwd)" || echo "No specific mount points found"

echo -e "\n===== ENVIRONMENT ====="
env | grep -E 'PATH|HOME|USER|LOG'

echo "===== DIAGNOSTIC COMPLETE ====="
