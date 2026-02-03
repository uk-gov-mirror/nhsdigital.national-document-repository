import './styles/App.scss';
import PatientDetailsProvider from './providers/patientProvider/PatientProvider';
import SessionProvider from './providers/sessionProvider/SessionProvider';
import AppRouter from './router/AppRouter';
import ConfigProvider from './providers/configProvider/ConfigProvider';
import PatientAccessAuditProvider from './providers/patientAccessAuditProvider/PatientAccessAuditProvider';
import AnalyticsProvider from './providers/analyticsProvider/AnalyticsProvider';
import { JSX } from 'react';

const App = (): JSX.Element => {
    return (
        <ConfigProvider>
            <SessionProvider>
                <AnalyticsProvider>
                    <PatientDetailsProvider>
                        <PatientAccessAuditProvider>
                            <AppRouter />
                        </PatientAccessAuditProvider>
                    </PatientDetailsProvider>
                </AnalyticsProvider>
            </SessionProvider>
        </ConfigProvider>
    );
};
export default App;
