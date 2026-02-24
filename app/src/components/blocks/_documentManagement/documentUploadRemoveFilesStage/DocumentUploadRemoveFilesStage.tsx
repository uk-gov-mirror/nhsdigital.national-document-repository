import {
    SetUploadDocuments,
    UploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';
import { routes } from '../../../../types/generic/routes';
import { Button } from 'nhsuk-react-components';
import useTitle from '../../../../helpers/hooks/useTitle';
import LinkButton from '../../../generic/linkButton/LinkButton';
import { useEnhancedNavigate } from '../../../../helpers/utils/urlManipulations';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';

type Props = {
    documents: UploadDocument[];
    setDocuments: SetUploadDocuments;
    documentType: DOCUMENT_TYPE;
    onSuccess?: () => void;
};

const DocumentUploadRemoveFilesStage = ({
    documents,
    setDocuments,
    documentType,
    onSuccess,
}: Props): React.JSX.Element => {
    const navigate = useEnhancedNavigate();

    const pageTitle = 'Are you sure you want to remove all selected files?';
    useTitle({ pageTitle });

    return (
        <>
            <h1>{pageTitle}</h1>
            <Button
                warning
                type="button"
                id="remove-files-button"
                data-testid="remove-files-button"
                onClick={(e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
                    e.preventDefault();
                    if (onSuccess) {
                        onSuccess();
                        return;
                    }
                    setDocuments(documents.filter((doc) => doc.docType !== documentType));
                    navigate.withParams(routes.DOCUMENT_UPLOAD);
                }}
            >
                Yes, remove all files
            </Button>

            <LinkButton
                onClick={(): void => {
                    navigate(-1);
                }}
            >
                Cancel
            </LinkButton>
        </>
    );
};

export default DocumentUploadRemoveFilesStage;
