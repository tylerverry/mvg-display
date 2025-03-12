#!/bin/bash

# Pull remote changes while allowing unrelated histories to merge
git pull origin main --allow-unrelated-histories

# If there are merge conflicts, you'll need to resolve them
# After resolving conflicts (if any), commit the merge
git commit -m "Merge remote repository with local code"

# Now push your changes
git push -u origin main

echo "Repository synchronized successfully!"
