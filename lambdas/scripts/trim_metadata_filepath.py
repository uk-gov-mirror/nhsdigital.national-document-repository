#!/usr/bin/env python3
"""
Trim leading path components from a FILEPATH column in a CSV file.

Usage:
    python trim_filepath.py <csv_file> <levels> [output_file]

Arguments:
    csv_file    - Path to the input CSV file
    levels      - Number of leading path components to strip (e.g. 1 removes the top-level directory)
    output_file - Optional output path (defaults to <csv_file stem>_modified.csv)

Example:
    Input FILEPATH:  /org/dept/records/file.pdf
    With levels=1:   dept/records/file.pdf
    With levels=2:   records/file.pdf
"""

import csv
import sys
from pathlib import Path, PurePosixPath


def trim_filepath(filepath: str, levels: int) -> str:
    parts = PurePosixPath(filepath).parts
    # Strip leading '/' or drive component if present, then skip `levels` directories
    non_root = [p for p in parts if p != "/"]
    trimmed = non_root[levels:]
    return str(PurePosixPath(*trimmed)) if trimmed else ""


def process_csv(input_path: str, levels: int, output_path: str | None = None):
    if output_path is None:
        p = Path(input_path)
        output_path = str(p.with_stem(p.stem + "_modified"))

    with open(input_path, newline="", encoding="utf-8") as infile:
        reader = csv.DictReader(infile)

        if "FILEPATH" not in reader.fieldnames:
            print(
                f"Error: no 'FILEPATH' column found. Columns: {reader.fieldnames}",
                file=sys.stderr,
            )
            sys.exit(1)

        with open(output_path, "w", newline="", encoding="utf-8") as outfile:
            writer = csv.DictWriter(outfile, fieldnames=reader.fieldnames)
            writer.writeheader()
            for row in reader:
                row["FILEPATH"] = trim_filepath(row["FILEPATH"], levels)
                writer.writerow(row)

    print(f"Written to {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    csv_file = sys.argv[1]
    try:
        levels = int(sys.argv[2])
    except ValueError:
        print(f"Error: levels must be an integer, got '{sys.argv[2]}'", file=sys.stderr)
        sys.exit(1)

    output_file = sys.argv[3] if len(sys.argv) > 3 else None
    process_csv(csv_file, levels, output_file)
