import { Card } from 'nhsuk-react-components';
import { JSX } from 'react';
import useTitle from '../../../../helpers/hooks/useTitle';
import { ReactComponent as RightCircleIcon } from '../../../../styles/right-chevron-circle.svg';
import BackButton from '../../../generic/backButton/BackButton';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { useNavigate } from 'react-router-dom';

const UserPatientRestrictionsIndex = (): JSX.Element => {
    const navigate = useNavigate();
    useTitle({ pageTitle: 'Restrict staff from accessing patient records' });

    return (
        <>
            <BackButton toLocation={routes.ADMIN_ROUTE} dataTestid="user-restrictions-back-btn" />
            <h1>Restrict staff from accessing patient records</h1>
            <Card.Group>
                <Card.GroupItem width="one-half">
                    <Card clickable cardType="primary">
                        <Card.Content>
                            <Card.Heading className="nhsuk-heading-m">
                                <Card.Link
                                    data-testid="add-user-restriction-btn"
                                    href="#"
                                    onClick={(e): void => {
                                        e.preventDefault();
                                        navigate(routeChildren.USER_PATIENT_RESTRICTIONS_ADD);
                                    }}
                                >
                                    Add a restriction
                                </Card.Link>
                            </Card.Heading>
                            <Card.Description>
                                Restrict a staff member from accessing a patient record.
                            </Card.Description>
                            <RightCircleIcon />
                        </Card.Content>
                    </Card>
                </Card.GroupItem>
                <Card.GroupItem width="one-half">
                    <Card clickable cardType="primary">
                        <Card.Content>
                            <Card.Heading className="nhsuk-heading-m">
                                <Card.Link
                                    data-testid="view-user-restrictions-btn"
                                    href="#"
                                    onClick={(e): void => {
                                        e.preventDefault();
                                        navigate(routeChildren.USER_PATIENT_RESTRICTIONS_LIST);
                                    }}
                                >
                                    View and remove a restriction
                                </Card.Link>
                            </Card.Heading>
                            <Card.Description>
                                View and remove restrictions for staff at your practice.
                            </Card.Description>
                            <RightCircleIcon />
                        </Card.Content>
                    </Card>
                </Card.GroupItem>
            </Card.Group>
        </>
    );
};

export default UserPatientRestrictionsIndex;
