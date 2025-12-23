import { Card } from 'nhsuk-react-components';
import { JSX } from 'react';
import useTitle from '../../helpers/hooks/useTitle';
import { ReactComponent as RightCircleIcon } from '../../styles/right-chevron-circle.svg';
import { routeChildren } from '../../types/generic/routes';

export const AdminPage = (): JSX.Element => {
    useTitle({ pageTitle: 'Admin hub' });

    return (
        <>
            <h1>Admin hub</h1>
            <Card.Group>
                <Card.GroupItem width="one-half">
                    <Card clickable cardType="primary">
                        <Card.Content>
                            <Card.Heading className="nhsuk-heading-m">
                                <Card.Link
                                    data-testid="admin-reviews-btn"
                                    href={routeChildren.ADMIN_REVIEW}
                                >
                                    Review documents
                                </Card.Link>
                            </Card.Heading>
                            <Card.Description>
                                Review patient documents from practice to practice transfers, or
                                rejections from bulk transfer into this service.
                            </Card.Description>
                            <RightCircleIcon />
                        </Card.Content>
                    </Card>
                </Card.GroupItem>
            </Card.Group>
        </>
    );
};
