"""
retriever.py — High-precision, lightweight RAG retriever for Patient Care instructions.
Uses TF-IDF + Exact Word Matching + Tag & Title Weighting. Consumes < 2MB RAM.
"""

import json
import math
import os
import re
from collections import Counter

BASE_DIR = os.path.dirname(__file__)
DATA_PATH = os.path.join(BASE_DIR, "data", "doctor_instructions.json")

STOP_WORDS = {
    "how", "much", "many", "can", "should", "what", "when", "where", "which",
    "who", "whom", "this", "that", "these", "those", "am", "is", "are", "was",
    "were", "be", "been", "being", "have", "has", "had", "having", "do", "does",
    "did", "doing", "would", "could", "ought", "i", "you", "he", "she", "it",
    "we", "they", "them", "their", "the", "and", "but", "if", "or", "because",
    "as", "until", "while", "of", "at", "by", "for", "with", "about", "against",
    "between", "into", "through", "during", "before", "after", "above", "below",
    "to", "from", "up", "down", "in", "out", "on", "off", "over", "under",
    "again", "further", "then", "once", "here", "there", "all", "any", "both",
    "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not",
    "only", "own", "same", "so", "than", "too", "very", "s", "t", "just", "don",
    "now", "tell", "me", "give", "please", "my", "your"
}


class MedicalRetriever:
    """High-precision TF-IDF + Tag & Title Word-level retriever."""

    def __init__(self, json_path: str = DATA_PATH):
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.instructions = data["instructions"]
        self.patient_id = data.get("patient_id", "")
        self.doctor = data.get("doctor", "")
        self.N = len(self.instructions)

        self.doc_index = []
        self.df = Counter()

        for inst in self.instructions:
            tags_str = " ".join(inst.get("tags", []))
            full_text = f"{inst['title']} {inst['category']} {tags_str} {inst['content']}"
            tokens = self._tokenize(full_text)
            tf = Counter(tokens)

            title_words = set(self._tokenize(inst["title"]))
            tags_words = set(self._tokenize(tags_str))
            category_words = set(self._tokenize(inst["category"]))

            self.doc_index.append({
                "inst": inst,
                "tokens": tokens,
                "tf": tf,
                "text_lower": full_text.lower(),
                "title_words": title_words,
                "tags_words": tags_words,
                "category_words": category_words,
                "tags_phrases": [t.lower().strip() for t in inst.get("tags", [])],
                "id": inst["id"],
                "category": inst["category"]
            })

            for token in set(tokens):
                self.df[token] += 1

    def _tokenize(self, text: str) -> list:
        """Tokenize text into lowercase words."""
        return [w.lower() for w in re.findall(r'\b[a-zA-Z0-9_\-]{2,}\b', text)]

    def query(self, query_text: str, n_results: int = 5) -> list:
        """Search instructions matching the query, sorted by relevance."""
        raw_tokens = self._tokenize(query_text)
        # Filter stop words for scoring, but keep if query is very short
        query_tokens = [t for t in raw_tokens if t not in STOP_WORDS]
        if not query_tokens:
            query_tokens = raw_tokens
        if not query_tokens:
            return []

        query_str = query_text.lower()
        scored_docs = []

        for doc in self.doc_index:
            inst = doc["inst"]
            score = 0.0

            # 1. TF-IDF scoring for content tokens
            for token in query_tokens:
                if token in doc["tf"]:
                    tf_val = doc["tf"][token] / len(doc["tokens"])
                    idf_val = math.log((self.N + 1) / (self.df[token] + 1)) + 1.0
                    score += tf_val * idf_val * 5.0

                # 2. Word-level exact match in tags
                if token in doc["tags_words"]:
                    score += 4.0

                # 3. Word-level exact match in title
                if token in doc["title_words"]:
                    score += 5.0

                # 4. Word-level match in category
                if token in doc["category_words"]:
                    score += 2.0

            # Multi-word tag / phrase match
            for tag in doc["tags_phrases"]:
                if tag in query_str and len(tag) > 3:
                    score += 6.0

            # 5. Domain-specific intent boosts
            # Salt / Sodium Intent
            if any(w in query_str for w in ["salt", "sodium", "achaar", "papad"]):
                if inst["id"] in ["DIET-008", "DIET-004"]:
                    score += 8.0

            # Painkiller / NSAID Warning Intent
            if any(w in query_str for w in ["brufen", "combiflam", "voveran", "ibuprofen", "painkiller", "pain killer", "paracetamol", "dolo"]):
                if inst["id"] in ["MED-WARN-001", "SYM-001"]:
                    score += 8.0

            # Puncture / Wound site Intent
            if any(w in query_str for w in ["wrist", "groin", "puncture", "wound", "radial", "femoral"]):
                if inst["id"] in ["WOUND-004", "WOUND-005", "WOUND-001", "WOUND-002"]:
                    score += 7.0

            # Sorbitrate / Chest pain Intent
            if any(w in query_str for w in ["sorbitrate", "nitroglycerin", "chest pain", "angina", "tightness"]):
                if inst["id"] in ["EMERG-002", "EMERG-001", "MED-008"]:
                    score += 8.0

            # Travel / Flight / Driving Intent
            if any(w in query_str for w in ["flight", "fly", "plane", "travel", "driving", "drive"]):
                if inst["id"] in ["TRAVEL-002", "ACT-005"]:
                    score += 7.0

            # Emergency SOS Intent
            if any(w in query_str for w in ["108", "ambulance", "emergency", "hospital", "critical"]):
                if inst["category"] == "emergency" or inst.get("priority") == "critical":
                    score += 5.0

            if score > 0:
                scored_docs.append((score, inst))

        if not scored_docs:
            return []

        scored_docs.sort(key=lambda x: x[0], reverse=True)
        top_items = scored_docs[:n_results]

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
