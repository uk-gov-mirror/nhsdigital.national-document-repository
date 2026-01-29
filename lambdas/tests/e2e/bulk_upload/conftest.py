import csv
from pathlib import Path
from typing import Dict, List

import boto3


def read_metadata_csv(datadir: Path, metadata_file: str) -> List[Dict]:
    metadatafile = datadir / metadata_file
    with open(metadatafile, newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        rows = [row for row in reader]
        return rows


def get_entry_from_table_by_nhs_number(nhs_number, table_entries):
    for entry in table_entries:
        if entry.get("NhsNumber") == nhs_number:
            return entry
    return None


def get_all_entries_from_table_by_nhs_number(nhs_number, table_entries):
    matching_entries = []
    for entry in table_entries:
        if entry.get("NhsNumber") == nhs_number:
            matching_entries.append(entry)
    return matching_entries


def empty_table(table_name):
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(table_name)

    response = table.scan(ProjectionExpression="ID")
    items = response.get("Items", [])

    # Delete initial page
    with table.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={"ID": item["ID"]})

    # Continue if paginated
    while "LastEvaluatedKey" in response:
        response = table.scan(
            ProjectionExpression="ID", ExclusiveStartKey=response["LastEvaluatedKey"]
        )
        items = response.get("Items", [])
        with table.batch_writer() as batch:
            for item in items:
                batch.delete_item(Key={"ID": item["ID"]})

    print(f"Emptied table {table_name}")
