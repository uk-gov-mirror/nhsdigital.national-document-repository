import { Table } from 'nhsuk-react-components';
import { JSX } from 'react';
import { SearchResult } from '../../../../types/generic/searchResult';

type ExistingRecordTableProps = {
    existingFiles: SearchResult[];
    onFileView: (filename: string, id: string) => void;
};

const ExistingRecordTable = ({
    existingFiles,
    onFileView,
}: ExistingRecordTableProps): JSX.Element => {
    return (
        <section className="existing-files mb-4">
            <h2>Existing files</h2>
            <Table>
                <Table.Head>
                    <Table.Row>
                        <Table.Cell className="word-break-keep-all">Filename</Table.Cell>
                        <Table.Cell className="word-break-keep-all">View file</Table.Cell>
                    </Table.Row>
                </Table.Head>
                <Table.Body>
                    {existingFiles.map((file) => (
                        <Table.Row key={file.fileName}>
                            <Table.Cell>
                                <strong>{file.fileName}</strong>
                            </Table.Cell>
                            <Table.Cell>
                                <button
                                    type="button"
                                    aria-label={`View ${file.fileName}`}
                                    className="link-button"
                                    onClick={(): void => {
                                        onFileView(file.fileName, file.id);
                                    }}
                                >
                                    View
                                </button>
                            </Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table>
        </section>
    );
};

export default ExistingRecordTable;
