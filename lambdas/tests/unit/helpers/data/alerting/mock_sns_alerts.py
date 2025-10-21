from tests.unit.conftest import MOCK_LG_METADATA_SQS_QUEUE, TEST_UUID

ALERT_TIME = "2025-04-17T15:10:41.433+0000"

QUEUE_ALERT_MESSAGE = {
    "AlarmName": "dev_lg_bulk_main_oldest_message_alarm_6d",
    "AlarmDescription": f"Alarm when a message in queue dev-{MOCK_LG_METADATA_SQS_QUEUE} is older than 6 days.",
    "NewStateValue": "ALARM",
    "StateChangeTime": ALERT_TIME,
    "OldStateValue": "OK",
    "Trigger": {
        "MetricName": "ApproximateAgeOfOldestMessage",
        "Namespace": "AWS/SQS",
        "StatisticType": "Statistic",
        "Statistic": "Maximum",
        "Unit": None,
        "Dimensions": [
            {
                "QueueName": f"dev-{MOCK_LG_METADATA_SQS_QUEUE}",
            }
        ],
    },
}

MOCK_LAMBDA_ALERT_MESSAGE = {
    "AlarmName": "dev-alarm_search_patient_details_handler_error",
    "AlarmDescription": "Triggers when an error has occurred in dev_SearchPatientDetailsLambda.",
    "AlarmConfigurationUpdatedTimestamp": "2025-04-17T15:08:51.604+0000",
    "NewStateValue": "ALARM",
    "StateChangeTime": ALERT_TIME,
    "OldStateValue": "OK",
    "Trigger": {
        "MetricName": "Errors",
        "Namespace": "AWS/Lambda",
        "StatisticType": "Statistic",
        "Statistic": "SUM",
        "Unit": None,
        "Dimensions": [
            {
                "value": "dev_SearchPatientDetailsLambda",
                "name": "FunctionName",
            }
        ],
    },
}

MOCK_LAMBDA_ALARM_SNS_ALERT = {
    "EventSource": "aws:sns",
    "EventVersion": "1.0",
    "EventSubscriptionArn": "arn:aws:sns:region:xxxxxx:dev-sns-search_patient_details_alarms-topicxxxxx:xxxxxx",
    "Sns": {
        "Type": "Notification",
        "MessageId": "xxxxxx",
        "TopicArn": "arn:aws:sns:region:xxxxxx:dev-sns-search_patient_details_alarms-topicxxxxx",
        "Subject": 'ALARM: "dev-alarm_search_patient_details_handler_error"',
        "Message": MOCK_LAMBDA_ALERT_MESSAGE,
    },
}

MOCK_VIRUS_SCANNER_ALERT_SNS_MESSAGE = {
    "Type": "Notification",
    "MessageId": "xxxxxx",
    "TopicArn": "virus_scanner_topic_arn",
    "Subject": "",
    "Message": {"id": TEST_UUID, "dateScanned": ALERT_TIME, "result": "Error"},
}
