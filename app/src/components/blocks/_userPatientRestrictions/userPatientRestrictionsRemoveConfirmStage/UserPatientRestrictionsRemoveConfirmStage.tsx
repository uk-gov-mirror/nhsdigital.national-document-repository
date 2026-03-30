import { Button, Table } from 'nhsuk-react-components';
import useTitle from '../../../../helpers/hooks/useTitle';
import { UserPatientRestriction } from '../../../../types/generic/userPatientRestriction';
import BackButton from '../../../generic/backButton/BackButton';
import { getFormattedDateFromString } from '../../../../helpers/utils/formatDate';
import { Link, useNavigate } from 'react-router-dom';
import deleteUserPatientRestriction from '../../../../helpers/requests/userPatientRestrictions/deleteUserPatientRestriction';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { useState } from 'react';
import SpinnerButton from '../../../generic/spinnerButton/SpinnerButton';
import { AxiosError } from 'axios';
import { isMock } from '../../../../helpers/utils/isLocal';
import { errorToParams } from '../../../../helpers/utils/errorToParams';
import formatSmartcardNumber from '../../../../helpers/utils/formatSmartcardNumber';

type Props = {
    restriction: UserPatientRestriction;
};

const UserPatientRestrictionsRemoveConfirmStage = ({ restriction }: Props): React.JSX.Element => {
    const navigate = useNavigate();
    const baseUrl = useBaseAPIUrl();
    const baseAPIHeaders = useBaseAPIHeaders();

    const [removing, setRemoving] = useState(false);

    const pageTitle = 'Are you sure you want to remove this restriction?';
    useTitle({ pageTitle });

    const confirmRemove = async (): Promise<void> => {
        setRemoving(true);

        try {
            await deleteUserPatientRestriction({
                restrictionId: restriction.id,
                nhsNumber: restriction.nhsNumber,
                baseUrl,
                baseAPIHeaders,
            });
        } catch (e) {
            const error = e as AxiosError;
            if (!isMock(error)) {
                if (error.response?.status === 403) {
                    navigate(routes.SESSION_EXPIRED);
                } else {
                    navigate(routes.SERVER_ERROR + errorToParams(error));
                }
                return;
            }
        }

        navigate(routeChildren.USER_PATIENT_RESTRICTIONS_ACTION_COMPLETE);
    };

    return (
        <>
            <BackButton />

            <h1>{pageTitle}</h1>

            <p>
                If you remove this restriction, staff that were restricted will be able to access
                this patient's record again.
            </p>

            <p>You are removing the restriction for this staff member:</p>

            <Table responsive>
                <Table.Head>
                    <Table.Row>
                        <Table.Cell>Staff member</Table.Cell>
                        <Table.Cell>NHS smartcard number</Table.Cell>
                        <Table.Cell>Date restriction added</Table.Cell>
                    </Table.Row>
                </Table.Head>

                <Table.Body>
                    <Table.Row>
                        <Table.Cell>
                            {restriction.restrictedUserFirstName}{' '}
                            {restriction.restrictedUserLastName}
                        </Table.Cell>
                        <Table.Cell>{formatSmartcardNumber(restriction.restrictedUser)}</Table.Cell>
                        <Table.Cell>{getFormattedDateFromString(restriction.created)}</Table.Cell>
                    </Table.Row>
                </Table.Body>
            </Table>

            {removing ? (
                <SpinnerButton id="removing-spinner" status="Removing..." />
            ) : (
                <div className="action-button-group">
                    <Button data-testid="confirm-remove-restriction-button" onClick={confirmRemove}>
                        Remove this restriction
                    </Button>
                    <Link
                        data-testid="cancel-remove-button"
                        to={''}
                        onClick={(e): void => {
                            e.preventDefault();
                            navigate(routeChildren.USER_PATIENT_RESTRICTIONS_LIST);
                        }}
                        className="ml-4"
                    >
                        Cancel
                    </Link>
                </div>
            )}
        </>
    );
};

export default UserPatientRestrictionsRemoveConfirmStage;
