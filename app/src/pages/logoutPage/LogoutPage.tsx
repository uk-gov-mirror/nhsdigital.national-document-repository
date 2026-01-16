import { useEffect } from 'react';
import { useSessionContext } from '../../providers/sessionProvider/SessionProvider';
import { useNavigate } from 'react-router-dom';
import Spinner from '../../components/generic/spinner/Spinner';
import useBaseAPIHeaders from '../../helpers/hooks/useBaseAPIHeaders';
import logout, { Args } from '../../helpers/requests/logout';
import useBaseAPIUrl from '../../helpers/hooks/useBaseAPIUrl';

const LogoutPage = (): React.JSX.Element => {
    const baseUrl = useBaseAPIUrl();
    const [, setSession] = useSessionContext();
    const navigate = useNavigate();
    const baseHeaders = useBaseAPIHeaders();

    useEffect(() => {
        const args: Args = { baseUrl, baseHeaders };

        const handleCallback = async (args: Args): Promise<void> => {
            try {
                await logout(args);
            } catch {
            } finally {
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/';
            }
        };

        handleCallback(args);
    }, [baseUrl, setSession, navigate, baseHeaders]);

    return <Spinner status="Signing out..." />;
};

export default LogoutPage;
