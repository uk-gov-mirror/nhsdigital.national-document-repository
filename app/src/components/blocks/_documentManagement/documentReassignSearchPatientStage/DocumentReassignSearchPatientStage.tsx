import { useNavigate } from 'react-router-dom';
import { PatientDetails } from '../../../../types/generic/patientDetails';
import PatientSearchForm from '../../../generic/patientSearchForm/PatientSearchForm';
import { Dispatch, SetStateAction } from 'react';
import { routeChildren } from '../../../../types/generic/routes';
import BackButton from '../../../generic/backButton/BackButton';
import PdfViewer from '../../../generic/pdfViewer/PdfViewer';

type Props = {
    reassignedPagesBlob: Blob;
    setPatientForReassign: Dispatch<SetStateAction<PatientDetails | null>>;
};

const DocumentReassignSearchPatientStage = ({
    reassignedPagesBlob,
    setPatientForReassign,
}: Props): React.JSX.Element => {
    const navigate = useNavigate();

    const onSearchSuccess = (patientDetails: PatientDetails): void => {
        setPatientForReassign(patientDetails);
        navigate(routeChildren.DOCUMENT_REASSIGN_VERIFY_PATIENT_DETAILS);
    };

    const dontKnowNhsNumberClicked = (): void => {
        setPatientForReassign(null);
        navigate(routeChildren.DOCUMENT_REASSIGN_DOWNLOAD_PAGES);
    };

    return (
        <>
            <BackButton />

            <PatientSearchForm
                title="Search for the correct patient"
                subtitle="Enter the NHS number to find the correct patient demographics for these pages."
                onSuccess={onSearchSuccess}
                secondaryActionText="I don't know the NHS number"
                onSecondaryActionClicked={dontKnowNhsNumberClicked}
            />

            <PdfViewer fileUrl={URL.createObjectURL(reassignedPagesBlob)} />
        </>
    );
};

export default DocumentReassignSearchPatientStage;
