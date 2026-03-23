import { useEffect, type ReactNode } from 'react';
import { routes } from '../../../types/generic/routes';
import { useNavigate } from 'react-router-dom';
import usePatient from '../../../helpers/hooks/usePatient';

type Props = {
    children: ReactNode;
    navigationPath?: string;
};

const PatientGuard = ({ children, navigationPath }: Props): React.JSX.Element => {
    const patient = usePatient();
    const navigate = useNavigate();

    useEffect(() => {
        if (!patient) {
            navigate(navigationPath || routes.SEARCH_PATIENT);
        }
    }, [patient, navigate, navigationPath]);

    if (!patient) {
        return <></>;
    }

    return <>{children}</>;
};

export default PatientGuard;
