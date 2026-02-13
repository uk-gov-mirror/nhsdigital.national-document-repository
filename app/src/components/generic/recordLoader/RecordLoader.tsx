import { useSessionContext } from '../../../providers/sessionProvider/SessionProvider';
import { DOWNLOAD_STAGE } from '../../../types/generic/downloadStage';
import ProgressBar from '../progressBar/ProgressBar';

export type RecordLoaderProps = {
    downloadStage: DOWNLOAD_STAGE;
    lastUpdated?: string;
    childrenIfFailiure: React.JSX.Element;
    fileName: string;
    downloadAction?: (e: React.MouseEvent<HTMLElement>) => void;
};

export const RecordLoader = ({
    downloadStage,
    lastUpdated,
    childrenIfFailiure,
    fileName,
    downloadAction,
}: RecordLoaderProps): React.JSX.Element => {
    const [{ isFullscreen }] = useSessionContext();
    const detailsProps = {
        lastUpdated,
        fileName,
    };

    if (!lastUpdated && !fileName) {
        return <></>;
    }

    switch (downloadStage) {
        case DOWNLOAD_STAGE.INITIAL:
        case DOWNLOAD_STAGE.PENDING:
        case DOWNLOAD_STAGE.REFRESH:
            return <ProgressBar status="Loading..." className="loading-bar" />;

        case DOWNLOAD_STAGE.SUCCEEDED: {
            if (isFullscreen) {
                return <></>;
            }

            return <RecordDetails {...detailsProps} downloadAction={downloadAction} />;
        }

        default:
            return (
                <>
                    <RecordDetails {...detailsProps} />
                    {childrenIfFailiure}
                </>
            );
    }
};

export type RecordDetailsProps = {
    lastUpdated?: string;
    fileName: string;
    downloadAction?: (e: React.MouseEvent<HTMLElement>) => void;
};

export const RecordDetails = ({
    lastUpdated,
    fileName,
    downloadAction,
}: RecordDetailsProps): React.JSX.Element => {
    return (
        <div className="lloydgeorge_record-details">
            <div className="lloydgeorge_record-details_details">
                {lastUpdated && (
                    <div className="lloydgeorge_record-details_details--last-updated">
                        <p>Last updated: {lastUpdated}</p>
                    </div>
                )}
                {fileName && (
                    <div className="lloydgeorge_record-details_details--last-updated mt-3">
                        <p>
                            <b>Filename:</b>
                        </p>
                        <p>{fileName}</p>
                    </div>
                )}
                {fileName && downloadAction && (
                    <button
                        className="lloydgeorge_record-details_details--download link-button clickable"
                        onClick={downloadAction}
                    >
                        Download
                    </button>
                )}
            </div>
        </div>
    );
};
