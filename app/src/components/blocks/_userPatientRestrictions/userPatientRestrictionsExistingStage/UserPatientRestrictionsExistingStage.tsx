import { Button, Table } from 'nhsuk-react-components';
import useTitle from '../../../../helpers/hooks/useTitle';
import BackButton from '../../../generic/backButton/BackButton';
import PatientSummary from '../../../generic/patientSummary/PatientSummary';
import { UserPatientRestriction } from '../../../../types/generic/userPatientRestriction';
import { getFormattedDateFromString } from '../../../../helpers/utils/formatDate';
import { Link, useNavigate } from 'react-router-dom';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import getUserPatientRestrictions from '../../../../helpers/requests/userPatientRestrictions/getUserPatientRestrictions';
import usePatient from '../../../../helpers/hooks/usePatient';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import { AxiosError } from 'axios';
import { isMock } from '../../../../helpers/utils/isLocal';
import { buildUserRestrictions } from '../../../../helpers/test/testBuilders';
import { errorToParams } from '../../../../helpers/utils/errorToParams';
import Spinner from '../../../generic/spinner/Spinner';
import formatSmartcardNumber from '../../../../helpers/utils/formatSmartcardNumber';

type Props = {
    existingRestrictions: UserPatientRestriction[];
    setExistingRestrictions: Dispatch<SetStateAction<UserPatientRestriction[]>>;
};

const UserPatientRestrictionsExistingStage = ({
    existingRestrictions,
    setExistingRestrictions,
}: Props): React.JSX.Element => {
    const navigate = useNavigate();
    const pageTitle = 'Existing restrictions on this patient record';
    useTitle({ pageTitle });
    const patient = usePatient();
    const baseAPIUrl = useBaseAPIUrl();
    const baseAPIHeaders = useBaseAPIHeaders();

    const [isLoading, setIsLoading] = useState<boolean>(true);
    const mountedRef = useRef(false);

    const loadRestrictions = async (): Promise<void> => {
        try {
            const { restrictions } = await getUserPatientRestrictions({
                nhsNumber: patient?.nhsNumber || '',
                baseAPIUrl,
                baseAPIHeaders,
                limit: 100,
            });

            if (restrictions.length === 0) {
                navigate(routeChildren.USER_PATIENT_RESTRICTIONS_SEARCH_STAFF, { replace: true });
                return;
            }

            setExistingRestrictions(restrictions);
        } catch (e) {
            const error = e as AxiosError;
            if (isMock(error)) {
                setExistingRestrictions(buildUserRestrictions());
            } else if (error.response?.status === 403) {
                navigate(routes.SESSION_EXPIRED);
            } else {
                navigate(routes.SERVER_ERROR + errorToParams(error));
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!mountedRef.current) {
            mountedRef.current = true;
            loadRestrictions();
        }
    }, []);

    return (
        <>
            <BackButton />

            {isLoading ? (
                <Spinner status="Loading..." />
            ) : (
                <div className="user-patient-restrictions-existing-stage">
                    <h1>{pageTitle}</h1>

                    <h3>This patient has existing restrictions on their record:</h3>

                    <PatientSummary oneLine />

                    <h3 className="mt-5 inline-block">
                        Staff members restricted from accessing this patient record:
                    </h3>

                    <Table responsive>
                        <Table.Head>
                            <Table.Row>
                                <Table.Cell>Staff member</Table.Cell>
                                <Table.Cell>NHS smartcard number</Table.Cell>
                                <Table.Cell>Date restriction added</Table.Cell>
                            </Table.Row>
                        </Table.Head>
                        <Table.Body>
                            {existingRestrictions.map((restriction) => (
                                <Table.Row key={restriction.id}>
                                    <Table.Cell>
                                        {`${restriction.restrictedUserFirstName} ${restriction.restrictedUserLastName}`}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {formatSmartcardNumber(restriction.restrictedUser)}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {getFormattedDateFromString(restriction.created)}
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>

                    <div className="action-buttons">
                        <Button
                            className="continue-button"
                            data-testid="add-restriction-button"
                            onClick={(): void => {
                                navigate(routeChildren.USER_PATIENT_RESTRICTIONS_SEARCH_STAFF);
                            }}
                        >
                            Continue to add a restriction
                        </Button>
                        <Link className="ml-4" to={routes.HOME}>
                            Cancel without adding a restriction
                        </Link>
                    </div>
                </div>
            )}
        </>
    );
};

export default UserPatientRestrictionsExistingStage;
