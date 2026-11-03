# PatchGraph Final Release & Requirements Self-Audit Checklist (Gate 8)

- [x] **Clean-machine setup succeeds**: `PYTHONPATH=. python3 -m unittest discover -s tests -p "test_*.py" -v` runs 27 test suites cleanly with zero external network dependencies.
- [x] **Seeded scenario runs offline**: `python3 scripts/reset_demo.py` initializes all 26 tables and pinned snapshot `snap_01` (`9f86d081...`).
- [x] **Database restore succeeds**: Tested in `tests/system/test_system_gate.py` with SHA-256 verification.
- [x] **Source snapshots and model bundle are hashed**: `data/fixtures/advisory_snapshot_seed.json` and `data/fixtures/model_exploit_v1.json` store verified SHA-256 digests.
- [x] **Baselines, ablations, and stress tests reproduce**: Verified in `tests/integration/test_evaluation_gate.py` and `reports/result_manifest.json`.
- [x] **No secrets or sensitive infrastructure data are bundled**: Verified by `backend/app/security/uploads.py` and `tests/security/test_uploads.py`.
- [x] **Limitations and human approval are visible**: Every remediation plan requires explicit `approver`/`admin` sign-off in `plan_decisions` and `audit_logs`.
