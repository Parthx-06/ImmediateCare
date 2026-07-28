"""
retriever.py — Ultra-fast, lightweight RAG retriever for Patient Care instructions.
Uses TF-IDF + Keyword matching + Tag weighting. Consumes < 2MB RAM (Render Free Tier safe).
"""

import json
import math
import os
import re
from collections import Counter

BASE_DIR = os.path.dirname(__file__)
DATA_PATH = os.path.join(BASE_DIR, "data", "doctor_instructions.json")


class MedicalRetriever:
    """Lightweight TF-IDF + Tag Matching retriever."""

    def __init__(self, json_path: str = DATA_PATH):
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.instructions = data["instructions"]
        self.patient_id = data.get("patient_id", "")
        self.doctor = data.get("doctor", "")
        self.N = len(self.instructions)

        # Precompute document tokens & term frequencies
        self.doc_index = []
        self.df = Counter()

        for inst in self.instructions:
            # Combine title, category, tags, and content
            full_text = f"{inst['title']} {inst['category']} {' '.join(inst.get('tags', []))} {inst['content']}"
            tokens = self._tokenize(full_text)
            tf = Counter(tokens)

            self.doc_index.append({
                "inst": inst,
                "tokens": tokens,
                "tf": tf,
                "text_lower": full_text.lower(),
                "title_lower": inst["title"].lower(),
                "tags_lower": [t.lower() for t in inst.get("tags", [])],
                "category_lower": inst["category"].lower()
            })

            # Update document frequency
            for token in set(tokens):
                self.df[token] += 1

    def _tokenize(self, text: str) -> list:
        """Tokenize text into lowercased words."""
        return [w.lower() for w in re.findall(r'\b\w+\b', text) if len(w) > 1]

    def query(self, query_text: str, n_results: int = 5) -> list:
        """Search instructions matching the query, sorted by relevance."""
        query_tokens = self._tokenize(query_text)
        if not query_tokens:
            return []

        scored_docs = []

        for doc in self.doc_index:
            inst = doc["inst"]
            score = 0.0

            # 1. TF-IDF scoring for content tokens
            for token in query_tokens:
                if token in doc["tf"]:
                    tf_val = doc["tf"][token] / len(doc["tokens"])
                    idf_val = math.log((self.N + 1) / (self.df[token] + 1)) + 1
                    score += tf_val * idf_val * 3.0

                # 2. Heavy boost for tag matches
                for tag in doc["tags_lower"]:
                    if token in tag or tag in token:
                        score += 2.5

                # 3. Heavy boost for title matches
                if token in doc["title_lower"]:
                    score += 3.0

                # 4. Boost for category matches
                if token in doc["category_lower"]:
                    score += 1.5

            # 5. Domain-specific keyword intent boosts
            query_str = query_text.lower()
            
            # Diet intent
            if any(w in query_str for w in ["eat", "food", "diet", "avoid", "rice", "biryani", "fruit", "salt", "sugar", "drink"]):
                if inst["category"] in ["diet", "lifestyle"]:
                    score += 2.0
                if "avoid" in query_str and inst["id"] == "DIET-002":
                    score += 4.0
                if "eat" in query_str and inst["id"] == "DIET-003":
                    score += 4.0

            # Emergency intent
            if any(w in query_str for w in ["pain", "chest", "emergency", "stroke", "bleed", "urgent", "108"]):
                if inst["category"] == "emergency":
                    score += 4.0
                if inst.get("priority") == "critical":
                    score += 2.0

            # Medication intent
            if any(w in query_str for w in ["medicine", "tablet", "pill", "dose", "miss", "schedule", "time", "side effect"]):
                if inst["category"] in ["medication", "medication_schedule", "symptom_management"]:
                    score += 2.0

            # Activity / exercise intent
            if any(w in query_str for w in ["walk", "exercise", "work", "drive", "stair", "lift", "sex"]):
                if inst["category"] == "activity":
                    score += 2.5

            if score > 0:
                scored_docs.append((score, inst))

        # Sort by score descending
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        top_items = scored_docs[:n_results]

        # Format output to match ChromaDB response schema
        results = []
        max_score = scored_docs[0][0] if scored_docs else 1.0

        for score, inst in top_items:
            norm_rel = min(0.99, max(0.60, round(score / max_score, 3)))
            results.append({
                "id": inst["id"],
                "content": f"{inst['title']}\n\n{inst['content']}",
                "metadata": {
                    "title": inst["title"],
                    "category": inst["category"],
                    "priority": inst["priority"],
                    "tags": ", ".join(inst.get("tags", []))
                },
                "distance": round(1.0 - norm_rel, 3)
            })

        return results
