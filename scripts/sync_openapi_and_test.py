"""Synchronize contracts/openapi.yaml and backend/openapi.yaml with all extended paths."""
from __future__ import annotations

import yaml
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTRACT_SPEC_PATH = REPO_ROOT / "contracts" / "openapi.yaml"
BACKEND_SPEC_PATH = REPO_ROOT / "backend" / "openapi.yaml"
TEST_FILE = REPO_ROOT / "tests" / "unit" / "test_phase1_contracts_and_schema.py"

NEW_PATHS_YAML = """
  /imports/topology:
    post:
      summary: Ingest deployment topology
      operationId: importTopology
      responses:
        '200':
          description: Ingestion job initiated
          content:
            application/json:
              schema:
                type: object

  /jobs/{id}:
    get:
      summary: Check background job status
      operationId: getJobStatus
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Job status report
          content:
            application/json:
              schema:
                type: object

  /jobs/{id}/events:
    get:
      summary: Stream job events via SSE
      operationId: streamJobEvents
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: SSE event stream
          content:
            text/event-stream:
              schema:
                type: string

  /findings/{id}/explain:
    get:
      summary: Explain risk score factor decomposition
      operationId: explainFindingScore
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Detailed factor weights and calibration notes
          content:
            application/json:
              schema:
                type: object

  /graph:
    get:
      summary: Full dependency-and-deployment graph
      operationId: getFullGraph
      responses:
        '200':
          description: Node-link graph structure
          content:
            application/json:
              schema:
                type: object

  /graph/nodes/{id}:
    get:
      summary: Node detail and blast radius
      operationId: getGraphNodeDetail
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Node detail profile
          content:
            application/json:
              schema:
                type: object

  /plans/{id}:
    get:
      summary: Get plan detail by ID
      operationId: getPlanDetail
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Stored plan details
          content:
            application/json:
              schema:
                type: object

  /audit:
    get:
      summary: Query immutable audit logs
      operationId: listAuditLogs
      responses:
        '200':
          description: Paginated audit logs
          content:
            application/json:
              schema:
                type: object

  /audit/export:
    get:
      summary: Export audit logs as CSV or JSON
      operationId: exportAuditLogs
      responses:
        '200':
          description: Audit log export file
          content:
            application/json:
              schema:
                type: object
            text/csv:
              schema:
                type: string

  /sources/status:
    get:
      summary: Get data source sync freshness
      operationId: getSourcesStatus
      responses:
        '200':
          description: Source status table
          content:
            application/json:
              schema:
                type: object

  /health:
    get:
      summary: System health check
      operationId: getSystemHealth
      responses:
        '200':
          description: System operational status
          content:
            application/json:
              schema:
                type: object
"""

def sync():
    base_text = CONTRACT_SPEC_PATH.read_text(encoding="utf-8")
    if "/imports/topology:" not in base_text:
        updated_text = base_text.strip() + "\n" + NEW_PATHS_YAML
        CONTRACT_SPEC_PATH.write_text(updated_text, encoding="utf-8")
        BACKEND_SPEC_PATH.write_text(updated_text, encoding="utf-8")
        print("Updated contracts/openapi.yaml and backend/openapi.yaml")
    else:
        BACKEND_SPEC_PATH.write_text(base_text, encoding="utf-8")
        print("Specs already up to date")

    # Update test_phase1_contracts_and_schema.py expected_paths
    test_text = TEST_FILE.read_text(encoding="utf-8")
    old_expected = '''        expected_paths = {
            "/imports/sbom": "post",
            "/imports/vex": "post",
            "/imports/{id}": "get",
            "/assets": "get",
            "/findings": "get",
            "/findings/{id}": "get",
            "/graph/paths": "get",
            "/risk-runs": "post",
            "/plans": "post",
            "/plans/{id}/simulate": "post",
            "/plans/{id}/decision": "post",
            "/health/data": "get",
        }'''

    new_expected = '''        expected_paths = {
            "/imports/sbom": "post",
            "/imports/vex": "post",
            "/imports/topology": "post",
            "/imports/{id}": "get",
            "/jobs/{id}": "get",
            "/jobs/{id}/events": "get",
            "/assets": "get",
            "/findings": "get",
            "/findings/{id}": "get",
            "/findings/{id}/explain": "get",
            "/graph": "get",
            "/graph/nodes/{id}": "get",
            "/graph/paths": "get",
            "/risk-runs": "post",
            "/plans": "post",
            "/plans/{id}": "get",
            "/plans/{id}/simulate": "post",
            "/plans/{id}/decision": "post",
            "/audit": "get",
            "/audit/export": "get",
            "/sources/status": "get",
            "/health": "get",
            "/health/data": "get",
        }'''

    if old_expected in test_text:
        TEST_FILE.write_text(test_text.replace(old_expected, new_expected), encoding="utf-8")
        print("Updated tests/unit/test_phase1_contracts_and_schema.py expected_paths")

if __name__ == "__main__":
    sync()
