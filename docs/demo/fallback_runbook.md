# PatchGraph Demo Rehearsal 2 — Offline Fallback Runbook (Day 55)

1. **Primary Mode**: Local FastAPI + SQLite/PostgreSQL seeded via `python3 scripts/reset_demo.py` (zero external network calls).
2. **If Browser Port 5173 Is Busy**: Run the API contract demo directly against `http://localhost:8000/docs` or execute `python3 -m unittest tests/system/test_vertical_slice.py -v`.
3. **Pre-Exported Backup Assets**: Static plan export (`docs/demo/backup_assets/approved_plan_01_export.json`) and evaluation chart (`docs/figures/architecture_and_evaluation_summary.png`) are bundled in the repository for immediate inspection.
