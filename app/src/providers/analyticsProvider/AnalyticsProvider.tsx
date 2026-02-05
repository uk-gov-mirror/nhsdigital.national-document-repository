import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AwsRum, AwsRumConfig } from 'aws-rum-web';
import { NdrTokenData } from '../../types/generic/ndrTokenData';
import { decodeJwtToken } from '../../helpers/utils/jwtDecoder';

type Props = {
    children: ReactNode;
};

export type AnalyticsContextType = [
    AwsRum | null,
    () => void,
];

const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

const AnalyticsProvider = ({ children }: Props): React.JSX.Element => {
    const [analytics, setAnalytics] = useState<AwsRum | null>(null);

    const startAnalytics = useCallback(() => {
        if (
            sessionStorage.getItem('analytics-started') === 'yes' ||
            !import.meta.env.VITE_MONITOR_ACCOUNT_ID
        ) {
            return;
        }

        let rumClient: AwsRum | null = null;
        try {
            const APPLICATION_ID: string = import.meta.env.VITE_MONITOR_ACCOUNT_ID || '';
            const APPLICATION_VERSION: string = '1.0.0';
            const APPLICATION_REGION: string = import.meta.env.VITE_AWS_REGION || 'eu-west-2';

            const config: AwsRumConfig = {
                sessionSampleRate: 1,
                identityPoolId: import.meta.env.VITE_RUM_IDENTITY_POOL_ID || '',
                endpoint: `https://dataplane.rum.${APPLICATION_REGION}.amazonaws.com`,
                telemetries: ['http', 'errors', 'performance'],
                allowCookies: true,
                enableXRay: false,
            };

            rumClient = new AwsRum(
                APPLICATION_ID,
                APPLICATION_VERSION,
                APPLICATION_REGION,
                config,
            );

            sessionStorage.setItem('analytics-started', "yes");

            const session = sessionStorage.getItem('UserSession');

            if (session) {
                const data = JSON.parse(session);
                if (data.auth.authorisation_token && data.auth.role && rumClient) {
                    const token_data = decodeJwtToken<NdrTokenData>(data.auth.authorisation_token);

                    if (token_data) {
                        rumClient.addSessionAttributes({
                            ndrUserRole: data.auth.role,
                            ndrOdsName: token_data.selected_organisation.name,
                            ndrOdsCode: token_data.selected_organisation.org_ods_code,
                            ndrRoleCode: token_data.selected_organisation.role_code,
                            ndrIcbOdsCode: token_data.selected_organisation.icb_ods_code,
                            ndrSmartCardRole: token_data.smart_card_role,
                            ndrSessionId: token_data.ndr_session_id,
                            ndrNHSUserId: token_data.nhs_user_id,
                        });

                        setAnalytics(rumClient);
                    }
                }
            }
        } catch (e) {
            console.log(e)
        }

        setAnalytics(rumClient);
    }, []);

    const contextValue = useMemo<AnalyticsContextType>(
        () => [analytics, startAnalytics],
        [analytics],
    );

    return (
        <AnalyticsContext.Provider value={contextValue}>
            {children}
        </AnalyticsContext.Provider>
    );
};

export default AnalyticsProvider;
export const useAnalyticsContext = (): AnalyticsContextType =>
    useContext(AnalyticsContext) as AnalyticsContextType;
