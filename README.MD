# ImmediateCare — Post-Angioplasty Patient Care RAG Assistant 🏥💡

ImmediateCare is an intelligent Retrieval-Augmented Generation (RAG) assistant designed for post-angioplasty (stent placement) recovery care. It provides personalized, medical instruction-backed answers using **ChromaDB** for semantic search over doctor instructions and **Groq LLM** for compassionate response generation.

---

## 🌟 Key Features

- **Personalized Context**: Custom-tailored responses according to the patient's medical profile (procedure date, medications, allergies, activity restrictions).
- **RAG Architecture**: Vector search powered by ChromaDB retrieving verified instructions from cardiac care specialists.
- **Interactive Web Interface**: Sleek UI for asking recovery queries, monitoring health indicators, and setting Groq API keys dynamically.
- **Patient History & Memory**: Conversation logging per patient ID for continuity of care.

---

## 📁 Repository Structure

```text
GenAI/
├── app.py                    # Flask backend & RAG pipeline server
├── seed_data.py              # Script to populate ChromaDB vector store
├── requirements.txt          # Python dependencies
├── .env.example              # Environment variables template
├── data/
│   ├── doctor_instructions.json  # Reference cardiac guidelines & instructions
│   └── patient_profile.json      # Sample post-angioplasty patient profile
├── memory/                   # Patient conversation history logs
├── templates/
│   └── index.html            # Web application UI
└── static/
    ├── style.css             # Frontend styling
    └── script.js             # Client-side API integration & UI logic
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites

Ensure you have Python 3.9+ installed.

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Parthx-06/ImmediateCare.git
cd ImmediateCare
pip install -r requirements.txt
```

### 3. Set Up API Key

Copy `.env.example` to `.env` or set the environment variable:

```bash
# On Windows PowerShell:
$env:GROQ_API_KEY="your_groq_api_key_here"

# On macOS / Linux:
export GROQ_API_KEY="your_groq_api_key_here"
```

*(Alternatively, you can enter your API key directly in the web UI settings panel.)*

### 4. Seed the Vector Database

Populate ChromaDB with the doctor instructions vector embeddings:

```bash
python seed_data.py
```

### 5. Run the Application

Start the Flask development server:

```bash
python app.py
```

Open your browser and navigate to:
`http://127.0.0.1:5000`

---

## ⚕️ Safety Disclaimer

This application is designed as an educational assistant to help post-angioplasty patients understand their discharge instructions. It is **not** a replacement for emergency medical care. In case of severe chest pain, shortness of breath, or emergency symptoms, patients must immediately contact local emergency services.
