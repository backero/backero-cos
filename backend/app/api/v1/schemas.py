import math
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    pages: int
    limit: int

    @classmethod
    def build(cls, items: list, total: int, page: int, limit: int) -> "PaginatedResponse[T]":
        pages = math.ceil(total / limit) if total > 0 and limit > 0 else 1
        return cls(items=items, total=total, page=page, pages=pages, limit=limit)
