import React, { useState } from 'react';
import type { MouseEvent } from 'react';
import { ButtonLink } from 'nhsuk-react-components';
import { useNavigate } from 'react-router-dom';
import Spinner from '../../components/generic/spinner/Spinner';
import { routes } from '../../types/generic/routes';
import { endpoints } from '../../types/generic/endpoints';
import { isLocal } from '../../helpers/utils/isLocal';
import useBaseAPIUrl from '../../helpers/hooks/useBaseAPIUrl';
import TestPanel from '../../components/blocks/testPanel/TestPanel';
import ServiceDeskLink from '../../components/generic/serviceDeskLink/ServiceDeskLink';
import useTitle from '../../helpers/hooks/useTitle';

const StartPage = (): React.JSX.Element => {
    const navigate = useNavigate();
    const baseAPIUrl = useBaseAPIUrl();
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = (e: MouseEvent<HTMLAnchorElement>): void => {
        setIsLoading(true);
        e.preventDefault();
        if (isLocal) {
            navigate(routes.AUTH_CALLBACK);
        } else {
            window.location.replace(`${baseAPIUrl}${endpoints.LOGIN}`);
        }
    };

    const pageHeader = 'Access and store digital patient documents';
    useTitle({ pageTitle: pageHeader });

    return !isLoading ? (
        <>
            <h1>{pageHeader}</h1>
            <p>
                This service gives you access to digital Lloyd George records. Within a record we
                store the following documents:
            </p>
            <ul>
                <li>Lloyd George scanned paper notes</li>
                <li>Electronic health record notes</li>
                <li>Electronic health record attachments</li>
                <li>Patient letters and documents</li>
            </ul>
            <p>
                You may have received a note within a patient's Lloyd George notes, stating that
                they have been digitised.
            </p>
            <p>If you are part of a GP practice, you can use this service to:</p>
            <ul>
                <li>view, upload, download or remove a document</li>
                <li>add files to a patient's scanned paper notes</li>
                <li>review and action pending patient documents</li>
                <li>download a report on the records stored in this service</li>
            </ul>
            <p>If you are managing records on behalf of NHS England, you can:</p>
            <ul>
                <li>download documents</li>
                <li>download a report on the records stored in this service</li>
            </ul>
            <p>Not every patient will have a digital record available.</p>
            <h2>Before you start</h2>
            <p>You’ll be asked for:</p>
            <ul>
                <li>your NHS smartcard</li>
                <li>patient details including their name, date of birth and NHS number</li>
            </ul>
            <ButtonLink data-testid="start-btn" onClick={handleLogin} href="#">
                Start now
            </ButtonLink>
            <h3>Get support with the service</h3>
            <p>
                {'Contact the '}
                <ServiceDeskLink />
                {' if there is an issue with this service or call 0300 303 5035.'}
            </p>
            {(import.meta.env.VITE_ENVIRONMENT === 'local' ||
                import.meta.env.VITE_ENVIRONMENT === 'development' ||
                import.meta.env.VITE_ENVIRONMENT === 'test') && <TestPanel />}
        </>
    ) : (
        <Spinner status="Signing in..." />
    );
};

export default StartPage;
