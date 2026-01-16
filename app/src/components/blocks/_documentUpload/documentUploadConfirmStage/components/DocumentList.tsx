import { useState } from 'react';
import {
    DOCUMENT_TYPE,
    DOCUMENT_TYPE_CONFIG,
    getConfigForDocType,
} from '../../../../../helpers/utils/documentType';
import { UploadDocument } from '../../../../../types/pages/UploadDocumentsPage/types';
import { getJourney } from '../../../../../helpers/utils/urlManipulations';
import { Table } from 'nhsuk-react-components';
import Pagination from '../../../../generic/pagination/Pagination';

type Props = {
    documents: UploadDocument[];
    docType: DOCUMENT_TYPE;
    showViewFileColumn: boolean;
    setPreviewDocument: (doc: UploadDocument) => void;
    onRemoveFile?: (doc: UploadDocument) => void;
};
const DocumentList = ({
    documents,
    docType,
    showViewFileColumn,
    setPreviewDocument,
    onRemoveFile,
}: Props): React.JSX.Element => {
    const [currentPage, setCurrentPage] = useState<number>(0);
    const documentConfig = getConfigForDocType(docType);
    const pageSize = 10;

    const currentItems = (): UploadDocument[] => {
        const skipCount = currentPage * pageSize;
        return documents.slice(skipCount, skipCount + pageSize);
    };

    const totalPages = (): number => {
        return Math.ceil(documents.length / pageSize);
    };

    const getFileActionParagraph = (config: DOCUMENT_TYPE_CONFIG): string => {
        if (!config.stitched) {
            return '';
        }

        return getJourney() === 'update' 
            ? `Files will be added to the existing ${config.displayName} to create a single PDF document.` 
            : `Files will be combined into a single PDF document to create a ${config.displayName} record for this patient.`;
    };

    return (
        <>
            <h4>{documentConfig.content.confirmFilesTableTitle}</h4>
            <p>{documentConfig.content.confirmFilesTableParagraph}</p>
            <p>{getFileActionParagraph(documentConfig)}</p>

            <Table id={`selected-${docType}-table`} key={docType}>
                <Table.Head>
                    <Table.Row>
                        <Table.Cell>Filename</Table.Cell>
                        {documentConfig.stitched && (
                            <Table.Cell width="25%" className="word-break-keep-all">
                                Position
                            </Table.Cell>
                        )}
                        {showViewFileColumn && <Table.Cell>View file</Table.Cell>}
                        {onRemoveFile && <Table.Cell>Remove file</Table.Cell>}
                    </Table.Row>
                </Table.Head>

                <Table.Body>
                    {currentItems().map((document: UploadDocument) => {
                        return (
                            <Table.Row key={document.id} id={document.file.name}>
                                <Table.Cell>
                                    <div>
                                        <strong>{document.file.name}</strong>
                                    </div>
                                </Table.Cell>
                                {documentConfig.stitched && (
                                    <Table.Cell>{document.position}</Table.Cell>
                                )}
                                {showViewFileColumn && (
                                    <Table.Cell>
                                        {document.file.type === 'application/pdf' ? (
                                            <button
                                                className="govuk-link"
                                                rel="view"
                                                data-testid={`preview-${document.id}-button`}
                                                onClick={(e): void => {
                                                    e.preventDefault();
                                                    setPreviewDocument(document);
                                                }}
                                            >
                                                View
                                            </button>
                                        ) : (
                                            '-'
                                        )}
                                    </Table.Cell>
                                )}
                                {onRemoveFile && (
                                    <Table.Cell>
                                        <button
                                            className="govuk-link"
                                            rel="remove"
                                            data-testid={`remove-${document.id}-button`}
                                            onClick={(e): void => {
                                                e.preventDefault();
                                                onRemoveFile(document);
                                            }}
                                        >
                                            Remove
                                        </button>
                                    </Table.Cell>
                                )}
                                <Table.Cell></Table.Cell>
                            </Table.Row>
                        );
                    })}
                </Table.Body>
            </Table>

            <Pagination
                totalPages={totalPages()}
                currentPage={currentPage || 0}
                setCurrentPage={(page: number): void => {
                    setCurrentPage(page);
                }}
            />
        </>
    );
};

export default DocumentList;
