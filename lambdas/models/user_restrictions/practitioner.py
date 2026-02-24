from pydantic import BaseModel


class Practitioner(BaseModel):
    first_name: str
    last_name: str
    smartcard_id: str
