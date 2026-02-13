import React, { useState } from 'react';
import { Button, Fieldset, Radios } from 'nhsuk-react-components';
import { useNavigate, useParams } from 'react-router-dom';
import { navigateUrlParam, routeChildren } from '../../../../types/generic/routes';
import BackButton from '../../../generic/backButton/BackButton';
import { ReviewDetails } from '../../../../types/generic/reviews';
import { getConfigForDocType } from '../../../../helpers/utils/documentType';

type ReviewDetailsAddMoreChoicePageProps = {
    reviewData: ReviewDetails | null;
};

type AddMoreChoice = 'yes' | 'no' | '';

const ReviewDetailsAddMoreChoiceStage: React.FC<ReviewDetailsAddMoreChoicePageProps> = ({
    reviewData,
}) => {
    const navigate = useNavigate();
    const [addMoreChoice, setAddMoreChoice] = useState<AddMoreChoice>('');
    const [showError, setShowError] = useState(false);
    const { reviewId } = useParams<{ reviewId: string }>();

    if (!reviewData) {
        navigate(routeChildren.ADMIN_REVIEW);
        return <></>;
    }

    const reviewConfig = getConfigForDocType(reviewData?.snomedCode || '');

    const handleContinue = (): void => {
        if (!addMoreChoice || !reviewId) {
            setShowError(true);
            return;
        }

        if (addMoreChoice === 'yes') {
            navigateUrlParam(
                routeChildren.ADMIN_REVIEW_UPLOAD_ADDITIONAL_FILES,
                { reviewId },
                navigate,
            );
        } else {
            navigateUrlParam(
                reviewData.files!.length > 1
                    ? routeChildren.ADMIN_REVIEW_UPLOAD_FILE_ORDER
                    : routeChildren.ADMIN_REVIEW_UPLOAD,
                { reviewId },
                navigate,
            );
        }
    };

    return (
        <>
            <BackButton backLinkText="Go back" />

            <form
                onSubmit={(e): void => {
                    e.preventDefault();
                    handleContinue();
                }}
            >
                <Fieldset>
                    <Fieldset.Legend isPageHeading>
                        Do you want to add more files to this patient's record?
                    </Fieldset.Legend>
                    <Radios
                        name="add-more-choice"
                        id="add-more-choice"
                        error={showError ? 'Select an option' : ''}
                    >
                        <Radios.Radio
                            value="yes"
                            id="yes-radio"
                            data-testid="yes-radio-btn"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>): void => {
                                setAddMoreChoice(e.target.value as AddMoreChoice);
                                if (showError) {
                                    setShowError(false);
                                }
                            }}
                        >
                            {reviewConfig.content.addMoreFilesRadioYesText}
                        </Radios.Radio>
                        <Radios.Radio
                            value="no"
                            id="no-radio"
                            data-testid="no-radio-btn"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>): void => {
                                setAddMoreChoice(e.target.value as AddMoreChoice);
                                if (showError) {
                                    setShowError(false);
                                }
                            }}
                        >
                            {reviewConfig.content.addMoreFilesRadioNoText}
                        </Radios.Radio>
                    </Radios>
                </Fieldset>

                <Button type="submit" id="continue-button" data-testid="continue-btn">
                    Continue
                </Button>
            </form>
        </>
    );
};

export default ReviewDetailsAddMoreChoiceStage;
