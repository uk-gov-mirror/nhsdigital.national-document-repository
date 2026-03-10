import { ReportData } from '../../../../types/generic/reports';
import { routes } from '../../../../types/generic/routes';
import { Button, Card } from 'nhsuk-react-components';
import { getFormattedDate } from '../../../../helpers/utils/formatDate';
import useTitle from '../../../../helpers/hooks/useTitle';
import { JSX } from 'react';
import { useNavigate } from 'react-router-dom';

type Props = {
    report: ReportData;
};

const DownloadReportCompleteStage = (props: Props): JSX.Element => {
    const navigate = useNavigate();
    useTitle({ pageTitle: 'Download complete' });
    return (
        <div className="report_download-complete">
            <Card className="report_download-complete_details">
                <Card.Content className="report_download-complete_details-content">
                    <Card.Heading
                        className="report_download-complete_details-content_header"
                        data-testid="report-download-complete-header"
                        headingLevel="h1"
                    >
                        {props.report.reportType === 'PATIENT'
                            ? `You have downloaded the ${props.report.title} for:`
                            : `You have downloaded the report on documents to review`}
                    </Card.Heading>
                    <Card.Description
                        className="report_download-complete_details-content_description"
                        data-testid="report-download-complete-date"
                    >
                        {getFormattedDate(new Date())}
                    </Card.Description>
                </Card.Content>
            </Card>

            <h3>Keep this downloaded file safe</h3>
            <p>
                Store it in a safe location on your local system and remove it when it is no longer
                needed.
            </p>

            <Button
                href="#"
                onClick={(e: React.MouseEvent<HTMLAnchorElement>): void => {
                    e.preventDefault();
                    navigate(routes.HOME);
                }}
                className="mr-6"
                data-testid="home-button"
            >
                Go to home
            </Button>
            <Button
                secondary
                href="#"
                onClick={(e: React.MouseEvent<HTMLAnchorElement>): void => {
                    e.preventDefault();
                    navigate(`${routes.REPORT_DOWNLOAD}?reportType=${props.report.reportType}`);
                }}
                data-testid="back-to-download-page-button"
            >
                Go back to report download page
            </Button>
        </div>
    );
};

export default DownloadReportCompleteStage;
