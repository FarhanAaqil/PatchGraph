# PatchGraph Graph & Blast-Radius Evaluation Results (RQ3)

- **Dataset Date**: `2026-11-01` · **Manifest**: `snap_01` (`9f86d081...`)

| Scenario | Affected-Service Precision | Affected-Service Recall | Meets >= 80% Target (H1) |
|---|---:|---:|---|
| Complete Inventory (Bounded Depth <= 12) | 1.0000 | 1.0000 | Yes |
| Deliberately Incomplete Inventory (85% Edge Coverage) | 1.0000 | 0.8333 | Yes (83.3% >= 80.0%) |
