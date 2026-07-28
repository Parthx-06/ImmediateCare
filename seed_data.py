"""
seed_data.py — Loads doctor instructions into ChromaDB vector store if chromadb is installed.
"""

import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
CHROMA_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")


def seed_database():
    """Load doctor instructions into ChromaDB with metadata if chromadb is available."""
    try:
        import chromadb
    except ImportError:
        print("[INFO] chromadb is not installed. Skipping ChromaDB seeding. MedicalRetriever will be used instead.")
        return

    # Load doctor instructions
    instructions_path = os.path.join(DATA_DIR, "doctor_instructions.json")
    with open(instructions_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    instructions = data["instructions"]
    print(f"[INFO] Loaded {len(instructions)} doctor instructions")

    client = chromadb.PersistentClient(path=CHROMA_DIR)

    try:
        client.delete_collection("doctor_instructions")
        print("[INFO] Deleted existing collection")
    except Exception:
        pass

    collection = client.create_collection(
        name="doctor_instructions",
        metadata={"description": "Post-angioplasty care instructions from Dr. Srinivas Rao"}
    )

    documents = []
    metadatas = []
    ids = []

    for instr in instructions:
        doc_text = f"{instr['title']}\n\n{instr['content']}"
        documents.append(doc_text)
        metadatas.append({
            "category": instr["category"],
            "priority": instr["priority"],
            "title": instr["title"],
            "tags": ", ".join(instr["tags"]),
            "patient_id": data["patient_id"]
        })
        ids.append(instr["id"])

    collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )

    print(f"[OK] Successfully seeded {len(documents)} instructions into ChromaDB")


if __name__ == "__main__":
    seed_database()
