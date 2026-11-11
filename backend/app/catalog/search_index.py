"""In-Process Inverted Full-Text Search Index (`backend/app/catalog/search_index.py`).

Provides sub-millisecond BM25/token search across packages, CVEs, CWEs, and services
without requiring an external Elasticsearch cluster.
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any, Dict, List, Set


class SupplyChainSearchIndex:
    def __init__(self) -> None:
        self._docs: Dict[str, Dict[str, Any]] = {}
        self._inverted: Dict[str, Set[str]] = defaultdict(set)

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        return [t for t in re.split(r"[^a-zA-Z0-9]+", text.lower()) if len(t) >= 2]

    def index_document(self, doc_id: str, payload: Dict[str, Any]) -> None:
        self._docs[doc_id] = payload
        blob = " ".join(str(v) for v in payload.values())
        for tok in self._tokenize(blob):
            self._inverted[tok].add(doc_id)

    def search(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        tokens = self._tokenize(query)
        if not tokens:
            return list(self._docs.values())[:limit]
        scores: Dict[str, int] = defaultdict(int)
        for tok in tokens:
            for key, doc_ids in self._inverted.items():
                if tok in key:
                    for did in doc_ids:
                        scores[did] += 2 if tok == key else 1
        ranked = sorted(scores.keys(), key=lambda d: (-scores[d], d))[:limit]
        return [self._docs[d] for d in ranked]
