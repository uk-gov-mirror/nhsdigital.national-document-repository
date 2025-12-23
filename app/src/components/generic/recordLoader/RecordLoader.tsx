import { useSessionContext } from '../../../providers/sessionProvider/SessionProvider';
import { DOWNLOAD_STAGE } from '../../../types/generic/downloadStage';
import ProgressBar from '../progressBar/ProgressBar';

export type RecordLoaderProps = {
    downloadStage: DOWNLOAD_STAGE;
    lastUpdated: string;
    childrenIfFailiure: React.JSX.Element;
};

export const RecordLoader = ({
    downloadStage,
    lastUpdated,
    childrenIfFailiure,
}: RecordLoaderProps): React.JSX.Element => {
    const [{ isFullscreen }] = useSessionContext();

    switch (downloadStage) {
        case DOWNLOAD_STAGE.INITIAL:
        case DOWNLOAD_STAGE.PENDING:
        case DOWNLOAD_STAGE.REFRESH:
            return <ProgressBar status="Loading..." className="loading-bar" />;

        case DOWNLOAD_STAGE.SUCCEEDED: {
            if (isFullscreen) {
                return <></>;
            }

            const detailsProps = {
                lastUpdated,
            };
            return <RecordDetails {...detailsProps} />;
        }

        default:
            return childrenIfFailiure;
    }
};

export type RecordDetailsProps = {
    lastUpdated: string;
};

export const RecordDetails = ({ lastUpdated }: RecordDetailsProps): React.JSX.Element => {
    return (
        <div className="lloydgeorge_record-details">
            <div className="lloydgeorge_record-details_details">
                <div className="lloydgeorge_record-details_details--last-updated">
                    Last updated: {lastUpdated}
                </div>
            </div>
        </div>
    );
};
