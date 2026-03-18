from pydantic import BaseModel
from pydantic.alias_generators import to_camel


class Practitioner(BaseModel):
    first_name: str
    last_name: str
    smartcard_id: str

    def model_dump_camel_case(self, *args, **kwargs):
        model_dump_results = self.model_dump(*args, **kwargs)
        camel_case_model_dump_results = {}
        for key in model_dump_results:
            camel_case_model_dump_results[to_camel(key)] = model_dump_results[key]
        return camel_case_model_dump_results
