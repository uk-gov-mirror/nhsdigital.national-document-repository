import { JSX, useRef, useState } from 'react';
import DocumentSelectStage from '../../_documentUpload/documentSelectStage/DocumentSelectStage';
import { DOCUMENT_TYPE, DOCUMENT_TYPE_CONFIG, getConfigForDocType } from '../../../../helpers/utils/documentType';
import { UploadDocument } from '../../../../types/pages/UploadDocumentsPage/types';

type Props = {
    reviewSnoMed?: DOCUMENT_TYPE;
};

const ReviewDetailsDocumentSelectStage = ({ reviewSnoMed }: Props): JSX.Element => {
    const [documents, setDocuments] = useState<Array<UploadDocument>>([]);
    const filesErrorRef = useRef<boolean>(false);

    return (
        <DocumentSelectStage
            documents={documents}
            setDocuments={setDocuments}
            documentType={reviewSnoMed!}
            filesErrorRef={filesErrorRef}
            documentConfig={getConfigForDocType(reviewSnoMed!)}
        />
    );
};

export default ReviewDetailsDocumentSelectStage;
