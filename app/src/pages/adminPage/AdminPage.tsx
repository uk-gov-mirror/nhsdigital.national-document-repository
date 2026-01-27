import { Card } from 'nhsuk-react-components';
import { JSX } from 'react';
import useTitle from '../../helpers/hooks/useTitle';
import { ReactComponent as RightCircleIcon } from '../../styles/right-chevron-circle.svg';
import { routeChildren, routes } from '../../types/generic/routes';
import { REPORT_TYPE } from '../../types/generic/reports';
import { useNavigate } from 'react-router-dom';

export const AdminPage = (): JSX.Element => {
    const navigate = useNavigate();
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
                                    href="#"
                                    onClick={(): void => {
                                        navigate(routeChildren.ADMIN_REVIEW);
                                    }}
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
                <Card.GroupItem width="one-half">
                    <Card clickable cardType="primary">
                        <Card.Content>
                            <Card.Heading className="nhsuk-heading-m">
                                <Card.Link
                                    data-testid="download-report-btn"
                                    href={`${routes.REPORT_DOWNLOAD}?reportType=${REPORT_TYPE.ODS_PATIENT_SUMMARY}`}
                                >
                                    Download a report
                                </Card.Link>
                            </Card.Heading>
                            <Card.Description>
                                This report shows the list of Lloyd George records stored for your
                                organisation.
                            </Card.Description>
                            <RightCircleIcon />
                        </Card.Content>
                    </Card>
                </Card.GroupItem>
            </Card.Group>
        </>
    );
};
