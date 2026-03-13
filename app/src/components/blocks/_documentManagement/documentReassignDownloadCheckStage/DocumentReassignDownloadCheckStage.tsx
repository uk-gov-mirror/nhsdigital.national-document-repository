import { Button, WarningCallout } from 'nhsuk-react-components';
import BackButton from '../../../generic/backButton/BackButton';
import LinkButton from '../../../generic/linkButton/LinkButton';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import SpinnerButton from '../../../generic/spinnerButton/SpinnerButton';

type Props = {
    removePages: () => void;
};

const DocumentReassignDownloadCheckStage = ({ removePages }: Props): React.JSX.Element => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    return (
        <>
            <BackButton />

            <h1>Check these pages have downloaded to your computer</h1>

            <WarningCallout>
                <WarningCallout.Label>Important</WarningCallout.Label>
                <p>Check these pages have downloaded to your computer.</p>
            </WarningCallout>

            {isLoading ? (
                <SpinnerButton
                    id="processing-spinner"
                    dataTestId="processing-spinner"
                    disabled
                    status="Processing..."
                />
            ) : (
                <>
                    <Button
                        data-testid="finish-button"
                        onClick={(): void => {
                            setIsLoading(true);
                            removePages();
                        }}
                    >
                        Finish
                    </Button>

                    <LinkButton
                        data-testid="go-back-link"
                        onClick={(): void => {
                            navigate(-1);
                        }}
                    >
                        {'Go back to download the pages'}
                    </LinkButton>
                </>
            )}
        </>
    );
};

export default DocumentReassignDownloadCheckStage;
