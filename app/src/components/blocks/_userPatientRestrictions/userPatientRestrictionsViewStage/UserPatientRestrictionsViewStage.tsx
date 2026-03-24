import { AxiosError } from 'axios';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import usePatient from '../../../../helpers/hooks/usePatient';
import getUserPatientRestrictions from '../../../../helpers/requests/userPatientRestrictions/getUserPatientRestrictions';
import { isMock } from '../../../../helpers/utils/isLocal';
import {
    UserPatientRestriction,
    UserPatientRestrictionsSubRoute,
} from '../../../../types/generic/userPatientRestriction';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { buildUserRestrictions } from '../../../../helpers/test/testBuilders';
import BackButton from '../../../generic/backButton/BackButton';
import useTitle from '../../../../helpers/hooks/useTitle';
import { Button, Table } from 'nhsuk-react-components';
import PatientSummary from '../../../generic/patientSummary/PatientSummary';
import { getFormattedDateFromString } from '../../../../helpers/utils/formatDate';
import useSmartcardNumber from '../../../../helpers/hooks/useSmartcardNumber';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { Link, useNavigate } from 'react-router-dom';
import { errorToParams } from '../../../../helpers/utils/errorToParams';
import { ErrorResponse } from '../../../../types/generic/errorResponse';
import { UIErrorCode } from '../../../../types/generic/errors';
import formatSmartcardNumber from '../../../../helpers/utils/formatSmartcardNumber';
import SpinnerV2 from '../../../generic/spinnerV2/SpinnerV2';

type Props = {
    setSubRoute: Dispatch<SetStateAction<UserPatientRestrictionsSubRoute | null>>;
    onRemoveRestriction: (restriction: UserPatientRestriction) => void;
};

const UserPatientRestrictionsViewStage = ({
    setSubRoute,
    onRemoveRestriction,
}: Props): React.JSX.Element => {
    const navigate = useNavigate();
    const patientDetails = usePatient();
    const userSmartcardNumber = useSmartcardNumber();
    const baseAPIUrl = useBaseAPIUrl();
    const baseAPIHeaders = useBaseAPIHeaders();

    const [restrictions, setRestrictions] = useState<UserPatientRestriction[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const mountedRef = useRef<boolean>(false);

    const pageTitle = 'Restrictions on accessing this patient record';
    useTitle({ pageTitle });

    useEffect(() => {
        if (!isLoading && !mountedRef.current) {
            mountedRef.current = true;
            loadPatientRestrictions();
        }
    }, [isLoading]);

    const loadPatientRestrictions = async (): Promise<void> => {
        setIsLoading(true);
        try {
            const { restrictions } = await getUserPatientRestrictions({
                nhsNumber: patientDetails!.nhsNumber,
                baseAPIUrl,
                baseAPIHeaders,
                limit: 100,
            });

            setRestrictions(restrictions);
        } catch (e) {
            const error = e as AxiosError;
            const errorInfo = error.response?.data as ErrorResponse;
            if (isMock(error)) {
                setRestrictions(buildUserRestrictions());
            } else if (errorInfo?.err_code === 'SP_4006') {
                navigate(
                    routes.GENERIC_ERROR + '?errorCode=' + UIErrorCode.PATIENT_ACCESS_RESTRICTED,
                    { replace: true },
                );
            } else if (error.response?.status === 403) {
                navigate(routes.SESSION_EXPIRED);
            } else {
                navigate(routes.SERVER_ERROR + errorToParams(error));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const addRestrictionClicked = (): void => {
        setSubRoute(UserPatientRestrictionsSubRoute.ADD);
        navigate(routeChildren.USER_PATIENT_RESTRICTIONS_ADD);
    };

    return (
        <>
            <BackButton />

            <h1>{pageTitle}</h1>

            <Button data-testid="add-restriction-button" onClick={addRestrictionClicked}>
                Add a restriction to this patient record
            </Button>

            <p>You cannot remove a restriction against your own NHS smartcard number.</p>

            <h3 className="inline-block">
                You are viewing the restrictions on this patient record:
            </h3>

            <PatientSummary oneLine />

            <h3 className="mt-4 inline-block">
                Staff members restriction from accessing this patient record:
            </h3>
            <Table responsive>
                <Table.Head>
                    <Table.Row>
                        <Table.Cell>Staff member</Table.Cell>
                        <Table.Cell>NHS smartcard number</Table.Cell>
                        <Table.Cell>Date restriction added</Table.Cell>
                        <Table.Cell>Remove restriction</Table.Cell>
                    </Table.Row>
                </Table.Head>
                <Table.Body>
                    {isLoading ? (
                        <Table.Row>
                            <Table.Cell colSpan={4}>
                                <SpinnerV2 status="Loading restrictions..." />
                            </Table.Cell>
                        </Table.Row>
                    ) : (
                        restrictions.map((restriction) => (
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
                                <Table.Cell>
                                    {userSmartcardNumber === restriction.restrictedUser ? (
                                        ''
                                    ) : (
                                        <Link
                                            to=""
                                            data-testid={`remove-restriction-button-${restriction.id}`}
                                            onClick={(): void => onRemoveRestriction(restriction)}
                                        >
                                            Remove
                                        </Link>
                                    )}
                                </Table.Cell>
                            </Table.Row>
                        ))
                    )}
                </Table.Body>
            </Table>
        </>
    );
};

export default UserPatientRestrictionsViewStage;
