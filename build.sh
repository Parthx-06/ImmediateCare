#!/usr/bin/env bash
# build.sh — Render build script
# Installs dependencies and seeds the ChromaDB vector database.

set -o errexit

pip install --upgrade pip
pip install -r requirements.txt

# Seed the ChromaDB vector store with doctor instructions
python seed_data.py
