# =============================================================================
# STEP 3 — Retrieval backend (FastAPI)
#
# Loads corpus.npz (from Step 2) once at startup, then answers retrieval
# queries: POST a claim -> embed it -> cosine-similarity against all corpus
# vectors -> return the top matches above a similarity threshold.
#
# WHERE TO RUN: your LAPTOP (not Colab). The browser extension will call this
# at http://127.0.0.1:8000. Put corpus.npz next to this file.
#
# SETUP (one time, in a terminal):
#   pip install fastapi uvicorn sentence-transformers numpy
# RUN:
#   uvicorn backend:app --reload --port 8000
# Then open http://127.0.0.1:8000/docs to test it in your browser (Swagger UI).
#
# Translation is NOT in this step — retrieval is English-only for now.
# =============================================================================

import json
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

# -- Tunables (the two you'll most likely adjust) ----------------------------
TOP_K = 3                  # how many matches to return
MIN_SIMILARITY = 0.45      # below this, treat as "no genuine match" and return none
                           # cosine range is 0..1; tune after seeing real queries.
# CORPUS_PATH = "corpus.npz"
CORPUS_PATH = "corpus_rw.npz"

MODEL_NAME = "all-MiniLM-L6-v2"   # MUST match the model used in Step 2

# -- Load corpus + model once at startup -------------------------------------
print("Loading corpus...")
_z = np.load(CORPUS_PATH, allow_pickle=True)
EMBEDDINGS = _z["embeddings"].astype("float32")          # (N, 384), unit-normalised
RECORDS = json.loads(_z["records"][0])                   # list of N display dicts
assert len(RECORDS) == EMBEDDINGS.shape[0], "corpus.npz mismatch between vectors and records"
print(f"Loaded {len(RECORDS)} fact-check entries, dim={EMBEDDINGS.shape[1]}")

print("Loading embedding model (downloads ~90MB on first run)...")
MODEL = SentenceTransformer(MODEL_NAME)
print("Ready.")

# -- API ----------------------------------------------------------------------
app = FastAPI(title="AccuPrompt Retrieval API", version="0.1.0")

# Allow the browser extension (and the Swagger page) to call us.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # prototype: permissive. Lock down for deployment.
    allow_methods=["*"],
    allow_headers=["*"],
)

class Query(BaseModel):
    claim: str
    top_k: int | None = None          # optional override
    min_similarity: float | None = None
    debug: bool = False               # if true, include scores even below threshold

class Evidence(BaseModel):
    q: str
    a: str

class Match(BaseModel):
    claim: str
    label: str
    justification: str
    evidence: list[Evidence]
    source: str
    location: str
    display_quality: str
    similarity: float
    rw_justification: str = ""      # add
    rw_label: str = ""              # add
    rw_reviewed: bool = False       # add

class RetrieveResponse(BaseModel):
    matches: list[Match]
    query: str
    note: str

@app.get("/health")
def health():
    return {"status": "ok", "entries": len(RECORDS)}

@app.post("/retrieve", response_model=RetrieveResponse)
def retrieve(q: Query):
    top_k = q.top_k or TOP_K
    threshold = q.min_similarity if q.min_similarity is not None else MIN_SIMILARITY

    text = (q.claim or "").strip()
    if not text:
        return RetrieveResponse(matches=[], query="", note="empty query")

    # Embed the single query with the SAME model (normalised -> dot = cosine).
    qvec = MODEL.encode([text], normalize_embeddings=True).astype("float32")[0]

    # One matrix multiply: similarity of the query against every corpus vector.
    sims = EMBEDDINGS @ qvec                      # shape (N,)
    order = np.argsort(-sims)[:top_k]             # indices of top_k, descending

    matches = []
    for idx in order:
        score = float(sims[idx])
        if score < threshold and not q.debug:
            continue                              # suppress weak matches (honesty)
        r = RECORDS[idx]
        matches.append(Match(
            claim=r["claim"],
            label=r["label"],
            justification=r["justification"],
            evidence=[Evidence(**e) for e in r.get("evidence", [])],
            source=r.get("source", ""),
            location=r.get("location", ""),
            display_quality=r.get("display_quality", "ok"),
            similarity=round(score, 4),
            rw_justification=r.get("rw_justification", ""),   # add
            rw_label=r.get("rw_label", ""),                   # add
            rw_reviewed=r.get("rw_reviewed", False),          # add
        ))

    if not matches:
        note = "no related fact-check found in corpus"
    else:
        note = f"{len(matches)} match(es) above similarity {threshold}"
    return RetrieveResponse(matches=matches, query=text, note=note)
