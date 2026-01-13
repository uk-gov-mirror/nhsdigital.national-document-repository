import { JSX, useEffect, useRef, useState } from 'react';
import DocumentSelectStage from '../../_documentUpload/documentSelectStage/DocumentSelectStage';
import { getConfigForDocType } from '../../../../helpers/utils/documentType';
import { useNavigate } from 'react-router-dom';
import { ReviewDetails } from '../../../../types/generic/reviews';
import { routeChildren } from '../../../../types/generic/routes';
import {
    SetUploadDocuments,
    UploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';
import Spinner from '../../../generic/spinner/Spinner';

type Props = {
    reviewData: ReviewDetails | null;
    documents: UploadDocument[];
    setDocuments: SetUploadDocuments;
};

const ReviewDetailsDocumentSelectStage = ({
    reviewData,
    documents,
    setDocuments,
}: Props): JSX.Element => {
    const [documentsInitialised, setDocumentsInitialised] = useState(false);
    const filesErrorRef = useRef<boolean>(false);
    const navigate = useNavigate();

    const reviewKey = reviewData ? `${reviewData.id}.${reviewData.version}` : '';

    useEffect(() => {
        setDocumentsInitialised(false);
    }, [reviewKey]);

    useEffect(() => {
        if (!documentsInitialised && documents.length > 0) {
            setDocumentsInitialised(true);
        }
    }, [documents.length, documentsInitialised]);

    useEffect(() => {
        if (!documentsInitialised) {
            return;
        }
    }, [documents, documentsInitialised]);

    if (reviewData?.files === null || !documentsInitialised) {
        return <Spinner status={'Loading'} />;
    }

    const onSuccess = (): void => {
        navigate(
            routeChildren.ADMIN_REVIEW_UPLOAD_FILE_ORDER.replaceAll(
                ':reviewId',
                `${reviewData?.id}.${reviewData?.version}`,
            ),
        );
    };
    if (!reviewData?.snomedCode) {
        return <Spinner status={'Loading'} />;
    }

    return (
        <DocumentSelectStage
            documents={documents}
            setDocuments={setDocuments}
            documentType={reviewData.snomedCode}
            filesErrorRef={filesErrorRef}
            documentConfig={getConfigForDocType(reviewData.snomedCode)}
            onSuccessOverride={onSuccess}
            backLinkOverride={routeChildren.ADMIN_REVIEW_ADD_MORE_CHOICE.replaceAll(
                ':reviewId',
                `${reviewData?.id}.${reviewData?.version}`,
            )}
        />
    );
};

export default ReviewDetailsDocumentSelectStage;
