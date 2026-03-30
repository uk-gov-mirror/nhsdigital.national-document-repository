import { Dispatch, SetStateAction, useRef, useState } from 'react';
import { DOCUMENT_TYPE_CONFIG } from '../../../../helpers/utils/documentType';
import PdfViewer from '../../../generic/pdfViewer/PdfViewer';
import PatientSummary, { PatientInfo } from '../../../generic/patientSummary/PatientSummary';
import { Button, FormGroup, TextInput, WarningCallout } from 'nhsuk-react-components';
import { useForm } from 'react-hook-form';
import { InputRef } from '../../../../types/generic/inputRef';
import { useNavigate } from 'react-router-dom';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { getDocument } from 'pdfjs-dist';
import ErrorBox from '../../../layout/errorBox/ErrorBox';
import BackButton from '../../../generic/backButton/BackButton';
import SpinnerButton from '../../../generic/spinnerButton/SpinnerButton';
import {
    getUniquePageNumbersFromRanges,
    parsePageNumbersToRanges,
} from '../../../../helpers/utils/documentManagement/pageNumbers';

export type Props = {
    baseDocumentBlob: Blob | null;
    documentConfig: DOCUMENT_TYPE_CONFIG;
    pagesToRemove: number[][];
    setPagesToRemove: Dispatch<SetStateAction<number[][]>>;
};

const DocumentSelectPagesStage = ({
    baseDocumentBlob,
    documentConfig,
    pagesToRemove,
    setPagesToRemove,
}: Props): React.JSX.Element => {
    const [errorMessage, setErrorMessage] = useState<string>('');
    const scrollToRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    type FormData = {
        pageNumbers: string;
    };
    const { register, handleSubmit } = useForm<FormData>({
        reValidateMode: 'onSubmit',
        defaultValues: {
            pageNumbers: pagesToRemove
                .map((range) => (range.length > 1 ? `${range[0]}-${range.at(-1)!}` : `${range[0]}`))
                .join(', '),
        },
    });

    const { ref: pageNumbersRef, ...pageNumbersProps } = register('pageNumbers', {
        validate: (value) => {
            const errorMessage =
                'Enter valid page numbers. Separate page numbers using a comma, or use a dash for page ranges. For example, 1-5, 8, 11-14.';

            if (!value) {
                setErrorMessage(
                    'Enter at least one page, or range of pages that you want to remove.',
                );
                return false;
            }

            const trimmed = value.trim();

            if (!/^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/.test(trimmed)) {
                setErrorMessage(errorMessage);
                return false;
            }

            const ranges = trimmed.split(',').map((part) => {
                const [a, b] = part.trim().split('-').map(Number);
                return b === undefined ? [a, a] : [a, b];
            });

            for (const [start, end] of ranges) {
                if (start > end) {
                    setErrorMessage(errorMessage);
                    return false;
                }
            }

            ranges.sort((a, b) => a[0] - b[0]);

            for (let i = 1; i < ranges.length; i++) {
                if (ranges[i][0] < ranges[i - 1][1]) {
                    setErrorMessage(errorMessage);
                    return false;
                }
            }

            return true;
        },
    });

    const onSuccess = async (data: FormData): Promise<void> => {
        const pageNumbersInput = data.pageNumbers.split(',').map((p) => p.trim());

        const pageNumberRanges = parsePageNumbersToRanges(pageNumbersInput);
        const uniquePageNumbers = getUniquePageNumbersFromRanges(pageNumberRanges);

        const buffer = await baseDocumentBlob!.arrayBuffer();

        try {
            const pdf = await getDocument(buffer).promise;
            if (uniquePageNumbers.some((p) => p < 1 || p > pdf.numPages)) {
                setErrorMessage('One or more page numbers are out of range.');
                setTimeout(() => {
                    scrollToRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 10);
                return;
            }
            if (uniquePageNumbers.length === pdf.numPages) {
                setErrorMessage('You cannot remove all pages from the document.');
                setTimeout(() => {
                    scrollToRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 10);
                return;
            }

            setErrorMessage('');
            setPagesToRemove(pageNumberRanges);

            navigate(routeChildren.DOCUMENT_REASSIGN_CONFIRM_REMOVED_PAGES);
        } catch {
            navigate(routes.SERVER_ERROR);
        }
    };

    const onError = (): void => {
        setTimeout(() => {
            scrollToRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    return (
        <>
            <BackButton />

            {errorMessage && (
                <ErrorBox
                    dataTestId="error-box"
                    errorBoxSummaryId="failed-document-uploads-summary-title"
                    messageTitle="There is a problem"
                    errorInputLink="#page-numbers"
                    messageLinkBody={errorMessage}
                    scrollToRef={scrollToRef}
                />
            )}

            <h1>{documentConfig?.content.choosePagesToRemoveTitle}</h1>

            <PatientSummary>
                <PatientSummary.Child item={PatientInfo.FULL_NAME} />
                <PatientSummary.Child item={PatientInfo.NHS_NUMBER} />
                <PatientSummary.Child item={PatientInfo.BIRTH_DATE} />
            </PatientSummary>

            <WarningCallout>
                <WarningCallout.Label>Important</WarningCallout.Label>
                <p>{documentConfig?.content.choosePagesToRemoveWarning}</p>
            </WarningCallout>

            <form onSubmit={handleSubmit(onSuccess, onError)}>
                <FormGroup id="page-numbers">
                    <h3>Enter the pages you want to remove</h3>
                    <p className="mb-2">You can find the page number using the viewer.</p>
                    <p className="mb-3 placeholder-text">
                        Separate page numbers using a comma, or use a dash for page ranges. For
                        example, 1-5, 8, 11-14.
                    </p>

                    <TextInput
                        autoComplete="off"
                        data-testid="page-numbers-input"
                        type="text"
                        error={errorMessage}
                        ref={pageNumbersRef as InputRef}
                        {...pageNumbersProps}
                    />
                </FormGroup>

                {baseDocumentBlob ? (
                    <>
                        <PdfViewer fileUrl={URL.createObjectURL(baseDocumentBlob)} />

                        <Button type="submit" id="continue-button" data-testid="continue-button">
                            Continue
                        </Button>
                    </>
                ) : (
                    <SpinnerButton id="loading-preview" status="Loading preview..." />
                )}
            </form>
        </>
    );
};

export default DocumentSelectPagesStage;
