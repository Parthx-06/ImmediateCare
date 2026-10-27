"""
app.py — Flask backend for Patient Care RAG Application.
Provides a RAG pipeline using ChromaDB + Groq LLM for post-angioplasty patient care.
"""

import json
import os
import sys
from datetime import datetime

# Fix Windows cp1252 encoding issues with emoji/unicode in print/logs
def safe_print(*args, **kwargs):
    """Print that NEVER crashes, regardless of encoding or stream availability."""
    try:
        msg = " ".join(str(a) for a in args) + "\n"
        try:
            # Try writing directly to buffer (bypasses text codec)
            sys.stdout.buffer.write(msg.encode("utf-8", errors="replace"))
            sys.stdout.buffer.flush()
        except Exception:
            try:
                # Fallback: encode to ASCII with replacement
                sys.stdout.write(msg.encode("ascii", errors="replace").decode("ascii"))
                sys.stdout.flush()
            except Exception:
                pass  # Completely silent fallback
    except Exception:
        pass

from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
from groq import Groq

from retriever import MedicalRetriever

# ─── Configuration ──────────────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
CHROMA_DIR = os.path.join(BASE_DIR, "chroma_db")
MEMORY_DIR = os.path.join(BASE_DIR, "memory")

# Ensure memory directory exists
os.makedirs(MEMORY_DIR, exist_ok=True)

# ─── Flask App ───────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)

# ─── Initialize Retriever ───────────────────────────────────────────────────────

medical_retriever = None
try:
    medical_retriever = MedicalRetriever()
    print(f"[OK] MedicalRetriever loaded: {medical_retriever.N} instructions in database")
except Exception as e:
    print(f"[WARN] Failed to load MedicalRetriever: {e}")

# Optional ChromaDB fallback
chroma_client = None
collection = None
try:
    import chromadb
    chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
    collection = chroma_client.get_collection("doctor_instructions")
    print(f"[OK] ChromaDB loaded: {collection.count()} instructions in database")
except Exception:
    collection = None

# ─── Load Patient Profile ───────────────────────────────────────────────────────

patient_profile_path = os.path.join(DATA_DIR, "patient_profile.json")
with open(patient_profile_path, "r", encoding="utf-8") as f:
    patient_profile = json.load(f)

PATIENT_ID = patient_profile["patient_id"]
print(f"[INFO] Patient loaded: {patient_profile['name']} ({PATIENT_ID})")

# ─── Load Environment Variables ──────────────────────────────────────────────────

env_file = os.path.join(BASE_DIR, ".env")
if os.path.exists(env_file):
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip() and not line.startswith("#") and "=" in line:
                k, v = line.strip().split("=", 1)
                os.environ[k.strip()] = v.strip().strip("'\"")

# ─── Initialize Groq Client ─────────────────────────────────────────────────────

groq_api_key = os.environ.get("GROQ_API_KEY", "")
groq_client = None

if groq_api_key:
    try:
        groq_client = Groq(api_key=groq_api_key)
        print("[OK] Groq API initialized with configured key")
    except Exception as e:
        print(f"[WARN] Failed to initialize Groq client: {e}")
else:
    print("[WARN] GROQ_API_KEY not set. Set it via environment variable or .env file.")



# ─── Memory Manager ─────────────────────────────────────────────────────────────

def get_memory_path(patient_id: str) -> str:
    return os.path.join(MEMORY_DIR, f"patient_{patient_id}_history.json")


def load_memory(patient_id: str) -> list:
    """Load conversation history for a patient."""
    path = get_memory_path(patient_id)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_memory(patient_id: str, history: list):
    """Save conversation history for a patient."""
    path = get_memory_path(patient_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def add_to_memory(patient_id: str, query: str, response: str, sources: list):
    """Add a conversation turn to patient memory."""
    history = load_memory(patient_id)
    history.append({
        "timestamp": datetime.now().isoformat(),
        "query": query,
        "response": response,
        "sources": sources
    })
    save_memory(patient_id, history)
    return history


# ─── RAG Pipeline ────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a caring, knowledgeable post-operative care assistant for {patient_name}, a {age}-year-old {gender} patient who had coronary angioplasty (stent placement) on {procedure_date}.

YOUR ROLE:
- You are NOT a doctor. You are an assistant that provides information ONLY based on the doctor's instructions stored in the database.
- You help the patient understand their care plan, medications, diet, activity restrictions, and what to do in various situations.
- You respond with empathy, warmth, and in simple language that the patient can understand.
- You address the patient by name (Rajesh ji / Rajesh Kumar ji) to make the conversation personal.

CRITICAL RULES:
1. ONLY answer based on the doctor's instructions provided in the CONTEXT below. Do not make up medical advice.
2. If the question is NOT covered in the context, say: "This is not covered in your doctor's instructions. Please call Dr. Srinivas Rao at +91-9876543210 for guidance on this."
3. For ANY emergency symptoms (chest pain, severe bleeding, stroke signs), ALWAYS emphasize urgency and provide the emergency protocol.
4. Always mention specific medicine names, dosages, and timings when relevant.
5. If the patient mentions a symptom, provide the relevant management advice AND mention when they should escalate to the doctor or ER.
6. Refer to past conversations when relevant to show continuity of care.

PATIENT PROFILE:
- Name: {patient_name}
- Age: {age}, Gender: {gender}, Blood Group: {blood_group}
- Procedure: {procedure_details}
- Medical History: {medical_history}
- Allergies: {allergies}
- Doctor: {doctor_name} (Phone: {doctor_phone})
- Next Follow-up: {next_followup}

CONVERSATION HISTORY (last interactions):
{conversation_history}

RELEVANT DOCTOR'S INSTRUCTIONS (from database):
{context}

Respond naturally, warmly, and helpfully. Use bullet points or numbered lists for medication schedules and action steps. Include relevant warnings where appropriate. Keep responses clear but comprehensive."""


def build_system_prompt(context_docs: list, conversation_history: list) -> str:
    """Build the system prompt with patient profile, context, and history."""

    # Format context from retrieved documents
    context_parts = []
    for i, doc in enumerate(context_docs):
        meta = doc["metadata"]
        priority_badge = {"critical": "🔴 CRITICAL", "high": "🟠 HIGH", "medium": "🟡 MEDIUM", "low": "🟢 LOW"}
        badge = priority_badge.get(meta.get("priority", "medium"), "🟡")
        context_parts.append(f"[{badge}] [{meta.get('category', 'general').upper()}] {doc['content']}")

    context_text = "\n\n---\n\n".join(context_parts) if context_parts else "No relevant instructions found."

    # Format conversation history (last 10 turns)
    recent_history = conversation_history[-10:] if conversation_history else []
    history_parts = []
    for turn in recent_history:
        history_parts.append(f"Patient: {turn['query']}\nAssistant: {turn['response'][:200]}...")

    history_text = "\n\n".join(history_parts) if history_parts else "No previous conversations."

    # Get next follow-up
    next_followup = "Not scheduled"
    today = datetime.now().date()
    for fu in patient_profile.get("follow_up_schedule", []):
        fu_date = datetime.strptime(fu["date"], "%Y-%m-%d").date()
        if fu_date >= today:
            next_followup = f"{fu['date']} — {fu['type']} with {fu['doctor']}"
            break

    return SYSTEM_PROMPT.format(
        patient_name=patient_profile["name"],
        age=patient_profile["age"],
        gender=patient_profile["gender"],
        blood_group=patient_profile["blood_group"],
        procedure_date=patient_profile["procedure"]["date"],
        procedure_details=patient_profile["procedure"]["details"],
        medical_history=", ".join(patient_profile["medical_history"]),
        allergies=", ".join(patient_profile["allergies"]),
        doctor_name=patient_profile["procedure"]["doctor"],
        doctor_phone=patient_profile["procedure"]["doctor_phone"],
        next_followup=next_followup,
        conversation_history=history_text,
        context=context_text
    )


def retrieve_context(query: str, n_results: int = 5) -> list:
    """Retrieve relevant doctor instructions using MedicalRetriever (or ChromaDB fallback)."""
    if medical_retriever is not None:
        try:
            return medical_retriever.query(query, n_results=n_results)
        except Exception as e:
            safe_print(f"[WARN] MedicalRetriever query failed: {e}")

    if collection is not None:
        try:
            results = collection.query(
                query_texts=[query],
                n_results=n_results
            )

            docs = []
            for i in range(len(results["ids"][0])):
                docs.append({
                    "id": results["ids"][0][i],
                    "content": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "distance": results["distances"][0][i]
                })
            return docs
        except Exception as e:
            safe_print(f"[WARN] ChromaDB query failed: {e}")

    return []


def generate_response(query: str) -> dict:
    """Full RAG pipeline: retrieve context → build prompt → generate response."""
    global groq_client

    if groq_client is None:
        api_key = os.environ.get("GROQ_API_KEY", "").strip()
        if api_key:
            try:
                from groq import Groq
                groq_client = Groq(api_key=api_key)
                safe_print("[OK] Groq client initialized on demand from environment variable")
            except Exception as e:
                safe_print(f"[ERROR] Failed to init Groq client: {e}")

    if groq_client is None:
        return {
            "response": "⚠️ Groq API key is not configured on Render. Please add GROQ_API_KEY under Render Environment settings.",
            "sources": [],
            "error": True
        }

    if medical_retriever is None and collection is None:
        return {
            "response": "⚠️ Database not initialized.",
            "sources": [],
            "error": True
        }

    try:
        # Step 1: Retrieve relevant context from ChromaDB
        context_docs = retrieve_context(query, n_results=5)

        # Step 2: Load patient conversation history
        conversation_history = load_memory(PATIENT_ID)

        # Step 3: Build system prompt
        system_prompt = build_system_prompt(context_docs, conversation_history)

        # Step 4: Call Groq LLM
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query}
            ],
            model="openai/gpt-oss-120b",
            temperature=0.3,
            max_tokens=1024,
            top_p=0.9
        )

        response_text = chat_completion.choices[0].message.content

        # Step 5: Format sources
        sources = []
        for doc in context_docs:
            sources.append({
                "id": doc["id"],
                "title": doc["metadata"].get("title", ""),
                "category": doc["metadata"].get("category", ""),
                "priority": doc["metadata"].get("priority", ""),
                "relevance": round(1 - doc["distance"], 3)  # Convert distance to similarity
            })

        # Step 6: Save to patient memory
        try:
            add_to_memory(PATIENT_ID, query, response_text, [s["id"] for s in sources])
        except Exception as mem_err:
            safe_print(f"[WARN] Failed to save memory: {mem_err}")

        return {
            "response": response_text,
            "sources": sources,
            "error": False
        }

    except Exception as e:
        safe_print(f"[ERROR] RAG Pipeline exception: {e}")
        return {
            "response": f"⚠️ Server Error processing request: {str(e)}",
            "sources": [],
            "error": True
        }


# ─── Global Error Handler ────────────────────────────────────────────────────────

import traceback as _traceback

@app.errorhandler(Exception)
def handle_exception(e):
    """Catch all unhandled exceptions, log to file, return JSON."""
    tb = _traceback.format_exc()
    try:
        log_path = os.path.join(BASE_DIR, "error_log.txt")
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"\n{'='*60}\n{datetime.now().isoformat()}\n{tb}\n")
    except Exception:
        pass
    safe_print(f"[UNHANDLED ERROR] {tb[:300]}")
    return jsonify({"response": f"Server error: {str(e)}", "sources": [], "error": True}), 500


# ─── API Routes ──────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the main landing page website."""
    return render_template("index.html")


@app.route("/chat")
def chat_page():
    """Serve the AI chat assistant interface."""
    return render_template("chat.html")



@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint — use this to verify Render deployment."""
    return jsonify({
        "status": "ok",
        "groq_configured": groq_client is not None,
        "retriever_ready": medical_retriever is not None or collection is not None,
        "retriever_count": medical_retriever.N if medical_retriever else (collection.count() if collection else 0),
        "patient": patient_profile.get("name", "unknown"),
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    """Main RAG chat endpoint."""
    try:
        data = request.get_json()
        query = data.get("query", "").strip()

        if not query:
            return jsonify({"error": "Query cannot be empty"}), 400

        safe_print(f"[CHAT] Query: {query[:100]}...")
        result = generate_response(query)
        if result.get("error"):
            safe_print(f"[CHAT ERROR] {str(result.get('response', ''))[:100]}")
        else:
            safe_print(f"[CHAT OK] Response length: {len(result['response'])} chars")
        return jsonify(result)
    except Exception as exc:
        import traceback
        tb = traceback.format_exc()
        log_path = os.path.join(BASE_DIR, "error_log.txt")
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(f"\n{'='*60}\n{datetime.now().isoformat()}\n{tb}\n")
        except Exception:
            pass
        return jsonify({"response": f"Server error: {str(exc)}", "sources": [], "error": True}), 500



@app.route("/api/patient", methods=["GET"])
def get_patient():
    """Return patient profile data."""
    return jsonify(patient_profile)


@app.route("/api/history", methods=["GET"])
def get_history():
    """Return conversation history."""
    history = load_memory(PATIENT_ID)
    return jsonify({"history": history})


@app.route("/api/clear-history", methods=["POST"])
def clear_history():
    """Clear conversation history."""
    path = get_memory_path(PATIENT_ID)
    if os.path.exists(path):
        os.remove(path)
    return jsonify({"message": "History cleared"})


@app.route("/api/set-key", methods=["POST"])
def set_api_key():
    """Set the Groq API key at runtime."""
    global groq_client

    data = request.get_json()
    api_key = data.get("api_key", "").strip()

    if not api_key:
        return jsonify({"error": "API key cannot be empty"}), 400

    try:
        groq_client = Groq(api_key=api_key)
        # Test the key with a simple request
        groq_client.chat.completions.create(
            messages=[{"role": "user", "content": "test"}],
            model="openai/gpt-oss-120b",
            max_tokens=5
        )
        os.environ["GROQ_API_KEY"] = api_key
        return jsonify({"message": "API key set successfully"})
    except Exception as e:
        groq_client = None
        return jsonify({"error": f"Invalid API key: {str(e)}"}), 400


# ─── Main ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  Patient Care RAG - Post-Angioplasty Assistant")
    print("=" * 60)
    print(f"  Patient: {patient_profile['name']}")
    print(f"  Doctor:  {patient_profile['procedure']['doctor']}")
    if collection:
        print(f"  Database: {collection.count()} instructions loaded")
    else:
        print("  [WARN] Run 'python seed_data.py' to initialize the database")
    if groq_client:
        print("  LLM: Groq (Llama 3.3 70B) [OK]")
    else:
        print("  LLM: [WARN] Set GROQ_API_KEY or use /api/set-key")
    print("=" * 60 + "\n")

    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
