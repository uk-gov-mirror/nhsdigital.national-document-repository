import { Link, useNavigate } from 'react-router-dom';
import useTitle from '../../../../helpers/hooks/useTitle';
import BackButton from '../../../generic/backButton/BackButton';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { Button, ErrorMessage, Fieldset, Radios, Table, TextInput } from 'nhsuk-react-components';
import { useForm } from 'react-hook-form';
import { InputRef } from '../../../../types/generic/inputRef';
import React, { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import SpinnerButton from '../../../generic/spinnerButton/SpinnerButton';
import {
    UserPatientRestriction,
    UserPatientRestrictionsSubRoute,
} from '../../../../types/generic/userPatientRestriction';
import { Pagination } from '../../../generic/paginationV2/Pagination';
import SpinnerV2 from '../../../generic/spinnerV2/SpinnerV2';
import { formatNhsNumber } from '../../../../helpers/utils/formatNhsNumber';
import { getFormattedDateFromString } from '../../../../helpers/utils/formatDate';
import getUserPatientRestrictions, {
    GetUserPatientRestrictionsResponse,
} from '../../../../helpers/requests/userPatientRestrictions/getUserPatientRestrictions';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import validateNhsNumber from '../../../../helpers/utils/nhsNumberValidator';
import { isMock } from '../../../../helpers/utils/isLocal';
import { AxiosError } from 'axios';
import { buildPatientDetails, buildUserRestrictions } from '../../../../helpers/test/testBuilders';
import getPatientDetails from '../../../../helpers/requests/getPatientDetails';
import { usePatientDetailsContext } from '../../../../providers/patientProvider/PatientProvider';
import { PatientDetails } from '../../../../types/generic/patientDetails';
import formatSmartcardNumber from '../../../../helpers/utils/formatSmartcardNumber';
import { getFormattedPatientFullName } from '../../../../helpers/utils/formatPatientFullName';
import { ErrorResponse } from '../../../../types/generic/errorResponse';
import { errorToParams } from '../../../../helpers/utils/errorToParams';
import { UIErrorCode } from '../../../../types/generic/errors';

enum Fields {
    searchType = 'searchType',
    searchText = 'searchText',
}

enum SearchTypeOptions {
    NHS_NUMBER = 'nhsNumber',
    SMARTCARD_NUMBER = 'smartcardNumber',
}

type FormData = {
    [Fields.searchType]: string;
    [Fields.searchText]: string;
};

type Props = {
    setSubRoute: Dispatch<SetStateAction<UserPatientRestrictionsSubRoute | null>>;
};

const UserPatientRestrictionsListStage = ({ setSubRoute }: Props): React.JSX.Element => {
    const navigate = useNavigate();
    const pageTitle = 'Manage restrictions on access to patient records';
    useTitle({ pageTitle });
    const baseAPIUrl = useBaseAPIUrl();
    const baseAPIHeaders = useBaseAPIHeaders();

    const mounted = useRef(false);
    const [isLoading, setIsLoading] = useState(false);
    const [failedLoading, setFailedLoading] = useState(false);
    const [restrictions, setRestrictions] = useState<UserPatientRestriction[]>([]);
    const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [pageTokens, setPageTokens] = useState<string[]>(['']);

    const {
        handleSubmit,
        register,
        getValues,
        formState: { errors },
    } = useForm<FormData>({
        defaultValues: {
            [Fields.searchType]: SearchTypeOptions.NHS_NUMBER,
        },
    });

    const { ref: radioRef, ...radioProps } = register(Fields.searchType);
    const { ref: inputRef, ...inputProps } = register(Fields.searchText, {
        validate: (value: string) => {
            if (!value) {
                return true;
            }

            const searchType = getValues(Fields.searchType);
            if (searchType === SearchTypeOptions.NHS_NUMBER) {
                return validateNhsNumber(value) || 'Please enter a valid 10-digit NHS number';
            }

            if (searchType === SearchTypeOptions.SMARTCARD_NUMBER) {
                return (
                    /^\d{12}$/.test(value.replaceAll(/\s/g, '')) ||
                    'Please enter a valid 12-digit NHS smartcard number'
                );
            }
        },
    });

    const loadRestrictions = async (pageIndex: number): Promise<void> => {
        setIsLoading(true);
        setFailedLoading(false);

        try {
            const searchText = getValues(Fields.searchText);
            const trimmedSearchText = searchText.replaceAll(/[\s-]/g, '');
            const searchType = getValues(Fields.searchType);
            const response = await getUserPatientRestrictions({
                nhsNumber:
                    searchType === SearchTypeOptions.NHS_NUMBER ? trimmedSearchText : undefined,
                smartcardNumber:
                    searchType === SearchTypeOptions.SMARTCARD_NUMBER
                        ? trimmedSearchText
                        : undefined,
                baseAPIUrl,
                baseAPIHeaders,
                limit: 10,
                pageToken: pageIndex > 0 ? pageTokens[pageIndex] : undefined,
            });

            handleSuccess(response, pageIndex);
        } catch (e) {
            const error = e as AxiosError;
            if (isMock(error)) {
                handleSuccess(
                    {
                        restrictions: buildUserRestrictions(),
                        nextPageToken: `mock-next-page-token-${pageIndex}`,
                    },
                    pageIndex,
                );
            } else if (error.response?.status === 403) {
                navigate(routes.SESSION_EXPIRED);
            } else {
                setFailedLoading(true);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuccess = (
        response: GetUserPatientRestrictionsResponse,
        pageIndex: number,
    ): void => {
        setRestrictions(response.restrictions);
        setNextPageToken(response.nextPageToken);
        setCurrentPageIndex(pageIndex);

        if (response.nextPageToken && !pageTokens.includes(response.nextPageToken)) {
            setPageTokens((prev) => {
                const newTokens = [...prev];
                newTokens[pageIndex + 1] = response.nextPageToken!;
                return newTokens;
            });
        }
    };

    useEffect(() => {
        if (!mounted.current) {
            mounted.current = true;
            loadRestrictions(0);
        }
    }, [mounted.current]);

    const handleSearch = async (): Promise<void> => {
        setRestrictions([]);
        setNextPageToken(undefined);
        setCurrentPageIndex(0);
        setPageTokens(['']);
        mounted.current = false;
    };

    return (
        <div className="user-patient-restrictions-list-stage">
            <BackButton />

            <h1>{pageTitle}</h1>

            <p>You cannot view or remove a restriction on your own NHS smartcard number.</p>

            <Button
                onClick={(e: React.MouseEvent<HTMLButtonElement>): void => {
                    e.preventDefault();
                    setSubRoute(UserPatientRestrictionsSubRoute.ADD);
                    navigate(routeChildren.USER_PATIENT_RESTRICTIONS_SEARCH_PATIENT);
                }}
            >
                Add a restriction
            </Button>

            <Table.Panel heading="Patients with record access restrictions">
                <form id="search-form" onSubmit={handleSubmit(handleSearch)}>
                    <div id="search-container" className="mt-5">
                        <Fieldset>
                            <Fieldset.Legend className="visually-hidden">Search by</Fieldset.Legend>
                            <Radios id="search-type-radios" className="d-flex">
                                <Radios.Radio
                                    value={SearchTypeOptions.NHS_NUMBER}
                                    inputRef={radioRef as InputRef}
                                    {...radioProps}
                                    id="nhs-number-radio-button"
                                    data-testid="nhs-number-radio-button"
                                >
                                    Patient's NHS number
                                </Radios.Radio>
                                <Radios.Radio
                                    value={SearchTypeOptions.SMARTCARD_NUMBER}
                                    inputRef={radioRef as InputRef}
                                    {...radioProps}
                                    id="smartcard-number-radio-button"
                                    data-testid="smartcard-number-radio-button"
                                >
                                    NHS smartcard number
                                </Radios.Radio>
                            </Radios>

                            <div className="d-flex align-center">
                                <TextInput
                                    id="search-input"
                                    data-testid="search-input"
                                    type="text"
                                    autoComplete="off"
                                    className="flex-center"
                                    error={errors.searchText?.message}
                                    ref={inputRef as InputRef}
                                    {...inputProps}
                                />
                                {isLoading ? (
                                    <SpinnerButton
                                        id="patient-search-spinner"
                                        status="Searching..."
                                        disabled={true}
                                        className="ml-8 mb-1"
                                    />
                                ) : (
                                    <Button
                                        data-testid="search-button"
                                        className="ml-8 mb-1"
                                        type="submit"
                                    >
                                        Search
                                    </Button>
                                )}
                            </div>
                        </Fieldset>
                    </div>
                </form>

                <Table responsive>
                    <Table.Head>
                        <Table.Row>
                            <Table.Cell>Patient's NHS number</Table.Cell>
                            <Table.Cell>Patient's name</Table.Cell>
                            <Table.Cell>NHS smartcard number</Table.Cell>
                            <Table.Cell>Staff member</Table.Cell>
                            <Table.Cell>Date restriction added</Table.Cell>
                            <Table.Cell>View</Table.Cell>
                        </Table.Row>
                    </Table.Head>
                    <Table.Body>
                        <TableRows
                            restrictions={restrictions}
                            isLoading={isLoading}
                            failedLoading={failedLoading}
                            setSubRoute={setSubRoute}
                        />
                    </Table.Body>
                </Table>
                <Pagination>
                    {/* previous link */}
                    {currentPageIndex > 0 && (
                        <Pagination.Link
                            data-testid="previous-page-link"
                            href="#"
                            onClick={(e): void => {
                                e.preventDefault();
                                loadRestrictions(currentPageIndex - 1);
                            }}
                            previous
                        />
                    )}
                    {/* previous page items */}
                    {pageTokens.map((token, index) => {
                        return (
                            <Pagination.Item
                                href="#"
                                key={token}
                                current={index === currentPageIndex}
                                onClick={(e): void => {
                                    e.preventDefault();
                                    loadRestrictions(index);
                                }}
                                number={index + 1}
                            />
                        );
                    })}
                    {/* next link */}
                    {nextPageToken && (
                        <Pagination.Link
                            data-testid="next-page-link"
                            href="#"
                            onClick={(e): void => {
                                e.preventDefault();
                                loadRestrictions(currentPageIndex + 1);
                            }}
                            next
                        />
                    )}
                </Pagination>
            </Table.Panel>
        </div>
    );
};

export default UserPatientRestrictionsListStage;

type TableRowsProps = {
    restrictions: UserPatientRestriction[];
    isLoading: boolean;
    failedLoading: boolean;
    setSubRoute: Dispatch<SetStateAction<UserPatientRestrictionsSubRoute | null>>;
};
const TableRows = ({
    restrictions,
    isLoading,
    failedLoading,
    setSubRoute,
}: TableRowsProps): React.JSX.Element => {
    const [, setPatientDetails] = usePatientDetailsContext();
    const navigate = useNavigate();
    const baseUrl = useBaseAPIUrl();
    const baseHeaders = useBaseAPIHeaders();

    const [loadingPatient, setLoadingPatient] = useState(false);

    const onViewClicked = async (nhsNumber: string): Promise<void> => {
        setLoadingPatient(true);
        try {
            const patientDetails = await getPatientDetails({
                nhsNumber,
                baseUrl,
                baseHeaders,
            });

            handleSuccess(patientDetails);
        } catch (e) {
            const error = e as AxiosError;
            const errorResponse = error.response?.data as ErrorResponse;
            if (isMock(error)) {
                handleSuccess(
                    buildPatientDetails({
                        nhsNumber,
                        active: true,
                    }),
                );
            } else if (errorResponse?.err_code === 'SP_4006') {
                navigate(
                    routes.GENERIC_ERROR + '?errorCode=' + UIErrorCode.PATIENT_ACCESS_RESTRICTED,
                );
            } else if (error.response?.status === 403) {
                navigate(routes.SESSION_EXPIRED);
            } else {
                navigate(routes.SERVER_ERROR + errorToParams(error));
            }
        } finally {
            setLoadingPatient(false);
        }
    };

    const handleSuccess = (patientDetails: PatientDetails): void => {
        setSubRoute(UserPatientRestrictionsSubRoute.VIEW);
        setPatientDetails(patientDetails);
        navigate(routeChildren.USER_PATIENT_RESTRICTIONS_VERIFY_PATIENT);
    };

    if (failedLoading) {
        return (
            <Table.Row>
                <Table.Cell colSpan={6}>
                    <ErrorMessage data-testid="failed-to-load-error">
                        Failed to load user patient restrictions
                    </ErrorMessage>
                </Table.Cell>
            </Table.Row>
        );
    }

    if (restrictions.length > 0 && !isLoading) {
        return (
            <>
                {restrictions.map((restriction): React.JSX.Element => {
                    return (
                        <Table.Row key={restriction.id}>
                            <Table.Cell>{formatNhsNumber(restriction.nhsNumber)}</Table.Cell>
                            <Table.Cell>
                                {getFormattedPatientFullName({
                                    givenName: restriction.patientGivenName,
                                    familyName: restriction.patientFamilyName,
                                } as PatientDetails)}
                            </Table.Cell>
                            <Table.Cell>
                                {formatSmartcardNumber(restriction.restrictedUser)}
                            </Table.Cell>
                            <Table.Cell>{`${restriction.restrictedUserFirstName} ${restriction.restrictedUserLastName}`}</Table.Cell>
                            <Table.Cell>
                                {getFormattedDateFromString(`${restriction.created}`)}
                            </Table.Cell>
                            <Table.Cell className="nowrap">
                                {loadingPatient ? (
                                    <SpinnerV2 status="Loading..." />
                                ) : (
                                    <Link
                                        to="#"
                                        data-testid={`view-record-link-${restriction.id}`}
                                        onClick={(e): void => {
                                            e.preventDefault();
                                            onViewClicked(restriction.nhsNumber);
                                        }}
                                    >
                                        View
                                    </Link>
                                )}
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </>
        );
    }

    return (
        <Table.Row>
            <Table.Cell colSpan={6}>
                {isLoading ? (
                    <SpinnerV2 status="Loading..." />
                ) : (
                    <>No user patient restrictions found</>
                )}
            </Table.Cell>
        </Table.Row>
    );
};
