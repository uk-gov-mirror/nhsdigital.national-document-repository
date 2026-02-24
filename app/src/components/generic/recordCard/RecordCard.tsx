import { Card } from 'nhsuk-react-components';
import { Dispatch, ReactNode, SetStateAction } from 'react';
import PdfViewer from '../pdfViewer/PdfViewer';
import { LGRecordActionLink } from '../../../types/blocks/lloydGeorgeActions';
import { LG_RECORD_STAGE } from '../../../types/blocks/lloydGeorgeStages';
import RecordMenuCard from '../recordMenuCard/RecordMenuCard';
import Spinner from '../spinner/Spinner';

export type RecordCardProps = RecordLayoutProps & {
    pdfObjectUrl: string;
};

export type RecordLayoutProps = {
    heading: string;
    fullScreenHandler: (() => void) | null;
    detailsElement: ReactNode;
    isFullScreen: boolean;
    recordLinks?: Array<LGRecordActionLink>;
    linksElement?: ReactNode;
    setStage?: Dispatch<SetStateAction<LG_RECORD_STAGE>>;
    showMenu?: boolean;
    children?: ReactNode;
};

export const RecordLayout = ({
    isFullScreen,
    detailsElement,
    heading,
    fullScreenHandler,
    recordLinks = [],
    linksElement,
    setStage = (): void => {},
    showMenu = false,
    children,
}: RecordLayoutProps): React.JSX.Element => {
    if (isFullScreen) {
        return (
            <>
                {detailsElement}
                {children}
            </>
        );
    } else {
        return (
            <Card className="lloydgeorge_record-stage_pdf">
                <Card.Content
                    data-testid="pdf-card"
                    className="lloydgeorge_record-stage_pdf-content"
                >
                    <Card.Heading
                        className="lloydgeorge_record-stage_pdf-content-label"
                        headingLevel="h2"
                        tabIndex={0}
                    >
                        {heading}
                    </Card.Heading>
                    {fullScreenHandler && (
                        <button
                            className="lloydgeorge_record-stage_pdf-content-button link-button clickable full-screen"
                            data-testid="full-screen-btn"
                            onClick={fullScreenHandler}
                        >
                            View in full screen
                        </button>
                    )}

                    {detailsElement}

                    {linksElement || (
                        <RecordMenuCard
                            recordLinks={recordLinks}
                            setStage={setStage}
                            showMenu={showMenu}
                        />
                    )}
                </Card.Content>
                <div>{children}</div>
            </Card>
        );
    }
};

const RecordCard = ({
    heading,
    fullScreenHandler,
    detailsElement,
    isFullScreen,
    pdfObjectUrl,
    recordLinks = [],
    linksElement,
    setStage = (): void => {},
    showMenu = false,
}: RecordCardProps): React.JSX.Element => {
    const Record = (): React.JSX.Element => {
        switch (pdfObjectUrl) {
            case '':
            case null:
            case undefined:
                return <></>;

            case 'loading':
                return <Spinner status="Loading document..." />;

            default:
                return <PdfViewer fileUrl={pdfObjectUrl} />;
        }
    };

    return (
        <RecordLayout
            isFullScreen={isFullScreen}
            detailsElement={detailsElement}
            heading={heading}
            fullScreenHandler={fullScreenHandler}
            recordLinks={recordLinks}
            linksElement={linksElement}
            setStage={setStage}
            showMenu={showMenu}
        >
            <Record />
        </RecordLayout>
    );
};

export default RecordCard;
