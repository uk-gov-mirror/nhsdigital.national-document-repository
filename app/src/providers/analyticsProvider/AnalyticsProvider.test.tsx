import { render, screen, act } from '@testing-library/react';
import AnalyticsProvider, { useAnalyticsContext } from './AnalyticsProvider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockAddSessionAttributes = vi.fn();
const mockRecordEvent = vi.fn();

vi.mock('aws-rum-web', () => {
    return {
        AwsRum: class MockAwsRum {
            addSessionAttributes = mockAddSessionAttributes;
            recordEvent = mockRecordEvent;
        },
    };
});

vi.mock('../../helpers/utils/jwtDecoder', () => ({
    decodeJwtToken: vi.fn().mockReturnValue({
        selected_organisation: {
            name: 'Test Org',
            org_ods_code: 'TEST123',
            role_code: 'ROLE1',
            icb_ods_code: 'ICB123',
        },
        smart_card_role: 'TestRole',
        ndr_session_id: 'session-123',
        nhs_user_id: 'user-123',
    }),
}));

const TestComponent = (): React.JSX.Element => {
    const [awsRum, startAnalytics] = useAnalyticsContext();

    return (
        <div>
            <span data-testid="rum-status">
                {awsRum ? 'RUM initialized' : 'RUM not initialized'}
            </span>
            <button onClick={startAnalytics} data-testid="start-analytics">
                Start Analytics
            </button>
        </div>
    );
};

describe('AnalyticsProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        vi.stubEnv('VITE_ENVIRONMENT', 'development');
        vi.stubEnv('VITE_MONITOR_ACCOUNT_ID', 'test-app-id');
        vi.stubEnv('VITE_RUM_IDENTITY_POOL_ID', 'test-pool-id');
        vi.stubEnv('VITE_AWS_REGION', 'eu-west-2');
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        sessionStorage.clear();
    });

    it('provides awsRum as null before startAnalytics is called', () => {
        renderComponent();

        expect(screen.getByTestId('rum-status')).toHaveTextContent('RUM not initialized');
    });

    it('initializes AWS RUM when startAnalytics is called in development environment', async () => {
        renderComponent();

        await act(async () => {
            screen.getByTestId('start-analytics').click();
        });

        expect(screen.getByTestId('rum-status')).toHaveTextContent('RUM initialized');
    });

    it('does not initialize RUM when aws environment variables are empty', async () => {
        vi.stubEnv('VITE_MONITOR_ACCOUNT_ID', '');
        vi.stubEnv('VITE_RUM_IDENTITY_POOL_ID', '');

        renderComponent();

        await act(async () => {
            screen.getByTestId('start-analytics').click();
        });

        expect(screen.getByTestId('rum-status')).toHaveTextContent('RUM not initialized');
    });

    it('adds session attributes when user session exists', async () => {
        sessionStorage.setItem(
            'UserSession',
            JSON.stringify({
                auth: {
                    authorisation_token: 'test-token',
                    role: 'GP_ADMIN',
                },
            }),
        );

        renderComponent();

        await act(async () => {
            screen.getByTestId('start-analytics').click();
        });

        expect(mockAddSessionAttributes).toHaveBeenCalledWith({
            ndrUserRole: 'GP_ADMIN',
            ndrOdsName: 'Test Org',
            ndrOdsCode: 'TEST123',
            ndrRoleCode: 'ROLE1',
            ndrIcbOdsCode: 'ICB123',
            ndrSmartCardRole: 'TestRole',
            ndrSessionId: 'session-123',
            ndrNHSUserId: 'user-123',
        });
    });
});

const renderComponent = (): void => {
    render(
        <AnalyticsProvider>
            <TestComponent />
        </AnalyticsProvider>,
    );
};
