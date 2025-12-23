import { Table } from 'nhsuk-react-components';
import { JSX } from 'react';

type ExistingFile = {
    filename: string;
    documentUrl: string;
};

type ExistingRecordTableProps = {
    existingFiles: ExistingFile[];
    onFileView: (filename: string, documentUrl: string) => void;
};

const ExistingRecordTable = ({
    existingFiles,
    onFileView,
}: ExistingRecordTableProps): JSX.Element => {
    return (
        <section className="existing-files mb-4">
            <h2>Existing files</h2>
            <Table caption="">
                <Table.Head>
                    <Table.Row>
                        <Table.Cell className="word-break-keep-all">Filename</Table.Cell>
                        <Table.Cell className="word-break-keep-all">View file</Table.Cell>
                    </Table.Row>
                </Table.Head>
                <Table.Body>
                    {existingFiles.map((file) => (
                        <Table.Row key={file.filename}>
                            <Table.Cell>
                                <strong>{file.filename}</strong>
                            </Table.Cell>
                            <Table.Cell>
                                <button
                                    type="button"
                                    aria-label={`View ${file.filename}`}
                                    className="link-button"
                                    onClick={(): void => {
                                        onFileView(file.filename, file.documentUrl);
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
