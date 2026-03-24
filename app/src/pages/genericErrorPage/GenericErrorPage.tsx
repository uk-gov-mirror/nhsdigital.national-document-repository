import { useLocation, useNavigate } from 'react-router-dom';
import BackButton from '../../components/generic/backButton/BackButton';
import { Button } from 'nhsuk-react-components';
import { routes } from '../../types/generic/routes';
import { UIErrors, UIErrorCode } from '../../types/generic/errors';
import useTitle from '../../helpers/hooks/useTitle';

const GenericErrorPage = (): React.JSX.Element => {
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const errorCode = searchParams.get('errorCode') as UIErrorCode;

    const error = UIErrors[errorCode];
    const pageTitle = error?.title ?? 'An error has occurred';
    useTitle({ pageTitle });

    if (!error) {
        navigate(routes.HOME);
        return <></>;
    }

    return (
        <>
            <BackButton />

            <h1>{error.title}</h1>

            {error.messageParagraphs.map((msg, index) => (
                <p key={`error-message-${index}`}>{msg}</p>
            ))}

            <Button
                data-testid="go-to-home-button"
                onClick={(): void => {
                    navigate(routes.HOME);
                }}
            >
                Go to home
            </Button>
        </>
    );
};

export default GenericErrorPage;
