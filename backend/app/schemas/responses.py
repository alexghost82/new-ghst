from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from fastapi.responses import JSONResponse


class GhostException(HTTPException):
    def __init__(self, code: str, message: str, status_code: int = 400):
        detail = {"ok": False, "error": {"code": code, "message": message}}
        super().__init__(status_code=status_code, detail=detail)


def ok_response(data: Any, status_code: int = 200) -> JSONResponse:
    return JSONResponse(content={"ok": True, "data": data}, status_code=status_code)


def error_response(code: str, message: str, status_code: int = 400) -> None:
    raise GhostException(code=code, message=message, status_code=status_code)
