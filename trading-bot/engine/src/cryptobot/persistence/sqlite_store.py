"""Persistencia local en SQLite (por defecto y para pruebas). Documentos JSON por tabla."""

from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any

from cryptobot.persistence.base import TABLE_KEYS


class SQLiteStore:
    def __init__(self, path: Path | str = ":memory:"):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._lock = threading.Lock()
        with self._lock:
            self._conn.execute(
                "CREATE TABLE IF NOT EXISTS docs (tbl TEXT NOT NULL, key TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (tbl, key))"
            )
            self._conn.commit()

    @staticmethod
    def _key(table: str, row: dict[str, Any]) -> str:
        k = TABLE_KEYS.get(table, "id")
        return str(row[k])

    def upsert(self, table: str, rows: list[dict[str, Any]]) -> None:
        with self._lock:
            for row in rows:
                key = self._key(table, row)
                cur = self._conn.execute(
                    "SELECT data FROM docs WHERE tbl=? AND key=?", (table, key)
                ).fetchone()
                merged = {**json.loads(cur[0]), **row} if cur else row
                self._conn.execute(
                    "INSERT OR REPLACE INTO docs (tbl, key, data) VALUES (?, ?, ?)",
                    (table, key, json.dumps(merged, ensure_ascii=False, default=str)),
                )
            self._conn.commit()

    def select(
        self,
        table: str,
        where: dict[str, Any] | None = None,
        order_by: str | None = None,
        desc: bool = False,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        sql = "SELECT data FROM docs WHERE tbl=?"
        params: list[Any] = [table]
        for k, v in (where or {}).items():
            if v is None:
                sql += f" AND json_extract(data, '$.{k}') IS NULL"
            else:
                sql += f" AND json_extract(data, '$.{k}') = ?"
                params.append(v if not isinstance(v, bool) else int(v))
        if order_by:
            sql += f" ORDER BY json_extract(data, '$.{order_by}') {'DESC' if desc else 'ASC'}"
        if limit:
            sql += f" LIMIT {int(limit)}"
        with self._lock:
            rows = self._conn.execute(sql, params).fetchall()
        return [json.loads(r[0]) for r in rows]

    def delete(self, table: str, where: dict[str, Any]) -> None:
        for row in self.select(table, where):
            with self._lock:
                self._conn.execute(
                    "DELETE FROM docs WHERE tbl=? AND key=?", (table, self._key(table, row))
                )
                self._conn.commit()

    def dump(self) -> dict[str, list[dict[str, Any]]]:
        """Todas las tablas (para exportar datos de demostración al panel)."""
        with self._lock:
            rows = self._conn.execute("SELECT tbl, data FROM docs").fetchall()
        out: dict[str, list[dict[str, Any]]] = {}
        for tbl, data in rows:
            out.setdefault(tbl, []).append(json.loads(data))
        return out
