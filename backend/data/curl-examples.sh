#!/usr/bin/env bash
set -euo pipefail
API=${API:-http://127.0.0.1:8000}
JOB=$(curl -fsS -X POST "$API/jobs" -H 'Content-Type: application/json' \
  -d @data/job_description.json)
JOB_ID=$(python -c 'import json,sys; print(json.load(sys.stdin)["job_id"])' <<< "$JOB")
printf 'Created job %s\n' "$JOB_ID"
if [[ -f "../resumes/sample.txt" ]]; then
  curl -fsS -X POST "$API/resumes" -F 'candidate_name=Sample Candidate' \
    -F 'file=@../resumes/sample.txt'
  printf '\n'
fi
curl -fsS -X POST "$API/jobs/$JOB_ID/rank"
printf '\n'
