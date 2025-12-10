import { Card } from 'nhsuk-react-components';
import { JSX } from 'react';
import useTitle from '../../helpers/hooks/useTitle';
import { routeChildren } from '../../types/generic/routes';
import { ReactComponent as RightCircleIcon } from '../../styles/right-chevron-circle.svg';

export const AdminPage = (): JSX.Element => {
    useTitle({ pageTitle: 'Admin console' });

    return (
        <>
            <h1>Admin console</h1>
            <Card.Group>
                <Card.GroupItem width="one-half">
                    {/* Reviews  */}
                    <Card clickable cardType="primary">
                        <Card.Content>
                            <Card.Heading className="nhsuk-heading-m">
                                <Card.Link
                                    data-testid="admin-reviews-btn"
                                    href={routeChildren.ADMIN_REVIEW}
                                >
                                    Reviews
                                </Card.Link>
                            </Card.Heading>
                            <Card.Description>
                                Review documents from practice to practice transfers and rejections
                                from bulk transfer into this service.
                            </Card.Description>
                            <RightCircleIcon />
                        </Card.Content>
                    </Card>
                </Card.GroupItem>
            </Card.Group>
        </>
    );
};
