"""
seed_data.py — Loads doctor instructions into ChromaDB vector store.
Run this once before starting the application.
"""

import json
import os
import chromadb

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
CHROMA_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")


def seed_database():
    """Load doctor instructions into ChromaDB with metadata."""

    # Load doctor instructions
    instructions_path = os.path.join(DATA_DIR, "doctor_instructions.json")
    with open(instructions_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    instructions = data["instructions"]
    print(f"[INFO] Loaded {len(instructions)} doctor instructions")

    # Initialize ChromaDB with persistent storage
    client = chromadb.PersistentClient(path=CHROMA_DIR)

    # Delete existing collection if it exists (for re-seeding)
    try:
        client.delete_collection("doctor_instructions")
        print("[INFO] Deleted existing collection")
    except Exception:
        pass

    # Create collection — ChromaDB uses all-MiniLM-L6-v2 by default for embeddings
    collection = client.create_collection(
        name="doctor_instructions",
        metadata={"description": "Post-angioplasty care instructions from Dr. Srinivas Rao"}
    )

    # Prepare documents for insertion
    documents = []
    metadatas = []
    ids = []

    for instr in instructions:
        # Combine title and content for richer embeddings
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

    # Add all documents to ChromaDB
    collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )

    print(f"[OK] Successfully seeded {len(documents)} instructions into ChromaDB")
    print(f"[INFO] Database stored at: {CHROMA_DIR}")

    # Verify by running a test query
    print("\n[TEST] Query: 'chest pain emergency'")
    results = collection.query(
        query_texts=["chest pain emergency"],
        n_results=3
    )
    for i, (doc_id, dist) in enumerate(zip(results["ids"][0], results["distances"][0])):
        meta = results["metadatas"][0][i]
        print(f"   {i+1}. [{meta['category']}] {meta['title']} (distance: {dist:.4f})")

    print("\n[TEST] Query: 'what can I eat'")
    results = collection.query(
        query_texts=["what can I eat for diet"],
        n_results=3
    )
    for i, (doc_id, dist) in enumerate(zip(results["ids"][0], results["distances"][0])):
        meta = results["metadatas"][0][i]
        print(f"   {i+1}. [{meta['category']}] {meta['title']} (distance: {dist:.4f})")

    print("\n[DONE] Seeding complete! You can now run: python app.py")


if __name__ == "__main__":
    seed_database()
