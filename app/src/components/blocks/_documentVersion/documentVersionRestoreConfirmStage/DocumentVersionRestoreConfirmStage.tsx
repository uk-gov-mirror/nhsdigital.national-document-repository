import React, { useEffect, useRef, useState } from 'react';
import { BackLink, Button, ErrorSummary, Fieldset, Radios } from 'nhsuk-react-components';
import { useNavigate } from 'react-router-dom';
import { routeChildren, routes } from '../../../../types/generic/routes';
import useTitle from '../../../../helpers/hooks/useTitle';
import {
    getDocumentTypeLabel,
    getConfigForDocTypeGeneric,
    LGContentKeys,
} from '../../../../helpers/utils/documentType';
import { DocumentReference } from '../../../../types/pages/documentSearchResultsPage/types';

enum RESTORE_OPTION {
    YES = 'yes',
    NO = 'no',
}

type DocumentVersionRestoreConfirmPageProps = {
    documentReferenceToRestore: DocumentReference | null;
};

const DocumentVersionRestoreConfirmStage = ({
    documentReferenceToRestore: documentReference,
}: Readonly<DocumentVersionRestoreConfirmPageProps>): React.JSX.Element => {
    const navigate = useNavigate();

    const [selectedOption, setSelectedOption] = useState<RESTORE_OPTION | null>(null);
    const [showError, setShowError] = useState(false);
    const errorSummaryRef = useRef<HTMLDivElement>(null);

    const pageHeader =
        'Are you sure you want to restore this version of these scanned paper notes?';
    useTitle({ pageTitle: pageHeader });

    const docTypeLabel = documentReference
        ? getDocumentTypeLabel(documentReference.documentSnomedCodeType)
        : 'Scanned paper notes';
    const docConfig = documentReference
        ? getConfigForDocTypeGeneric(documentReference.documentSnomedCodeType)
        : null;
    const versionLabel =
        docConfig?.content.getValueFormatString<string, LGContentKeys>(
            'versionHistoryTimelineHeader',
            { version: documentReference?.version ?? '' },
        ) ?? `${docTypeLabel}: version ${documentReference?.version ?? ''}`;

    useEffect(() => {
        if (!documentReference) {
            navigate(routes.PATIENT_DOCUMENTS);
        }
    }, [documentReference, navigate]);

    useEffect(() => {
        if (showError && errorSummaryRef.current) {
            errorSummaryRef.current.focus();
        }
    }, [showError]);

    const handleSubmit = async (e: React.SubmitEvent): Promise<void> => {
        e.preventDefault();

        if (!selectedOption) {
            setShowError(true);
            return;
        }

        if (selectedOption === RESTORE_OPTION.NO) {
            navigate(-1);
            return;
        }

        navigate(routeChildren.DOCUMENT_VERSION_RESTORE_UPLOADING, {
            state: { documentReference },
        });
    };

    if (!documentReference) {
        navigate(routes.SERVER_ERROR);
        return <></>;
    }

    return (
        <div>
            <BackLink
                data-testid="go-back-link"
                href="#"
                onClick={(e: React.MouseEvent<HTMLAnchorElement>): void => {
                    e.preventDefault();
                    navigate(-1);
                }}
            >
                Go back
            </BackLink>

            {showError && (
                <ErrorSummary
                    ref={errorSummaryRef}
                    aria-labelledby="error-summary-title"
                    role="alert"
                    tabIndex={-1}
                    data-testid="error-summary"
                >
                    <ErrorSummary.Title id="error-summary-title">
                        There is a problem
                    </ErrorSummary.Title>
                    <ErrorSummary.Body>
                        <ErrorSummary.List>
                            <ErrorSummary.Item href="#restore-version">
                                Select whether you want to restore this version
                            </ErrorSummary.Item>
                        </ErrorSummary.List>
                    </ErrorSummary.Body>
                </ErrorSummary>
            )}

            <h1>{pageHeader}</h1>

            <p>
                If you restore, this will be the version you see when you view the scanned paper
                notes.
            </p>

            <p>
                See{' '}
                <a
                    href="https://digital.nhs.uk/services/access-and-store-digital-patient-documents/help-and-guidance"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="help-and-guidance-link"
                >
                    help and guidance
                </a>{' '}
                for reasons why you might restore a version.
            </p>

            <form onSubmit={handleSubmit}>
                <Fieldset>
                    <Fieldset.Legend size="m">
                        <strong>{versionLabel}</strong>
                    </Fieldset.Legend>
                    <Radios
                        id="restore-version"
                        error={
                            showError
                                ? 'Select whether you want to restore this version'
                                : undefined
                        }
                    >
                        <Radios.Radio
                            value={RESTORE_OPTION.YES}
                            data-testid="yes-radio-btn"
                            onChange={(): void => {
                                setSelectedOption(RESTORE_OPTION.YES);
                                setShowError(false);
                            }}
                        >
                            Yes, restore this version
                        </Radios.Radio>
                        <Radios.Radio
                            value={RESTORE_OPTION.NO}
                            data-testid="no-radio-btn"
                            onChange={(): void => {
                                setSelectedOption(RESTORE_OPTION.NO);
                                setShowError(false);
                            }}
                        >
                            No, do not restore this version
                        </Radios.Radio>
                    </Radios>
                </Fieldset>
                <Button type="submit" data-testid="continue-button">
                    Continue
                </Button>
            </form>
        </div>
    );
};

export default DocumentVersionRestoreConfirmStage;
