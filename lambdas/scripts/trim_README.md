# trim_metadata_filepath.py

Trims leading path components from the `FILEPATH` column in a CSV file.

## Usage

```bash
python trim_metadata_filepath.py <csv_file> <levels> [output_file]
```

### Arguments

| Argument      | Required | Description                                                                 |
|---------------|----------|-----------------------------------------------------------------------------|
| `csv_file`    | Yes      | Path to the input CSV file                                                  |
| `levels`      | Yes      | Number of leading path components to strip                                  |
| `output_file` | No       | Path to write the result (defaults to stdout if omitted)                    |

## Examples

Given a CSV with a `FILEPATH` value of `/org/dept/records/file.pdf`:

```bash
# Strip 1 leading directory → dept/records/file.pdf
python trim_metadata_filepath.py records.csv 1

# Strip 2 leading directories → records/file.pdf
python trim_metadata_filepath.py records.csv 2 output.csv
```

## Notes

- All other columns in the CSV are passed through unchanged.
- The script exits with an error if no `FILEPATH` column is found.
- Leading `/` root components are handled automatically and do not count as a level.
