import { JSX } from 'react';
import BackButton from '../../../generic/backButton/BackButton';
import { Button } from 'nhsuk-react-components';
import { routeChildren } from '../../../../types/generic/routes';
import { useNavigate } from 'react-router-dom';
import { downloadFile } from '../../../../helpers/utils/downloadFile';

type Props = {
    reassignedPagesBlob: Blob;
};

const DocumentReassignDownloadStage = ({ reassignedPagesBlob }: Props): JSX.Element => {
    const navigate = useNavigate();

    const handleDownload = (): void => {
        downloadFile(reassignedPagesBlob, 'removed_pages.pdf');
        navigate(routeChildren.DOCUMENT_REASSIGN_DOWNLOAD_PAGES_CHECK);
    };

    return (
        <>
            <BackButton />
            <h1>Download these pages</h1>
            <p>
                You must download these pages, then print and send them to Primary Care Support
                England following their{' '}
                <a
                    href="https://pcse.england.nhs.uk/services/medical-records/moving-medical-records"
                    className="nhsuk-link"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="process for record transfers - opens in a new tab"
                >
                    process for record transfers
                </a>
                .
            </p>
            <Button onClick={handleDownload}>Download these pages</Button>
        </>
    );
};

export default DocumentReassignDownloadStage;
