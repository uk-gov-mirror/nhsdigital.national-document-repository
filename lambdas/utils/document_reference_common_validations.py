import json
from json import JSONDecodeError
from services.feature_flags_service import FeatureFlagService
from utils.audit_logging_setup import LoggingService
from enums.lambda_error import LambdaError
from utils.lambda_exceptions import (
    DocumentRefException,
    FeatureFlagsException,
)

logger = LoggingService(__name__)

def process_event_body(event, failed_message):
    try:
        event_dict = normalize_event_body_to_dict(event) # remove after create doc lambda refactor
        body = event_dict["body"]

        if not body or not isinstance(body, dict):
            logger.error(
                f"{LambdaError.DocRefNoBody.to_str()}",
                {"Result": failed_message},
            )
            raise DocumentRefException(400, LambdaError.DocRefNoBody)

        nhs_number = body["subject"]["identifier"]["value"]
        doc_list = body["content"][0]["attachment"]
        return nhs_number, doc_list

    except (JSONDecodeError, AttributeError) as e:
        logger.error(
            f"{LambdaError.DocRefPayload.to_str()}: {str(e)}",
            {"Result": failed_message},
        )
        raise DocumentRefException(400, LambdaError.DocRefPayload)

    except (KeyError, TypeError) as e:
        logger.error(
            f"{LambdaError.DocRefProps.to_str()}: {str(e)}",
            {"Result": failed_message},
        )
        raise DocumentRefException(400, LambdaError.DocRefProps)


def validate_matching_patient_ids(query_id: str, body_id: str):
    if body_id != query_id:
        logger.warning(
            "Received nhs number query string does not match event's body nhs number"
        )
        raise DocumentRefException(400, LambdaError.PatientIdMismatch)

# adds the body of the request to the event json as a dict instead of a string
def normalize_event_body_to_dict(event):
    body = event.get("body")

    if isinstance(body, str):
        try:
            event["body"] = json.loads(body)
        except json.JSONDecodeError as e:
            raise DocumentRefException(f"Invalid JSON body: {str(e)}")
    elif not isinstance(body, dict):
        raise DocumentRefException(f"Unexpected body type: {type(body)}")

    return event

def validate_feature_flag(flag_name: str):
    feature_flag_service = FeatureFlagService()
    flag_object = feature_flag_service.get_feature_flags_by_flag(flag_name)

    if not flag_object.get(flag_name, False):
        logger.info(f"Feature flag '{flag_name}' not enabled, event will not be processed")
        raise FeatureFlagsException(404, LambdaError.FeatureFlagDisabled)

    return True