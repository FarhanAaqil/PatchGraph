# PatchGraph 15-Slide Final Presentation Outline

Follows the exact slide sequence and evidence rules mandated in `18_Final_Presentation_Plan.md`:

1. **Problem and User**: Alert fatigue in software supply-chain security; why AppSec and Platform Engineers need blast radius and constrained action plans rather than flat CVE lists.
2. **Research Questions**: RQ1 (deployment-aware prioritization), RQ2 (CP-SAT vs greedy planning under budget), RQ3 (blast-radius accuracy under incomplete inventory), and Primary Hypothesis H1.
3. **Data and Provenance**: Content-addressed CycloneDX/SPDX/OpenVEX ingestion and pinned OSV, NVD CVE 2.0, FIRST EPSS, and CISA KEV snapshots.
4. **Typed Dependency-and-Deployment Graph**: Schema and bounded NetworkX traversal (`package -> version -> application -> service -> asset -> environment -> owner`, depth <= 12, cycle-safe).
5. **Risk Baselines and Calibrated Model**: Explicit weighted risk formula, disclosure-time and package-family split controls, Platt calibration, and uncertainty bands.
6. **Remediation Objective and Constraints**: OR-Tools CP-SAT binary program maximizing weighted exposure removed minus effort, downtime, compatibility risk, and concentration.
7. **System Architecture & Trust Boundaries**: Modular monolith (`backend/`, `intelligence/`, `frontend/`, `contracts/`), untrusted upload limits, RBAC, and append-only audit log.
8. **Analyst Workflow**: End-to-end UI flow across all 14 screens and 7 operational states (never rendering unknown as safe).
9. **Evaluation Protocol**: Frozen snapshot `snap_01`, 200-resample bootstrap confidence intervals, baselines, and 7 single-factor ablations.
10. **Ranking Results (RQ1)**: `NDCG@6 = 1.0000` and `Precision@6 = 1.0000` vs `0.4539` (`CVSS-descending`), paired with per-ecosystem slices.
11. **Graph and Planning Results (RQ2 & RQ3)**: CP-SAT removes `16.70` weighted exposure vs `12.00` (`Greedy Risk-Descending`) at a 10h budget; blast-radius recall stays at `83.3%` (`>= 80%`) under 85% inventory coverage.
12. **Ablations and Failure Modes**: Impact of removing reachability, deployment criticality, EPSS, VEX, and CP-SAT optimization.
13. **Security, Ethics, and Responsible Operation**: No active scanning, no autonomous patching, mandatory human approval, secret redaction, and verified backup/restore drill.
14. **Live Offline Demo**: 9-minute seeded walkthrough from SBOM upload to human plan approval.
15. **Limitations and Future Work**: Static SBOM boundary, small capstone sample size uncertainty, and future call-graph reachability extensions.
