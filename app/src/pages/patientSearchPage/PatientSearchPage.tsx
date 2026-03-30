import { JSX } from 'react';
import { routes } from '../../types/generic/routes';
import { BackLink } from 'nhsuk-react-components';
import { useNavigate } from 'react-router-dom';
import { usePatientDetailsContext } from '../../providers/patientProvider/PatientProvider';
import { PatientDetails } from '../../types/generic/patientDetails';
import useTitle from '../../helpers/hooks/useTitle';
import PatientSearchForm from '../../components/generic/patientSearchForm/PatientSearchForm';

const PatientSearchPage = (): JSX.Element => {
    const [, setPatientDetails] = usePatientDetailsContext();
    const navigate = useNavigate();

    const handleSuccess = (patientDetails: PatientDetails): void => {
        setPatientDetails(patientDetails);
        navigate(routes.VERIFY_PATIENT);
    };

    const pageTitle = 'Search for a patient';
    useTitle({ pageTitle: pageTitle });

    return (
        <>
            <BackLink
                data-testid="go-to-home-link"
                asElement="a"
                href="#"
                onClick={(e): void => {
                    e.preventDefault();
                    navigate(routes.HOME);
                }}
            >
                Go to home
            </BackLink>

            <PatientSearchForm
                title={pageTitle}
                inputLabel="Enter an NHS number to view or upload a record"
                buttonText="Search"
                onSuccess={handleSuccess}
            />
        </>
    );
};

export default PatientSearchPage;
