import { Card } from 'nhsuk-react-components';
import { routes } from '../../types/generic/routes';
import useTitle from '../../helpers/hooks/useTitle';
import { ReactComponent as RightCircleIcon } from '../../styles/right-chevron-circle.svg';
import { useNavigate } from 'react-router-dom';

const HomePage = (): React.JSX.Element => {
    const navigate = useNavigate();
    useTitle({ pageTitle: 'Access and store digital patient documents' });

    return (
        <>
            <h1 className="smaller-title">Access and store digital patient documents</h1>
            <h3>Select an action</h3>
            <Card.Group>
                <Card.GroupItem width="one-half">
                    <Card clickable cardType="primary">
                        <Card.Content className="home-action-card-content">
                            <Card.Heading className="nhsuk-heading-m">
                                <Card.Link
                                    data-testid="search-patient-btn"
                                    href="#"
                                    onClick={(e): void => {
                                        e.preventDefault();
                                        navigate(routes.SEARCH_PATIENT);
                                    }}
                                >
                                    Patient records stored in this service
                                </Card.Link>
                            </Card.Heading>
                            <Card.Description>
                                Upload, view, manage, and add files or documents to a Lloyd George
                                record
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
                                    data-testid="admin-hub-btn"
                                    href="#"
                                    onClick={(e): void => {
                                        e.preventDefault();
                                        navigate(routes.ADMIN_ROUTE);
                                    }}
                                >
                                    Admin hub
                                </Card.Link>
                            </Card.Heading>
                            <Card.Description>Here you can:</Card.Description>
                            <ul className="mt-4">
                                <li>review and action pending patient documents</li>
                                <li>download a report on the records stored in this service</li>
                                <li>add and manage restrictions on accessing patient records</li>
                            </ul>
                            <RightCircleIcon />
                        </Card.Content>
                    </Card>
                </Card.GroupItem>
            </Card.Group>
        </>
    );
};

export default HomePage;
