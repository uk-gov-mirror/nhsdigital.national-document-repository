import datetime
import json
from io import BytesIO

import pytest
from botocore.exceptions import ClientError
from freezegun import freeze_time
from services.base.s3_service import S3Service
from tests.unit.conftest import (
    MOCK_BUCKET,
    MOCK_CLIENT_ERROR,
    TEST_FILE_KEY,
    TEST_FILE_NAME,
    TEST_NHS_NUMBER,
    TEST_UUID,
)
from tests.unit.helpers.data.s3_responses import (
    MOCK_LIST_OBJECTS_PAGINATED_RESPONSES,
    MOCK_LIST_OBJECTS_RESPONSE,
    MOCK_PRESIGNED_URL_RESPONSE,
)
from utils.exceptions import TagNotFoundException

TEST_DOWNLOAD_PATH = "test_path"


def flatten(list_of_lists):
    """Flatten a list of lists into a single list."""
    return [item for sublist in list_of_lists for item in sublist]


@freeze_time("2023-10-30T10:25:00")
@pytest.fixture
def mock_service(mocker, set_env):
    S3Service._instance = None

    mocker.patch("boto3.client")
    mocker.patch("services.base.iam_service.IAMService")

    service = S3Service(custom_aws_role="mock_arn_custom_role")
    service.expiration_time = datetime.datetime.now(
        datetime.timezone.utc,
    ) + datetime.timedelta(hours=1)

    yield service
    S3Service._instance = None


@pytest.fixture
def mock_client(mocker, mock_service):
    client = mocker.patch.object(mock_service, "client")
    yield client


@pytest.fixture
def mock_custom_client(mocker, mock_service):
    client = mocker.patch.object(mock_service, "custom_client")
    yield client


@pytest.fixture
def mock_list_objects_paginate(mock_client):
    mock_paginator_method = mock_client.get_paginator.return_value.paginate
    return mock_paginator_method


def test_s3_service_constructs_boto_client_with_timeouts(mocker):
    S3Service._instance = None
    mocked_boto_client = mocker.patch("boto3.client")

    _ = S3Service()

    mocked_boto_client.assert_called_once()
    _, kwargs = mocked_boto_client.call_args
    assert kwargs["config"].connect_timeout == 3
    assert kwargs["config"].read_timeout == 5

    S3Service._instance = None


def test_put_json_calls_put_object_with_encoded_json(mock_service, mock_client):
    payload = {"a": 1, "b": {"c": 2}}

    mock_service.put_json("bucket", "key.json", payload)

    mock_client.put_object.assert_called_once()
    _, kwargs = mock_client.put_object.call_args

    assert kwargs["Bucket"] == "bucket"
    assert kwargs["Key"] == "key.json"
    assert kwargs["ContentType"] == "application/json"
    assert json.loads(kwargs["Body"].decode("utf-8")) == payload


def test_put_json_allows_custom_content_type(mock_service, mock_client):
    payload = {"hello": "world"}

    mock_service.put_json("bucket", "key", payload, content_type="application/x-ndjson")

    _, kwargs = mock_client.put_object.call_args
    assert kwargs["ContentType"] == "application/x-ndjson"


def test_create_upload_presigned_url(mock_service, mocker, mock_custom_client):
    mock_custom_client.generate_presigned_post.return_value = (
        MOCK_PRESIGNED_URL_RESPONSE
    )

    mock_service.iam_service = mocker.MagicMock()
    mock_service.iam_service.assume_role.return_value = (
        mock_custom_client,
        mock_service.expiration_time,
    )

    response = mock_service.create_upload_presigned_url(MOCK_BUCKET, TEST_UUID)

    assert response == MOCK_PRESIGNED_URL_RESPONSE
    mock_custom_client.generate_presigned_post.assert_called_once()


def test_create_download_presigned_url(mock_service, mocker, mock_custom_client):
    mock_custom_client.generate_presigned_url.return_value = MOCK_PRESIGNED_URL_RESPONSE
    mock_service.iam_service = mocker.MagicMock()
    mock_service.iam_service.assume_role.return_value = (
        mock_custom_client,
        mock_service.expiration_time,
    )

    response = mock_service.create_download_presigned_url(MOCK_BUCKET, TEST_FILE_KEY)

    assert response == MOCK_PRESIGNED_URL_RESPONSE
    mock_custom_client.generate_presigned_url.assert_called_once()


def test_download_file(mock_service, mock_client):
    mock_service.download_file(MOCK_BUCKET, TEST_FILE_KEY, TEST_DOWNLOAD_PATH)

    mock_client.download_file.assert_called_once_with(
        MOCK_BUCKET,
        TEST_FILE_KEY,
        TEST_DOWNLOAD_PATH,
    )


def test_upload_file(mock_service, mock_client):
    mock_service.upload_file(TEST_FILE_NAME, MOCK_BUCKET, TEST_FILE_KEY)

    mock_client.upload_file.assert_called_with(
        TEST_FILE_NAME,
        MOCK_BUCKET,
        TEST_FILE_KEY,
    )


def test_upload_file_with_extra_args(mock_service, mock_client):
    test_extra_args = {"mock_tag": 123, "apple": "red", "banana": "true"}

    mock_service.upload_file_with_extra_args(
        TEST_FILE_NAME,
        MOCK_BUCKET,
        TEST_FILE_KEY,
        test_extra_args,
    )

    mock_client.upload_file.assert_called_with(
        TEST_FILE_NAME,
        MOCK_BUCKET,
        TEST_FILE_KEY,
        test_extra_args,
    )


def test_copy_across_bucket(mock_service, mock_client):
    mock_service.copy_across_bucket(
        source_bucket="bucket_to_copy_from",
        source_file_key=TEST_FILE_KEY,
        dest_bucket="bucket_to_copy_to",
        dest_file_key=f"{TEST_NHS_NUMBER}/{TEST_UUID}",
    )

    mock_client.copy_object.assert_called_once_with(
        Bucket="bucket_to_copy_to",
        Key=f"{TEST_NHS_NUMBER}/{TEST_UUID}",
        CopySource={"Bucket": "bucket_to_copy_from", "Key": TEST_FILE_KEY},
        StorageClass="INTELLIGENT_TIERING",
    )


def test_copy_across_bucket_if_none_match(mock_service, mock_client):
    mock_service.copy_across_bucket(
        source_bucket="bucket_to_copy_from",
        source_file_key=TEST_FILE_KEY,
        dest_bucket="bucket_to_copy_to",
        dest_file_key=f"{TEST_NHS_NUMBER}/{TEST_UUID}",
        if_none_match=True,
    )

    mock_client.copy_object.assert_called_once_with(
        Bucket="bucket_to_copy_to",
        Key=f"{TEST_NHS_NUMBER}/{TEST_UUID}",
        CopySource={"Bucket": "bucket_to_copy_from", "Key": TEST_FILE_KEY},
        IfNoneMatch="*",
        StorageClass="INTELLIGENT_TIERING",
    )


def test_delete_object(mock_service, mock_client):
    mock_service.delete_object(s3_bucket_name=MOCK_BUCKET, file_key=TEST_FILE_NAME)

    mock_client.delete_object.assert_called_once_with(
        Bucket=MOCK_BUCKET,
        Key=TEST_FILE_NAME,
    )


def test_create_object_tag(mock_service, mock_client):
    test_tag_key = "tag_key"
    test_tag_value = "tag_name"

    mock_service.create_object_tag(
        s3_bucket_name=MOCK_BUCKET,
        file_key=TEST_FILE_NAME,
        tag_key=test_tag_key,
        tag_value=test_tag_value,
    )

    mock_client.put_object_tagging.assert_called_once_with(
        Bucket=MOCK_BUCKET,
        Key=TEST_FILE_NAME,
        Tagging={"TagSet": [{"Key": test_tag_key, "Value": test_tag_value}]},
    )


def test_get_tag_value(mock_service, mock_client):
    test_tag_key = "tag_key"
    test_tag_value = "tag_name"

    mock_response = {
        "VersionId": "mock_version",
        "TagSet": [
            {"Key": test_tag_key, "Value": test_tag_value},
            {"Key": "some_other_unrelated_tag", "Value": "abcd1234"},
        ],
    }

    mock_client.get_object_tagging.return_value = mock_response

    actual = mock_service.get_tag_value(
        s3_bucket_name=MOCK_BUCKET,
        file_key=TEST_FILE_NAME,
        tag_key=test_tag_key,
    )
    assert actual == test_tag_value

    mock_client.get_object_tagging.assert_called_once_with(
        Bucket=MOCK_BUCKET,
        Key=TEST_FILE_NAME,
    )


def test_get_tag_value_raises_error_when_specified_tag_is_missing(
    mock_service,
    mock_client,
):
    test_tag_key = "tag_key"

    mock_response = {
        "VersionId": "mock_version",
        "TagSet": [
            {"Key": "some_other_unrelated_tag", "Value": "abcd1234"},
        ],
    }

    mock_client.get_object_tagging.return_value = mock_response

    with pytest.raises(TagNotFoundException):
        mock_service.get_tag_value(
            s3_bucket_name=MOCK_BUCKET,
            file_key=TEST_FILE_NAME,
            tag_key=test_tag_key,
        )


def test_file_exist_on_s3_return_true_if_object_exists(mock_service, mock_client):
    mock_response = {
        "ResponseMetadata": {
            "RequestId": "mock_req",
            "HostId": "",
            "HTTPStatusCode": 200,
            "HTTPHeaders": {},
            "RetryAttempts": 0,
        },
        "ETag": '"eb2996dae99afd8308e4c97bdb6a4178"',
        "ContentType": "application/pdf",
        "Metadata": {},
    }

    mock_client.head_object.return_value = mock_response

    assert (
        mock_service.file_exist_on_s3(
            s3_bucket_name=MOCK_BUCKET,
            file_key=TEST_FILE_NAME,
        )
        is True
    )

    mock_client.head_object.assert_called_once_with(
        Bucket=MOCK_BUCKET,
        Key=TEST_FILE_NAME,
    )


def test_file_exist_on_s3_return_false_if_object_does_not_exist(
    mock_service,
    mock_client,
):
    mock_error = ClientError(
        {"Error": {"Code": "403", "Message": "Forbidden"}},
        "S3:HeadObject",
    )

    mock_client.head_object.side_effect = mock_error

    assert (
        mock_service.file_exist_on_s3(
            s3_bucket_name=MOCK_BUCKET,
            file_key=TEST_FILE_NAME,
        )
        is False
    )

    mock_client.head_object.assert_called_with(
        Bucket=MOCK_BUCKET,
        Key=TEST_FILE_NAME,
    )


def test_file_exist_on_s3_raises_client_error_if_unexpected_response(
    mock_service,
    mock_client,
):
    mock_error = ClientError(
        {"Error": {"Code": "500", "Message": "Internal Server Error"}},
        "S3:HeadObject",
    )

    mock_client.head_object.side_effect = mock_error

    with pytest.raises(ClientError):
        mock_service.file_exist_on_s3(
            s3_bucket_name=MOCK_BUCKET,
            file_key=TEST_FILE_NAME,
        )

    mock_client.head_object.assert_called_with(
        Bucket=MOCK_BUCKET,
        Key=TEST_FILE_NAME,
    )


def test_s3_service_singleton_instance(mocker):
    S3Service._instance = None
    mocker.patch("boto3.client")

    instance_1 = S3Service()
    instance_2 = S3Service()

    assert instance_1 is instance_2

    S3Service._instance = None


def test_not_created_presigned_url_without_custom_client(mocker):
    S3Service._instance = None
    mocker.patch("boto3.client")
    mock_service = S3Service()

    response = mock_service.create_download_presigned_url(MOCK_BUCKET, TEST_FILE_KEY)

    assert response is None

    S3Service._instance = None


def test_not_created_custom_client_without_client_role(mocker):
    S3Service._instance = None
    mocker.patch("boto3.client")
    iam_service = mocker.patch("services.base.iam_service.IAMService")

    mock_service = S3Service()

    iam_service.assert_not_called()
    assert mock_service.custom_client is None

    S3Service._instance = None


@freeze_time("2023-10-30T10:25:00")
def test_created_custom_client_when_client_role_is_passed(mocker):
    S3Service._instance = None

    mocker.patch("boto3.client")
    iam_service_instance = mocker.MagicMock()
    iam_service = mocker.patch(
        "services.base.s3_service.IAMService",
        return_value=iam_service_instance,
    )
    mock_expiration_time = datetime.datetime.now(datetime.timezone.utc)
    custom_client_mock = mocker.MagicMock()
    iam_service_instance.assume_role.return_value = (
        custom_client_mock,
        mock_expiration_time,
    )

    mock_service = S3Service(custom_aws_role="test")

    iam_service.assert_called()
    assert mock_service.custom_client == custom_client_mock
    iam_service_instance.assume_role.assert_called()

    S3Service._instance = None


def test_list_all_objects_return_a_list_of_file_details(
    mock_service,
    mock_client,
    mock_list_objects_paginate,
):
    mock_list_objects_paginate.return_value = [MOCK_LIST_OBJECTS_RESPONSE]
    expected = MOCK_LIST_OBJECTS_RESPONSE["Contents"]

    actual = mock_service.list_all_objects(MOCK_BUCKET)

    assert actual == expected

    mock_client.get_paginator.assert_called_with("list_objects_v2")
    mock_list_objects_paginate.assert_called_with(Bucket=MOCK_BUCKET)


def test_list_all_objects_handles_paginated_responses(
    mock_service,
    mock_client,
    mock_list_objects_paginate,
):
    mock_list_objects_paginate.return_value = MOCK_LIST_OBJECTS_PAGINATED_RESPONSES

    expected = flatten(
        [page["Contents"] for page in MOCK_LIST_OBJECTS_PAGINATED_RESPONSES],
    )

    actual = mock_service.list_all_objects(MOCK_BUCKET)

    assert actual == expected


def test_list_all_objects_raises_client_error_if_unexpected_response(
    mock_service,
    mock_client,
    mock_list_objects_paginate,
):
    mock_error = ClientError(
        {"Error": {"Code": "500", "Message": "Internal Server Error"}},
        "S3:ListObjectsV2",
    )

    mock_list_objects_paginate.side_effect = mock_error

    with pytest.raises(ClientError):
        mock_service.list_all_objects(MOCK_BUCKET)


def test_file_size_return_int(mock_service, mock_client):
    mock_response = {
        "ResponseMetadata": {
            "RequestId": "mock_req",
            "HostId": "",
            "HTTPStatusCode": 200,
            "HTTPHeaders": {},
            "RetryAttempts": 0,
        },
        "ContentLength": "3191",
        "ETag": '"eb2996dae99afd8308e4c97bdb6a4178"',
        "ContentType": "application/pdf",
        "Metadata": {},
    }

    mock_client.head_object.return_value = mock_response

    expected = "3191"
    actual = mock_service.get_file_size(
        s3_bucket_name=MOCK_BUCKET,
        object_key=TEST_FILE_NAME,
    )
    assert actual == expected

    mock_client.head_object.assert_called_once_with(
        Bucket=MOCK_BUCKET,
        Key=TEST_FILE_NAME,
    )


def test_save_or_create_file(mock_service, mock_client):
    body = TEST_FILE_KEY.encode("utf-8")
    mock_service.save_or_create_file(MOCK_BUCKET, TEST_FILE_NAME, body)

    mock_client.put_object.assert_called()
    _, kwargs = mock_client.put_object.call_args

    assert kwargs["Bucket"] == MOCK_BUCKET
    assert kwargs["Key"] == TEST_FILE_NAME
    assert kwargs["Body"].read() == body


def test_returns_binary_file_content_when_file_exists(
    mock_service,
    mock_client,
    mocker,
):
    mock_client.get_object.return_value = {
        "Body": mocker.Mock(read=lambda: b"file-content"),
    }

    body = mock_service.get_object_stream(bucket=MOCK_BUCKET, key=TEST_FILE_KEY)
    assert body.read() == b"file-content"

    mock_client.get_object.assert_called_once_with(
        Bucket=MOCK_BUCKET,
        Key=TEST_FILE_KEY,
    )


def test_raises_exception_when_file_does_not_exist(mock_service, mock_client):
    mock_client.get_object.side_effect = MOCK_CLIENT_ERROR

    with pytest.raises(ClientError):
        mock_service.get_object_stream("test-bucket", "nonexistent-key")


def test_upload_file_obj_success(mock_service, mock_client):
    file_obj = BytesIO(b"sample file content")
    extra_args = {"ContentType": "application/pdf"}

    mock_service.upload_file_obj(
        file_obj,
        MOCK_BUCKET,
        TEST_FILE_KEY,
        extra_args=extra_args,
    )

    mock_client.upload_fileobj.assert_called_once_with(
        Fileobj=file_obj,
        Bucket=MOCK_BUCKET,
        Key=TEST_FILE_KEY,
        ExtraArgs=extra_args,
    )


def test_upload_file_obj_raises_client_error(mock_service, mock_client):
    file_obj = BytesIO(b"sample file content")

    mock_client.upload_fileobj.side_effect = ClientError(
        {"Error": {"Code": "403", "Message": "Forbidden"}},
        "UploadFileObj",
    )

    with pytest.raises(ClientError):
        mock_service.upload_file_obj(file_obj, MOCK_BUCKET, TEST_FILE_KEY)

    mock_client.upload_fileobj.assert_called_once_with(
        Fileobj=file_obj,
        Bucket=MOCK_BUCKET,
        Key=TEST_FILE_KEY,
        ExtraArgs={},
    )


def test_get_object_stream_returns_body_stream(mock_service, mock_client, mocker):
    mock_stream = mocker.Mock(name="MockS3BodyStream")
    mock_client.get_object.return_value = {"Body": mock_stream}

    result = mock_service.get_object_stream(bucket=MOCK_BUCKET, key=TEST_FILE_KEY)

    assert result == mock_stream
    mock_client.get_object.assert_called_once_with(
        Bucket=MOCK_BUCKET,
        Key=TEST_FILE_KEY,
    )


def test_stream_s3_object_to_memory(mock_service, mock_client, mocker):
    chunks = [b"first-chunk", b"second-chunk", b""]

    mock_body = mocker.Mock()
    mock_body.read = mocker.Mock(side_effect=chunks)

    mock_client.get_object.return_value = {"Body": mock_body}

    result = mock_service.stream_s3_object_to_memory(MOCK_BUCKET, TEST_FILE_KEY)

    assert result.getvalue() == b"first-chunksecond-chunk"


def test_get_head_object_returns_metadata(mock_service, mock_client):
    mock_response = {
        "ResponseMetadata": {
            "RequestId": "mock_req",
            "HostId": "",
            "HTTPStatusCode": 200,
            "HTTPHeaders": {},
            "RetryAttempts": 0,
        },
        "ContentLength": 3191,
        "ETag": '"eb2996dae99afd8308e4c97bdb6a4178"',
        "ContentType": "application/pdf",
        "Metadata": {"custom-key": "custom-value"},
    }

    mock_client.head_object.return_value = mock_response

    result = mock_service.get_head_object(bucket=MOCK_BUCKET, key=TEST_FILE_KEY)

    assert result == mock_response
    mock_client.head_object.assert_called_once_with(
        Bucket=MOCK_BUCKET,
        Key=TEST_FILE_KEY,
    )


def test_get_head_object_raises_client_error_when_object_not_found(
    mock_service,
    mock_client,
):
    mock_error = ClientError(
        {"Error": {"Code": "404", "Message": "Not Found"}},
        "HeadObject",
    )
    mock_client.head_object.side_effect = mock_error

    with pytest.raises(ClientError):
        mock_service.get_head_object(bucket=MOCK_BUCKET, key=TEST_FILE_KEY)

    mock_client.head_object.assert_called_once_with(
        Bucket=MOCK_BUCKET,
        Key=TEST_FILE_KEY,
    )


def test_get_head_object_raises_client_error_on_access_denied(
    mock_service,
    mock_client,
):
    mock_error = ClientError(
        {"Error": {"Code": "403", "Message": "Forbidden"}},
        "HeadObject",
    )
    mock_client.head_object.side_effect = mock_error

    with pytest.raises(ClientError):
        mock_service.get_head_object(bucket=MOCK_BUCKET, key=TEST_FILE_KEY)

    mock_client.head_object.assert_called_once_with(
        Bucket=MOCK_BUCKET,
        Key=TEST_FILE_KEY,
    )


def test_copy_across_bucket_retries_on_409_conflict(mock_service, mock_client):
    mock_client.copy_object.side_effect = [
        ClientError(
            {
                "Error": {
                    "Code": "PreconditionFailed",
                    "Message": "Precondition Failed",
                },
                "ResponseMetadata": {"HTTPStatusCode": 409},
            },
            "CopyObject",
        ),
        {"CopyObjectResult": {"ETag": "mock-etag"}},  # Success on retry
    ]

    mock_service.copy_across_bucket(
        source_bucket="bucket_to_copy_from",
        source_file_key=TEST_FILE_KEY,
        dest_bucket="bucket_to_copy_to",
        dest_file_key=f"{TEST_NHS_NUMBER}/{TEST_UUID}",
    )

    assert mock_client.copy_object.call_count == 2

    expected_call = {
        "Bucket": "bucket_to_copy_to",
        "Key": f"{TEST_NHS_NUMBER}/{TEST_UUID}",
        "CopySource": {"Bucket": "bucket_to_copy_from", "Key": TEST_FILE_KEY},
        "StorageClass": "INTELLIGENT_TIERING",
    }
    mock_client.copy_object.assert_called_with(**expected_call)


def test_list_object_keys_returns_keys_for_prefix(
    mock_service,
    mock_client,
    mock_list_objects_paginate,
):
    mock_list_objects_paginate.return_value = [MOCK_LIST_OBJECTS_RESPONSE]

    prefix = "some/prefix/"
    expected = [obj["Key"] for obj in MOCK_LIST_OBJECTS_RESPONSE["Contents"]]

    actual = mock_service.list_object_keys(bucket_name=MOCK_BUCKET, prefix=prefix)

    assert actual == expected
    mock_client.get_paginator.assert_called_with("list_objects_v2")
    mock_list_objects_paginate.assert_called_with(Bucket=MOCK_BUCKET, Prefix=prefix)


def test_list_object_keys_handles_paginated_responses(
    mock_service,
    mock_client,
    mock_list_objects_paginate,
):
    mock_list_objects_paginate.return_value = MOCK_LIST_OBJECTS_PAGINATED_RESPONSES

    prefix = "some/prefix/"
    expected = flatten(
        [
            [obj["Key"] for obj in page.get("Contents", [])]
            for page in MOCK_LIST_OBJECTS_PAGINATED_RESPONSES
        ],
    )

    actual = mock_service.list_object_keys(bucket_name=MOCK_BUCKET, prefix=prefix)

    assert actual == expected
    mock_client.get_paginator.assert_called_with("list_objects_v2")
    mock_list_objects_paginate.assert_called_with(Bucket=MOCK_BUCKET, Prefix=prefix)
