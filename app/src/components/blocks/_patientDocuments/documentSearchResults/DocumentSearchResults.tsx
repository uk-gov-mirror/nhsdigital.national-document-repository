import { Table } from 'nhsuk-react-components';
import { SearchResult } from '../../../../types/generic/searchResult';
import { useSessionContext } from '../../../../providers/sessionProvider/SessionProvider';
import { REPOSITORY_ROLE } from '../../../../types/generic/authRole';
import { getFormattedDate } from '../../../../helpers/utils/formatDate';
import {
    DOCUMENT_TYPE_CONFIG,
    getConfigForDocTypeGeneric,
    getDocumentTypeLabel,
} from '../../../../helpers/utils/documentType';
import LinkButton from '../../../generic/linkButton/LinkButton';

type Props = {
    searchResults: Array<SearchResult>;
    onViewDocument?: (document: SearchResult) => void;
    documentConfig?: DOCUMENT_TYPE_CONFIG;
};

const DocumentSearchResults = ({
    searchResults,
    onViewDocument,
    documentConfig,
}: Props): React.JSX.Element => {
    const [session] = useSessionContext();

    const canViewFiles =
        session.auth!.role === REPOSITORY_ROLE.GP_ADMIN ||
        session.auth!.role === REPOSITORY_ROLE.GP_CLINICAL;

    const documentTypeLabel = (doc: SearchResult): string => {
        let docconfig = getConfigForDocTypeGeneric(doc.documentSnomedCodeType);

        const heading = docconfig.content.getValueFormatString<string>(
            'searchResultDocumentTypeLabel',
            {
                version: doc.version,
            },
        );

        return heading ?? getDocumentTypeLabel(doc.documentSnomedCodeType) ?? 'Documents';
    };

    return (
        <div className="document-search-results">
            <h3 className="subtitle" data-testid="subtitle">
                Records and documents stored for this patient
            </h3>
            <Table.Panel id="table-panel">
                <Table
                    id="available-files-table-title"
                    data-testid="available-files-table-title"
                    responsive={true}
                >
                    <Table.Head>
                        <Table.Row>
                            <Table.Cell className="table-column-header">Document type</Table.Cell>
                            <Table.Cell className="table-column-header">Filename</Table.Cell>
                            <Table.Cell className="table-column-header">Date uploaded</Table.Cell>
                            <Table.Cell className="table-column-header">View</Table.Cell>
                        </Table.Row>
                    </Table.Head>
                    <Table.Body>
                        {searchResults?.map((result, index) => (
                            <Table.Row
                                className={'available-files-row'}
                                id={`available-files-row-${index}`}
                                key={`document-${result.fileName + result.created}`}
                                data-testid="search-result"
                            >
                                <Table.Cell
                                    id={`available-files-row-${index}-document-type`}
                                    data-testid="doctype"
                                >
                                    {documentTypeLabel(result)}
                                </Table.Cell>
                                <Table.Cell
                                    id={`available-files-row-${index}-filename`}
                                    data-testid="filename"
                                    className="filename-value"
                                >
                                    {documentConfig?.filenameOverride
                                        ? documentConfig.filenameOverride
                                        : result.fileName}
                                </Table.Cell>
                                <Table.Cell
                                    id={`available-files-row-${index}-created-date`}
                                    data-testid="created"
                                >
                                    {getFormattedDate(new Date(result.created))}
                                </Table.Cell>
                                <Table.Cell
                                    id={`available-files-row-${index}-actions`}
                                    data-testid="actions"
                                >
                                    {canViewFiles && onViewDocument && (
                                        <LinkButton
                                            onClick={(e): void => {
                                                e.preventDefault();
                                                onViewDocument(result);
                                            }}
                                            id={`available-files-row-${index}-view-link`}
                                            data-testid={`view-${index}-link`}
                                            href="#"
                                            className="px-1 py-1"
                                        >
                                            View
                                        </LinkButton>
                                    )}
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </Table.Panel>
        </div>
    );
};

export default DocumentSearchResults;
