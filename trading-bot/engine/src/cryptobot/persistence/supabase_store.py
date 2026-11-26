"""Persistencia en Supabase vía su API REST (PostgREST), con la clave de servicio del servidor.

La clave de servicio NUNCA va al panel: el panel usa la clave anónima + RLS (solo tu usuario).
"""

from __future__ import annotations

from typing import Any

import httpx

from cryptobot.persistence.base import TABLE_KEYS


class SupabaseStore:
    def __init__(
        self, url: str, service_key: str, client: httpx.Client | None = None, timeout: float = 20.0
    ):
        self.base = url.rstrip("/") + "/rest/v1"
        self.client = client or httpx.Client(timeout=timeout)
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _filter_value(v: Any) -> str:
        if v is None:
            return "is.null"
        if isinstance(v, bool):
            return f"eq.{str(v).lower()}"
        return f"eq.{v}"

    def upsert(self, table: str, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        key = TABLE_KEYS.get(table, "id")
        resp = self.client.post(
            f"{self.base}/{table}",
            params={"on_conflict": key},
            json=rows,
            headers={**self.headers, "Prefer": "resolution=merge-duplicates,return=minimal"},
        )
        resp.raise_for_status()

    def select(
        self,
        table: str,
        where: dict[str, Any] | None = None,
        order_by: str | None = None,
        desc: bool = False,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {"select": "*"}
        for k, v in (where or {}).items():
            params[k] = self._filter_value(v)
        if order_by:
            params["order"] = f"{order_by}.{'desc' if desc else 'asc'}"
        if limit:
            params["limit"] = str(int(limit))
        resp = self.client.get(f"{self.base}/{table}", params=params, headers=self.headers)
        resp.raise_for_status()
        return resp.json()

    def delete(self, table: str, where: dict[str, Any]) -> None:
        params = {k: self._filter_value(v) for k, v in where.items()}
        resp = self.client.delete(f"{self.base}/{table}", params=params, headers=self.headers)
        resp.raise_for_status()
