"""Database backup, SHA-256 verification, and clean-instance restore drill (Day 40)."""
from __future__ import annotations

import hashlib
import sqlite3
from pathlib import Path
from typing import Dict

from backend.app.db.session import DatabaseManager


def create_database_backup(db: DatabaseManager, backup_sql_path: Path) -> Dict[str, str]:
    backup_sql_path.parent.mkdir(parents=True, exist_ok=True)
    dump_lines = [f"{line}\n" for line in db.conn.iterdump()]
    sql_dump = "".join(dump_lines)
    backup_sql_path.write_text(sql_dump, encoding="utf-8")
    sha256_hex = hashlib.sha256(sql_dump.encode("utf-8")).hexdigest()
    return {
        "backup_path": str(backup_sql_path),
        "sha256": sha256_hex,
        "bytes": str(len(sql_dump.encode("utf-8"))),
    }


def restore_database_from_backup(backup_sql_path: Path, expected_sha256: str) -> DatabaseManager:
    sql_dump = backup_sql_path.read_text(encoding="utf-8")
    actual_sha256 = hashlib.sha256(sql_dump.encode("utf-8")).hexdigest()
    if actual_sha256 != expected_sha256:
        raise ValueError(f"Backup SHA-256 mismatch: expected {expected_sha256}, got {actual_sha256}")

    restored = DatabaseManager.__new__(DatabaseManager)
    restored.db_path = ":memory:"
    restored.conn = sqlite3.connect(":memory:", check_same_thread=False)
    restored.conn.row_factory = sqlite3.Row
    restored.conn.executescript(sql_dump)
    restored.conn.commit()
    return restored
