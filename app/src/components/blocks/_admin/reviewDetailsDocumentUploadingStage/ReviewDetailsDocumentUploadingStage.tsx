import { JSX, useState } from 'react';
import DocumentUploadingStage from '../../_documentUpload/documentUploadingStage/DocumentUploadingStage';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../../../helpers/utils/documentType';
import { UploadDocument } from '../../../../types/pages/UploadDocumentsPage/types';

type Props = {
    reviewSnoMed?: DOCUMENT_TYPE;
};

const ReviewDetailsDocumentUploadingStage = ({ reviewSnoMed }: Props): JSX.Element => {
    const [documents] = useState<Array<UploadDocument>>([]);

    const startUpload = async (): Promise<void> => {
        // TODO: Implement upload logic for review details workflow PRMP-827
    };

    return (
        <DocumentUploadingStage
            documents={documents}
            startUpload={startUpload}
            documentConfig={getConfigForDocType(reviewSnoMed!)}
        />
    );
};

export default ReviewDetailsDocumentUploadingStage;
