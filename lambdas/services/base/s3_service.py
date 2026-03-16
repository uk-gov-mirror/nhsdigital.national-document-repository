import io
import json
from datetime import datetime, timedelta, timezone
from io import BytesIO
from typing import Any, Mapping

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import ClientError

from services.base.iam_service import IAMService
from utils.audit_logging_setup import LoggingService
from utils.exceptions import TagNotFoundException

logger = LoggingService(__name__)


class S3Service:
    _instance = None
    EXPIRED_SESSION_WARNING = "Expired session, creating a new role session"
    S3_PREFIX = "s3://"

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.initialised = False
        return cls._instance

    def __init__(self, custom_aws_role=None):
        if not self.initialised:
            self.config = BotoConfig(
                connect_timeout=3,
                read_timeout=5,
                retries={"max_attempts": 3, "mode": "standard"},
                s3={"addressing_style": "virtual"},
                signature_version="s3v4",
                max_pool_connections=20,
            )
            self.presigned_url_expiry = 1800
            self.client = boto3.client("s3", config=self.config)
            self.initialised = True
            self.custom_client = None
            self.custom_aws_role = custom_aws_role
            if custom_aws_role:
                self.iam_service = IAMService()
                self.custom_client, self.expiration_time = self.iam_service.assume_role(
                    self.custom_aws_role,
                    "s3",
                    config=self.config,
                )

    def put_json(
        self,
        bucket: str,
        key: str,
        payload: Mapping[str, Any],
        *,
        content_type: str = "application/json",
    ):
        return self.client.put_object(
            Bucket=bucket,
            Key=key,
            Body=json.dumps(payload).encode("utf-8"),
            ContentType=content_type,
        )

    # S3 Location should be a minimum of a s3_object_key but can also be a directory location in the form of
    # {{directory}}/{{s3_object_key}}
    def create_upload_presigned_url(self, s3_bucket_name: str, s3_object_location: str):
        if self.custom_client:
            if datetime.now(timezone.utc) > self.expiration_time - timedelta(
                minutes=10,
            ):
                logger.info(S3Service.EXPIRED_SESSION_WARNING)
                self.custom_client, self.expiration_time = self.iam_service.assume_role(
                    self.custom_aws_role,
                    "s3",
                    config=self.config,
                )
            return self.custom_client.generate_presigned_post(
                s3_bucket_name,
                s3_object_location,
                Fields=None,
                Conditions=None,
                ExpiresIn=self.presigned_url_expiry,
            )

    def create_put_presigned_url(self, s3_bucket_name: str, file_key: str):
        if self.custom_client:
            if datetime.now(timezone.utc) > self.expiration_time - timedelta(
                minutes=10,
            ):
                logger.info(S3Service.EXPIRED_SESSION_WARNING)
                self.custom_client, self.expiration_time = self.iam_service.assume_role(
                    self.custom_aws_role,
                    "s3",
                    config=self.config,
                )
            logger.info("Generating presigned URL")
            return self.custom_client.generate_presigned_url(
                "put_object",
                Params={"Bucket": s3_bucket_name, "Key": file_key},
                ExpiresIn=self.presigned_url_expiry,
            )
        return None

    def create_download_presigned_url(self, s3_bucket_name: str, file_key: str):
        if self.custom_client:
            if datetime.now(timezone.utc) > self.expiration_time - timedelta(
                minutes=10,
            ):
                logger.info(S3Service.EXPIRED_SESSION_WARNING)
                self.custom_client, self.expiration_time = self.iam_service.assume_role(
                    self.custom_aws_role,
                    "s3",
                    config=self.config,
                )
            logger.info("Generating presigned URL")
            return self.custom_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": s3_bucket_name, "Key": file_key},
                ExpiresIn=self.presigned_url_expiry,
            )
        return None

    def download_file(self, s3_bucket_name: str, file_key: str, download_path: str):
        return self.client.download_file(s3_bucket_name, file_key, download_path)

    def upload_file(self, file_name: str, s3_bucket_name: str, file_key: str):
        return self.client.upload_file(file_name, s3_bucket_name, file_key)

    def upload_file_with_extra_args(
        self,
        file_name: str,
        s3_bucket_name: str,
        file_key: str,
        extra_args: Mapping[str, Any],
    ):
        return self.client.upload_file(file_name, s3_bucket_name, file_key, extra_args)

    def copy_across_bucket(
        self,
        source_bucket: str,
        source_file_key: str,
        dest_bucket: str,
        dest_file_key: str,
        if_none_match: bool = False,
        retry_on_conflict: bool = True,
    ):
        copy_source_params = {"Bucket": source_bucket, "Key": source_file_key}
        copy_object_params = {
            "Bucket": dest_bucket,
            "Key": dest_file_key,
            "CopySource": copy_source_params,
            "StorageClass": "INTELLIGENT_TIERING",
        }
        if if_none_match:
            copy_object_params["IfNoneMatch"] = "*"
        try:
            return self.client.copy_object(**copy_object_params)
        except ClientError as e:
            if e.response["ResponseMetadata"]["HTTPStatusCode"] == 409:
                logger.info(f"Copy failed due to conflict, retrying: {e}")
                if retry_on_conflict:
                    return self.copy_across_bucket(
                        source_bucket,
                        source_file_key,
                        dest_bucket,
                        dest_file_key,
                        if_none_match,
                        False,
                    )
                raise e
            else:
                logger.error(f"Copy failed: {e}")
                raise e

    def delete_object(
        self,
        s3_bucket_name: str,
        file_key: str,
        version_id: str | None = None,
    ):
        if version_id is None:
            return self.client.delete_object(Bucket=s3_bucket_name, Key=file_key)

        return self.client.delete_object(
            Bucket=s3_bucket_name,
            Key=file_key,
            VersionId=version_id,
        )

    def create_object_tag(
        self,
        s3_bucket_name: str,
        file_key: str,
        tag_key: str,
        tag_value: str,
    ):
        return self.client.put_object_tagging(
            Bucket=s3_bucket_name,
            Key=file_key,
            Tagging={
                "TagSet": [
                    {"Key": tag_key, "Value": tag_value},
                ],
            },
        )

    def get_tag_value(self, s3_bucket_name: str, file_key: str, tag_key: str) -> str:
        response = self.client.get_object_tagging(
            Bucket=s3_bucket_name,
            Key=file_key,
        )
        for key_value_pair in response["TagSet"]:
            if key_value_pair["Key"] == tag_key:
                return key_value_pair["Value"]

        raise TagNotFoundException(
            f"Object {file_key} doesn't have a tag of key {tag_key}",
        )

    def file_exist_on_s3(self, s3_bucket_name: str, file_key: str) -> bool:
        try:
            response = self.client.head_object(Bucket=s3_bucket_name, Key=file_key)
            if response["ResponseMetadata"]["HTTPStatusCode"] == 200:
                return True
            return False
        except (KeyError, AttributeError) as e:
            logger.info(str(e), {"Result": "Failed to check if file exists on s3"})
            return False
        except ClientError as e:
            error_message = str(e)
            if (
                "An error occurred (403)" in error_message
                or "An error occurred (404)" in error_message
            ):
                return False
            logger.error(str(e), {"Result": "Failed to check if file exists on s3"})
            raise e

    def list_all_objects(self, bucket_name: str) -> list[dict]:
        s3_paginator = self.client.get_paginator("list_objects_v2")
        s3_list_objects_result = []
        for paginated_result in s3_paginator.paginate(Bucket=bucket_name):
            s3_list_objects_result += paginated_result.get("Contents", [])
        return s3_list_objects_result

    def get_file_size(self, s3_bucket_name: str, object_key: str) -> int:
        response = self.client.head_object(Bucket=s3_bucket_name, Key=object_key)
        return response.get("ContentLength", 0)

    def get_head_object(self, bucket: str, key: str):
        return self.client.head_object(Bucket=bucket, Key=key)

    def get_object_stream(self, bucket: str, key: str, byte_range: str | None = None):
        params = {"Bucket": bucket, "Key": key}
        if byte_range:
            params["Range"] = byte_range
        response = self.client.get_object(**params)
        return response.get("Body")

    def stream_s3_object_to_memory(self, bucket: str, key: str) -> BytesIO:
        response = self.client.get_object(Bucket=bucket, Key=key)
        buf = BytesIO()
        for chunk in iter(lambda: response["Body"].read(64 * 1024), b""):
            buf.write(chunk)
        buf.seek(0)
        return buf

    def upload_file_obj(
        self,
        file_obj: io.BytesIO,
        s3_bucket_name: str,
        file_key: str,
        extra_args: Mapping[str, Any] = None,
    ):
        try:
            self.client.upload_fileobj(
                Fileobj=file_obj,
                Bucket=s3_bucket_name,
                Key=file_key,
                ExtraArgs=extra_args or {},
            )
            logger.info(f"Uploaded file object to s3://{s3_bucket_name}/{file_key}")
        except ClientError as e:
            logger.error(
                f"Failed to upload file object to s3://{s3_bucket_name}/{file_key} - {e}",
            )
            raise e

    def save_or_create_file(self, source_bucket: str, file_key: str, body: bytes):
        return self.client.put_object(
            Bucket=source_bucket,
            Key=file_key,
            Body=BytesIO(body),
        )

    def list_object_keys(self, bucket_name: str, prefix: str) -> list[str]:
        paginator = self.client.get_paginator("list_objects_v2")
        keys: list[str] = []

        for page in paginator.paginate(Bucket=bucket_name, Prefix=prefix):
            for obj in page.get("Contents", []):
                keys.append(obj["Key"])

        return keys

    def get_object_tags_versioned(
        self,
        bucket: str,
        key: str,
        version_id: str | None,
    ) -> list[dict[str, str]]:
        try:
            params = {"Bucket": bucket, "Key": key}
            if version_id:
                params["VersionId"] = version_id
            response = self.client.get_object_tagging(**params)
            return response.get("TagSet", [])
        except ClientError as e:
            logger.error(
                f"Failed to get object tags for s3://{bucket}/{key} with this version_id {version_id}",
            )
            logger.error(f"Got the following exception :{e}")
            return []
