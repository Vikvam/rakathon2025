from fastapi import HTTPException


class CodeNotFound(HTTPException):
    def __init__(self):
        super().__init__(status_code=401, detail="Patient code not found")
