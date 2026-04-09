import { Button, TextInput } from 'nhsuk-react-components';
import BackButton from '../../../generic/backButton/BackButton';
import { useForm } from 'react-hook-form';
import { InputRef } from '../../../../types/generic/inputRef';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import SpinnerButton from '../../../generic/spinnerButton/SpinnerButton';
import ErrorBox from '../../../layout/errorBox/ErrorBox';
import getUserInformation from '../../../../helpers/requests/userPatientRestrictions/getUserInformation';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import {
    UserInformation,
    UserPatientRestriction,
} from '../../../../types/generic/userPatientRestriction';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { AxiosError } from 'axios';
import { isMock } from '../../../../helpers/utils/isLocal';
import { useNavigate } from 'react-router-dom';
import { errorToParams } from '../../../../helpers/utils/errorToParams';
import { buildUserInformation } from '../../../../helpers/test/testBuilders';
import useSmartcardNumber from '../../../../helpers/hooks/useSmartcardNumber';
import { UIErrorCode } from '../../../../types/generic/errors';
import useTitle from '../../../../helpers/hooks/useTitle';
import {
    userRestrictionsStaffSearchNotFoundError,
    userRestrictionStaffSearchEmptyValueError,
    userRestrictionStaffSearchInvalidFormatError,
    userRestrictionStaffSearchRestrictionExistsError,
} from '../../../../helpers/constants/errors';

type FormData = {
    smartcardNumber: string;
};

type Props = {
    existingRestrictions: UserPatientRestriction[];
    setUserInformation: Dispatch<SetStateAction<UserInformation | null>>;
};

const UserPatientRestrictionsSearchStaffStage = ({
    existingRestrictions,
    setUserInformation,
}: Props): React.JSX.Element => {
    const currentUserSmartcardId = useSmartcardNumber();
    const [selfAddError, setSelfAddError] = useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<FormData>({
        reValidateMode: 'onSubmit',
    });
    const { ref: smartcardNumberRef, ...inputProps } = register('smartcardNumber', {
        validate: (value) => {
            const trimmedValue = value.replaceAll(/\s/g, '');
            if (!trimmedValue) {
                return userRestrictionStaffSearchEmptyValueError;
            }

            if (!/^\d{12}$/.test(trimmedValue)) {
                return userRestrictionStaffSearchInvalidFormatError;
            }

            if (currentUserSmartcardId === trimmedValue) {
                setSelfAddError(true);
                return false;
            }

            if (
                existingRestrictions.some(
                    (restriction) => restriction.restrictedUser === trimmedValue,
                )
            ) {
                return userRestrictionStaffSearchRestrictionExistsError;
            }

            return true;
        },
    });
    const [searching, setSearching] = useState(false);
    const [inputError, setInputError] = useState<null | string>(null);
    const baseAPIUrl = useBaseAPIUrl();
    const baseAPIHeaders = useBaseAPIHeaders();
    const navigate = useNavigate();

    const handleValidSubmit = async (data: FormData): Promise<void> => {
        setSearching(true);

        try {
            const userInfo = await getUserInformation({
                smartcardId: data.smartcardNumber.replaceAll(/\s/g, ''),
                baseAPIUrl,
                baseAPIHeaders,
            });

            handleSuccess(userInfo);
        } catch (e) {
            const error = e as AxiosError;
            if (isMock(error)) {
                handleSuccess(buildUserInformation());
            } else if (error.response?.status === 403) {
                navigate(routes.SESSION_EXPIRED);
            } else if (error.response?.status === 404) {
                setInputError(userRestrictionsStaffSearchNotFoundError);
            } else {
                navigate(routes.SERVER_ERROR + errorToParams(error));
            }
        } finally {
            setSearching(false);
        }
    };

    const handleSuccess = (userInfo: UserInformation): void => {
        setUserInformation(userInfo);
        navigate(routeChildren.USER_PATIENT_RESTRICTIONS_VERIFY_STAFF);
    };

    useEffect(() => {
        if (selfAddError) {
            navigate(
                routes.GENERIC_ERROR +
                    `?errorCode=${UIErrorCode.USER_PATIENT_RESTRICTIONS_SELF_ADD}`,
            );
        }
    }, [selfAddError, navigate]);

    const pageTitle =
        'Search for the NHS smartcard number of the staff member you want to restrict from accessing this patient record';
    useTitle({ pageTitle });

    return (
        <>
            <BackButton />

            {inputError && (
                <ErrorBox
                    messageTitle={'There is a problem'}
                    messageLinkBody={inputError}
                    errorInputLink={'#smartcard-number-input'}
                    errorBoxSummaryId={'error-box-summary'}
                />
            )}

            <h1>{pageTitle}</h1>

            <p>
                You cannot add a restriction to your own NHS smartcard. Ask another member of staff
                to do this for you.
            </p>

            <form onSubmit={handleSubmit(handleValidSubmit)}>
                <TextInput
                    id="smartcard-number-input"
                    data-testid="smartcard-number-input"
                    className="nhsuk-input--width-10"
                    label="A 12-digit number, for example, 246813572468"
                    type="text"
                    {...inputProps}
                    error={errors.smartcardNumber?.message}
                    name="smartcardNumber"
                    inputRef={smartcardNumberRef as InputRef}
                    autoComplete="off"
                />

                {searching ? (
                    <SpinnerButton
                        id="smartcard-search-spinner"
                        status="Searching..."
                        disabled={true}
                    />
                ) : (
                    <Button type="submit" id="continue-button" data-testid="continue-button">
                        Continue
                    </Button>
                )}
            </form>
        </>
    );
};

export default UserPatientRestrictionsSearchStaffStage;
