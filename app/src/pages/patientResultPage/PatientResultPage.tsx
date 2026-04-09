import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { routeChildren, routes } from '../../types/generic/routes';
import BackButton from '../../components/generic/backButton/BackButton';
import ErrorBox from '../../components/layout/errorBox/ErrorBox';
import { REPOSITORY_ROLE } from '../../types/generic/authRole';
import useRole from '../../helpers/hooks/useRole';
import usePatient from '../../helpers/hooks/usePatient';
import useTitle from '../../helpers/hooks/useTitle';
import PatientVerifyForm from '../../components/generic/patientVerifyForm/PatientVerifyForm';

const PatientResultPage = (): React.JSX.Element => {
    const role = useRole();
    const patientDetails = usePatient();
    const userIsPCSE = role === REPOSITORY_ROLE.PCSE;
    const navigate = useNavigate();
    const [inputError, setInputError] = useState('');

    const submit = (): void => {
        if (userIsPCSE) {
            // Make PDS and Dynamo document store search request to download documents from patient
            navigate(routes.PATIENT_DOCUMENTS);
        } else {
            // Make PDS patient search request to upload documents to patient
            if (typeof patientDetails?.active === 'undefined') {
                setInputError('We cannot determine the active state of this patient');
                return;
            }

            if (patientDetails?.deceased) {
                navigate(routeChildren.PATIENT_ACCESS_AUDIT_DECEASED);
                return;
            }

            if (!patientDetails.canManageRecord) {
                navigate(routes.DOCUMENT_UPLOAD);
                return;
            }

            if (patientDetails?.active) {
                navigate(routes.PATIENT_DOCUMENTS);
                return;
            }

            navigate(routes.SEARCH_PATIENT);
        }
    };

    const pageHeader = 'Patient details';
    useTitle({ pageTitle: pageHeader });

    return (
        <div className="patient-results-paragraph">
            <BackButton toLocation={routes.SEARCH_PATIENT} />
            {inputError && (
                <ErrorBox
                    messageTitle={'There is a problem'}
                    messageLinkBody={inputError}
                    errorInputLink={'#patient-status'}
                    errorBoxSummaryId={'error-box-summary'}
                />
            )}
            <h1>{pageHeader}</h1>

            <PatientVerifyForm patientDetails={patientDetails!} onSubmit={submit} />
        </div>
    );
};

export default PatientResultPage;
