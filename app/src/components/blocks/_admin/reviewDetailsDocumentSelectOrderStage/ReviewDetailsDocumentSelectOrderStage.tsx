import { ReactElement, useState } from 'react';
import DocumentSelectOrderStage from '../../_documentUpload/documentSelectOrderStage/DocumentSelectOrderStage';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../../../helpers/utils/documentType';
import { UploadDocument } from '../../../../types/pages/UploadDocumentsPage/types';

type Props = {
    reviewSnoMed?: DOCUMENT_TYPE;
};

const ReviewDetailsDocumentSelectOrderStage = ({ reviewSnoMed }: Props): ReactElement => {
    const [documents, setDocuments] = useState<Array<UploadDocument>>([]);
    const [, setMergedPdfBlob] = useState<Blob | undefined>(undefined);

    return (
        <DocumentSelectOrderStage
            documents={documents}
            setDocuments={setDocuments}
            setMergedPdfBlob={setMergedPdfBlob}
            existingDocuments={undefined}
            documentConfig={getConfigForDocType(reviewSnoMed!)}
            confirmFiles={(): void => {}}
        />
    );
};

export default ReviewDetailsDocumentSelectOrderStage;
