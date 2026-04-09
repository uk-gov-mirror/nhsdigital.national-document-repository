import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfigProvider, { GlobalConfig, useConfigContext } from './ConfigProvider';
import { defaultFeatureFlags } from '../../types/generic/featureFlags';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('SessionProvider', () => {
    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('is able to set and retrieve auth data when user has logged in', async () => {
        renderFeatureFlagsProvider(false);
        expect(screen.getByText('testFeature - false')).toBeInTheDocument();
        await userEvent.click(screen.getByText('Flag On'));

        expect(screen.getByText('testFeature - true')).toBeInTheDocument();
    });

    it('is able to delete auth data when user has logged out', async () => {
        renderFeatureFlagsProvider(true);
        expect(screen.getByText('testFeature - true')).toBeInTheDocument();
        await userEvent.click(screen.getByText('Flag Off'));

        expect(screen.getByText('testFeature - false')).toBeInTheDocument();
    });
});

const TestApp = (): React.JSX.Element => {
    const [config, setConfig] = useConfigContext();
    const flagOn: GlobalConfig = {
        ...config,
        featureFlags: {
            ...defaultFeatureFlags,
            testFlag: true,
        },
    };
    const flagOff: GlobalConfig = {
        ...config,
        featureFlags: {
            ...defaultFeatureFlags,
            testFlag: false,
        },
    };
    return (
        <>
            <div>
                <h1>Actions</h1>
                <div onClick={(): void => setConfig(flagOn)}>Flag On</div>
                <div onClick={(): void => setConfig(flagOff)}>Flag Off</div>
            </div>
            <div>
                <h1>Flags</h1>
                <span>testFeature - {`${(config.featureFlags as any).testFlag}`}</span>
            </div>
        </>
    );
};

const renderFeatureFlagsProvider = (initialFlagState: boolean): void => {
    render(
        <ConfigProvider configOverride={{ featureFlags: { testFlag: initialFlagState } }}>
            <TestApp />
        </ConfigProvider>,
    );
};
