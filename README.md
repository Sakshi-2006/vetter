# Talent Lens — Resume Screening Demo

An explainable, skills-based resume review demo with a recruiter dashboard and a separate FastAPI service. The interface is a clearly labeled **demo** using synthetic candidates; it does not send uploaded files to a backend. The Python service is an independently runnable reference API for local experimentation.

## What it does

- Provides a recruiter overview with a ranked candidate table, role criteria, score explanations, review states, search, filters, and CSV export.
- Includes accessible candidate evidence panels and fair-hiring reminders. Scores are decision-support signals, never automatic hiring decisions.
- Accepts PDF, DOCX, and TXT files in the FastAPI service, extracts text, identifies role skills, stores candidate metadata and extracted text in a local SQLite database, and ranks candidates against a role.
- Uses TF-IDF text similarity plus transparent must-have skill coverage and a bounded experience signal. Ranking is a baseline for a class/demo project, not a validated employment test.

## Run the dashboard

The Next.js dashboard runs in the v0 Preview. Its candidate data is illustrative and held in page state; refreshing restores the initial sample. Uploading files in the dashboard only adds filenames to the in-memory review queue. **Do not upload real applicant data to the demo UI.**

## Run the API locally

Python 3.10+ is recommended.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn src.screening:app --reload --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` for interactive API documentation. The SQLite database is created at `backend/screening.sqlite3` on first launch and is excluded from Git.

### API quick start

Create a role:

```bash
curl -X POST http://127.0.0.1:8000/jobs \\
  -H 'Content-Type: application/json' \\
  -d '{"title":"Senior Data Analyst","jd_text":"Looking for SQL, Python, Tableau and experimentation skills with three years of analytics experience.","must_have":["SQL","Python","Tableau","Experimentation"],"nice_to_have":["A/B testing","Statistics"],"min_exp_years":3}'
```

Upload a resume with the returned `job_id` not required for ingestion (the resume can be ranked against any job):

```bash
curl -X POST http://127.0.0.1:8000/resumes \\
  -F 'candidate_name=Sample Candidate' \\
  -F 'file=@./resume.pdf'
```

Create a job and rank the candidate pool:

```bash
curl -X POST http://127.0.0.1:8000/jobs/<job_id>/rank
curl http://127.0.0.1:8000/jobs/<job_id>/rankings
```

Endpoints: `GET /health`, `POST|GET /jobs`, `POST|GET /resumes|candidates`, `POST /jobs/{job_id}/rank`, and `GET /jobs/{job_id}/rankings`.

## Model and scoring

The baseline score is a weighted sum of job-description TF-IDF cosine similarity (55%), must-have skill coverage (35%), and experience requirement coverage (10%). It is bounded to 0–100. Skill matching uses explicit role vocabulary and word boundaries; synonym matching is not implemented. The API response includes matched/missing skills and a human-readable reason. Missing requirements are flagged for review, not used for automatic rejection. The weights are demo defaults and should be calibrated on job-related evidence and evaluated before any real use.

## Privacy, fairness, and operational limits

- Use synthetic resumes only in this demo. The API stores extracted resume text and applicant name in a local SQLite file without authentication, encryption, retention controls, deletion workflow, or access audit. It is **not production-ready** and must not receive real applicant data.
- Obtain informed consent, document lawful purpose and retention, restrict access, encrypt data in transit and at rest, minimize stored fields, and provide deletion/export controls before any real deployment. Consider processing documents ephemerally and persisting only necessary, consented data.
- Never include or infer protected characteristics (including race, religion, sex/gender, age, disability, or marital status) or use proxies as ranking features. Strip contact details before any model input, and show job-related evidence only.
- Require a trained human to review every applicant and original resume. Provide an accessible appeal/correction path, monitor adverse impact and quality across appropriate lawful audit slices, and pause use if disparities or data quality issues arise. Do not treat audit attributes as selection criteria.
- Scanned PDFs require OCR, which is intentionally not bundled. Uploads are limited to 10 MB. Add malware scanning, stricter content validation, rate limits, CORS policy, authentication/authorization, privacy-safe logging, backup/retention policy, and tenant-scoped queries before deployment.
- Target p95 ranking latency under 200 ms only after profiling on representative volumes; this baseline has no SLA. Version the dataset, feature logic, and model settings; review monthly with recruiter feedback and offline metrics (precision@k, recall, calibration, and lawful adverse-impact analysis) before changing weights.

## GitHub setup

Create an empty GitHub repository and connect it from the v0 Settings menu, or use v0's GitHub integration to publish this project. Suggested repository name: `talent-lens-resume-screening`. Keep applicant data, local databases, generated reports, and secrets out of Git. The v0 Settings menu shows the connected repository and branch; push/publish controls may vary by workspace.

## Interview talking points

1. **Problem:** Help recruiters prioritize resume review for high-volume roles while retaining human judgment.
2. **Approach:** Extract text, compare it to job-related role criteria using TF-IDF similarity and explicit skill coverage, then show ranked results with reasons and missing evidence.
3. **Why hybrid scoring:** A transparent skills gate makes core requirements visible while text similarity captures broader role relevance; experience is a limited, explicit signal.
4. **Key challenges:** PDF/DOCX variability, unstructured language, keyword stuffing, incomplete evidence, fairness, explainability, and protecting sensitive applicant information.
5. **Limitations:** No semantic synonym model, OCR, validated scoring weights, persistence/auth in the demo dashboard, or production safeguards. Scores are not ground truth.
6. **Next steps:** Add role-validated skill taxonomies, secure persistence and access controls, consent and deletion, calibrated evaluation, recruiter feedback review, and integrations only after privacy and fairness assessment.
7. **Nontechnical summary:** It organizes resume evidence against a job's stated skills so people can focus their review; it does not choose who gets hired.
