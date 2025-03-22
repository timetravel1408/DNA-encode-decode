#!/bin/bash

# Create a temporary directory for packaging
mkdir -p dna-encoder-temp

# Copy all project files
cp -r backend frontend docs LICENSE README.md requirements.txt setup.sh package.sh dna-encoder-temp/

# Create zip file
zip -r dna-encoder.zip dna-encoder-temp/

# Clean up
rm -rf dna-encoder-temp

echo "Project has been packaged into dna-encoder.zip" 