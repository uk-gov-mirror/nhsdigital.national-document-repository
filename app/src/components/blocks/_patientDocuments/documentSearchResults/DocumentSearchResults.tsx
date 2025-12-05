import { Table } from 'nhsuk-react-components';
import { SearchResult } from '../../../../types/generic/searchResult';
import { useSessionContext } from '../../../../providers/sessionProvider/SessionProvider';
import { REPOSITORY_ROLE } from '../../../../types/generic/authRole';
import { getFormattedDate } from '../../../../helpers/utils/formatDate';
import { getDocumentTypeLabel } from '../../../../helpers/utils/documentType';
import LinkButton from '../../../generic/linkButton/LinkButton';

type Props = {
    searchResults: Array<SearchResult>;
    onViewDocument?: (document: SearchResult) => void;
};

const DocumentSearchResults = (props: Props) => {
    const [session] = useSessionContext();

    const canViewFiles =
        session.auth!.role === REPOSITORY_ROLE.GP_ADMIN ||
        session.auth!.role === REPOSITORY_ROLE.GP_CLINICAL;

    return (
        <div className='document-search-results'>
            <h3 data-testid="subtitle">Records and documents stored for this patient</h3>
            <Table.Panel>
                <Table id="available-files-table-title" responsive={true}>
                    <Table.Head>
                        <Table.Row>
                            <Table.Cell className="table-column-header">Document type</Table.Cell>
                            <Table.Cell className="table-column-header">Filename</Table.Cell>
                            <Table.Cell className="table-column-header">Date uploaded</Table.Cell>
                            <Table.Cell className="table-column-header">View</Table.Cell>
                        </Table.Row>
                    </Table.Head>
                    <Table.Body>
                        {props.searchResults?.map((result, index) => (
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
                                    {getDocumentTypeLabel(result.documentSnomedCodeType) ?? 'Other'}
                                </Table.Cell>
                                <Table.Cell
                                    id={`available-files-row-${index}-filename`}
                                    data-testid="filename"
                                    className='filename-value'
                                >
                                    {result.fileName}
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
                                    {canViewFiles && props.onViewDocument && (
                                        <LinkButton
                                            onClick={() => props.onViewDocument!(result)}
                                            id={`available-files-row-${index}-view-link`}
                                            data-testid={`view-${index}-link`}
                                            href="#"
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
