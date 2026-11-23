from __future__ import annotations

import io
import json
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from docx import Document
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from pypdf import PdfReader
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "screening.sqlite3"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt"}

app = FastAPI(title="Talent Lens Resume Screening API", version="1.0.0")


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def init_db() -> None:
    with connect() as con:
        con.executescript("""
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, jd_text TEXT NOT NULL,
                must_have TEXT NOT NULL, nice_to_have TEXT NOT NULL,
                min_exp_years REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS candidates (
                id TEXT PRIMARY KEY, display_name TEXT NOT NULL, source_name TEXT NOT NULL,
                raw_text TEXT NOT NULL, skills TEXT NOT NULL, years_exp REAL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS rankings (
                job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
                candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
                score REAL NOT NULL, matched_skills TEXT NOT NULL, missing_skills TEXT NOT NULL,
                explanation TEXT NOT NULL, created_at TEXT NOT NULL,
                PRIMARY KEY (job_id, candidate_id)
            );
        """)


@app.on_event("startup")
def startup() -> None:
    init_db()


class JobInput(BaseModel):
    title: str = Field(min_length=2, max_length=150)
    jd_text: str = Field(min_length=20, max_length=30000)
    must_have: list[str] = Field(default_factory=list, max_length=40)
    nice_to_have: list[str] = Field(default_factory=list, max_length=40)
    min_exp_years: float = Field(default=0, ge=0, le=60)


def clean_text(value: str) -> str:
    value = re.sub(r"\s+", " ", value)
    return re.sub(r"[^\w\s+#./-]", " ", value).strip()


def read_resume(filename: str, data: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Upload a PDF, DOCX, or TXT resume.")
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Resume exceeds the 10 MB limit.")
    try:
        if suffix == ".pdf":
            text = "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(data)).pages)
        elif suffix == ".docx":
            document = Document(io.BytesIO(data))
            text = "\n".join(paragraph.text for paragraph in document.paragraphs)
        else:
            text = data.decode("utf-8-sig")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not read this resume file.") from exc
    text = clean_text(text)
    if len(text) < 20:
        raise HTTPException(status_code=422, detail="No readable text found. Scanned PDFs need OCR before upload.")
    return text


def extract_skills(text: str, vocabulary: list[str]) -> list[str]:
    normalized = f" {text.lower()} "
    return sorted({skill for skill in vocabulary if re.search(r"(?<![\w+#])" + re.escape(skill.lower()) + r"(?![\w+#])", normalized)})


def extract_years(text: str) -> float | None:
    matches = re.findall(r"(\d+(?:\.\d+)?)\s*(?:\+\s*)?(?:years|yrs|yr)\b", text.lower())
    return max((float(value) for value in matches), default=None)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/jobs", status_code=201)
def create_job(job: JobInput) -> dict[str, str]:
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with connect() as con:
        con.execute("INSERT INTO jobs VALUES (?, ?, ?, ?, ?, ?, ?)", (job_id, job.title.strip(), job.jd_text.strip(), json.dumps(job.must_have), json.dumps(job.nice_to_have), job.min_exp_years, now))
    return {"job_id": job_id}


@app.get("/jobs")
def list_jobs() -> list[dict]:
    with connect() as con:
        rows = con.execute("SELECT id, title, jd_text, must_have, nice_to_have, min_exp_years, created_at FROM jobs ORDER BY created_at DESC").fetchall()
    return [{**dict(row), "must_have": json.loads(row["must_have"]), "nice_to_have": json.loads(row["nice_to_have"])} for row in rows]


@app.post("/resumes", status_code=201)
async def upload_resume(candidate_name: str = Form(min_length=2, max_length=120), file: UploadFile = File(...)) -> dict:
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    text = read_resume(file.filename or "resume.txt", data)
    vocabulary: set[str] = set()
    with connect() as con:
        for row in con.execute("SELECT must_have, nice_to_have FROM jobs"):
            vocabulary.update(json.loads(row["must_have"]))
            vocabulary.update(json.loads(row["nice_to_have"]))
    skills = extract_skills(text, list(vocabulary))
    candidate_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with connect() as con:
        con.execute("INSERT INTO candidates VALUES (?, ?, ?, ?, ?, ?, ?)", (candidate_id, candidate_name.strip(), Path(file.filename or "resume").name, text, json.dumps(skills), extract_years(text), now))
    return {"candidate_id": candidate_id, "name": candidate_name.strip(), "skills": skills, "years_exp": extract_years(text)}


@app.get("/candidates")
def list_candidates() -> list[dict]:
    with connect() as con:
        rows = con.execute("SELECT id, display_name AS name, source_name, skills, years_exp, created_at FROM candidates ORDER BY created_at DESC").fetchall()
    return [{**dict(row), "skills": json.loads(row["skills"])} for row in rows]


@app.post("/jobs/{job_id}/rank")
def rank_candidates(job_id: str) -> list[dict]:
    with connect() as con:
        job = con.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        candidates = con.execute("SELECT * FROM candidates ORDER BY display_name").fetchall()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if not candidates:
        return []
    required = json.loads(job["must_have"])
    nice = json.loads(job["nice_to_have"])
    docs = [job["jd_text"], *[row["raw_text"] for row in candidates]]
    vectors = TfidfVectorizer(ngram_range=(1, 2), max_features=20000, stop_words="english").fit_transform(docs)
    sims = cosine_similarity(vectors[0:1], vectors[1:]).ravel()
    output = []
    now = datetime.now(timezone.utc).isoformat()
    with connect() as con:
        for candidate, similarity in zip(candidates, sims, strict=True):
            skills = json.loads(candidate["skills"])
            skill_set = {item.lower() for item in skills}
            matched = [skill for skill in required if skill.lower() in skill_set]
            missing = [skill for skill in required if skill.lower() not in skill_set]
            nice_hits = [skill for skill in nice if skill.lower() in skill_set]
            years = candidate["years_exp"] or 0
            experience_score = min(1.0, years / max(1.0, job["min_exp_years"])) if job["min_exp_years"] else 1.0
            required_coverage = len(matched) / max(1, len(required)) if required else 1.0
            score = round(100 * (0.55 * float(similarity) + 0.35 * required_coverage + 0.10 * experience_score), 1)
            explanation = f"Matched {len(matched)}/{len(required)} must-have skills; {len(nice_hits)} nice-to-have skills evidenced; resume text similarity {similarity:.2f}. Missing required skills are flagged for human review, not automatic rejection."
            con.execute("INSERT OR REPLACE INTO rankings VALUES (?, ?, ?, ?, ?, ?, ?)", (job_id, candidate["id"], score, json.dumps(matched), json.dumps(missing), explanation, now))
            output.append({"candidate_id": candidate["id"], "name": candidate["display_name"], "source_name": candidate["source_name"], "score": score, "matched_skills": matched, "missing_skills": missing, "years_exp": candidate["years_exp"], "explanation": explanation, "status": "Review" if missing else ("Strong match" if score >= 80 else "Review")})
    return sorted(output, key=lambda row: row["score"], reverse=True)


@app.get("/jobs/{job_id}/rankings")
def get_rankings(job_id: str) -> list[dict]:
    with connect() as con:
        if not con.execute("SELECT 1 FROM jobs WHERE id = ?", (job_id,)).fetchone():
            raise HTTPException(status_code=404, detail="Job not found.")
        rows = con.execute("SELECT c.id AS candidate_id, c.display_name AS name, c.source_name, c.years_exp, r.score, r.matched_skills, r.missing_skills, r.explanation FROM rankings r JOIN candidates c ON c.id = r.candidate_id WHERE r.job_id = ? ORDER BY r.score DESC", (job_id,)).fetchall()
    return [{**dict(row), "matched_skills": json.loads(row["matched_skills"]), "missing_skills": json.loads(row["missing_skills"]), "status": "Review" if json.loads(row["missing_skills"]) else ("Strong match" if row["score"] >= 80 else "Review")} for row in rows]
