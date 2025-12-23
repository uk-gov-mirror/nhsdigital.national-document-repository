import React, { useState } from 'react';
import { Button, Fieldset, Radios } from 'nhsuk-react-components';
import { useNavigate, useParams } from 'react-router-dom';
import { navigateUrlParam, routeChildren } from '../../../../types/generic/routes';
import BackButton from '../../../generic/backButton/BackButton';

type ReviewDetailsAddMoreChoicePageProps = {
    reviewSnoMed: string;
};

type AddMoreChoice = 'yes' | 'no' | '';

const ReviewDetailsAddMoreChoicePage: React.FC<ReviewDetailsAddMoreChoicePageProps> = ({
    reviewSnoMed,
}) => {
    const navigate = useNavigate();
    const [addMoreChoice, setAddMoreChoice] = useState<AddMoreChoice>('');
    const [showError, setShowError] = useState(false);
    const { reviewId } = useParams<{ reviewId: string }>();

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
            navigateUrlParam(routeChildren.ADMIN_REVIEW_UPLOAD_FILE_ORDER, { reviewId }, navigate);
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
                        Do you want to add more files to this patients record?
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
                            Yes I have more scanned paper records to add for this patient
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
                            No, I don&apos;t have anymore scanned paper records to add for this
                            patient
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

export default ReviewDetailsAddMoreChoicePage;
