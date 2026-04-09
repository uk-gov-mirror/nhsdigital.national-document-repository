import { render, RenderResult, screen } from '@testing-library/react';
import useConfig from './useConfig';
import ConfigProvider, { GlobalConfig } from '../../providers/configProvider/ConfigProvider';
import { defaultFeatureFlags } from '../../types/generic/featureFlags';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('useConfig', () => {
    beforeEach(() => {
        sessionStorage.setItem('FeatureFlags', '');
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns true when feature flag in context', () => {
        const config: GlobalConfig = {
            featureFlags: { ...defaultFeatureFlags, testFlag: true },
            mockLocal: {},
        };
        renderHook(config);
        expect(screen.getByText(`FLAG: true`)).toBeInTheDocument();
    });

    it('returns false when there is no feature flag in context', () => {
        const config: GlobalConfig = {
            featureFlags: { ...defaultFeatureFlags, testFlag: false },
            mockLocal: {},
        };
        renderHook(config);
        expect(screen.getByText(`FLAG: false`)).toBeInTheDocument();
    });
});

const TestApp = (): React.JSX.Element => {
    const config = useConfig();
    return <div>{`FLAG: ${(config.featureFlags as any).testFlag}`.normalize()}</div>;
};

const renderHook = (config?: GlobalConfig): RenderResult => {
    return render(
        <ConfigProvider configOverride={config}>
            <TestApp />
        </ConfigProvider>,
    );
};
