import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
    handlePatientSearchError,
    handleSearch,
    PATIENT_SEARCH_STATES,
} from './handlePatientSearch';
import getPatientDetails from '../requests/getPatientDetails';
import errorCodes from './errorCodes';
import { routes } from '../../types/generic/routes';
import { UIErrorCode } from '../../types/generic/errors';

vi.mock('../requests/getPatientDetails');

const mockGetPatientDetails = vi.mocked(getPatientDetails);

const mockIsMock = vi.fn();
vi.mock('./isLocal', () => ({
    isMock: (...args: any[]): boolean => mockIsMock(...args),
}));

const mockErrorToParams = vi.fn();
vi.mock('./errorToParams', () => ({
    errorToParams: (...args: any[]): string => mockErrorToParams(...args),
}));

describe('handleSearch', () => {
    const setSearchingState = vi.fn();
    const handleSuccess = vi.fn();

    const baseUrl = 'https://api.example.com';
    const baseHeaders = { Authorization: 'Bearer token' } as any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockIsMock.mockReturnValue(false);
    });

    it('sets SEARCHING state immediately', async () => {
        mockGetPatientDetails.mockResolvedValueOnce({ active: true, deceased: false } as any);

        await handleSearch({
            nhsNumber: '123 456 7890',
            setSearchingState,
            handleSuccess,
            baseUrl,
            baseHeaders,
            mockLocal: { patientIsActive: true, patientIsDeceased: false } as any,
        });

        expect(setSearchingState).toHaveBeenCalledWith(PATIENT_SEARCH_STATES.SEARCHING);
    });

    it('cleans NHS number before calling getPatientDetails', async () => {
        mockGetPatientDetails.mockResolvedValueOnce({ active: true, deceased: false } as any);

        await handleSearch({
            nhsNumber: '123-456 7890',
            setSearchingState,
            handleSuccess,
            baseUrl,
            baseHeaders,
            mockLocal: { patientIsActive: true, patientIsDeceased: false } as any,
        });

        expect(mockGetPatientDetails).toHaveBeenCalledWith({
            nhsNumber: '1234567890',
            baseUrl,
            baseHeaders,
        });
    });

    it('allow inactive non-deceased patient when user is clinical', async () => {
        mockGetPatientDetails.mockResolvedValueOnce({ active: false, deceased: false } as any);

        await handleSearch({
            nhsNumber: '1234567890',
            setSearchingState,
            handleSuccess,
            baseUrl,
            baseHeaders,
            mockLocal: { patientIsActive: true, patientIsDeceased: false } as any,
        });

        expect(handleSuccess).toHaveBeenCalled();
    });

    it('allow inactive non-deceased patient when user is admin and either flag is disabled', async () => {
        mockGetPatientDetails.mockResolvedValueOnce({ active: false, deceased: false } as any);

        await handleSearch({
            nhsNumber: '1234567890',
            setSearchingState,
            handleSuccess,
            baseUrl,
            baseHeaders,
            mockLocal: { patientIsActive: true, patientIsDeceased: false } as any,
        });

        expect(handleSuccess).toHaveBeenCalled();
    });

    it('allows inactive non-deceased patient when user is admin and both flags are enabled', async () => {
        const patient = { active: false, deceased: false };
        mockGetPatientDetails.mockResolvedValueOnce(patient as any);

        const result = await handleSearch({
            nhsNumber: '1234567890',
            setSearchingState,
            handleSuccess,
            baseUrl,
            baseHeaders,
            mockLocal: { patientIsActive: true, patientIsDeceased: false } as any,
        });

        expect(result).toBeUndefined();
        expect(handleSuccess).toHaveBeenCalledWith(patient);
    });

    it('uses mock patient details when error isMock()', async () => {
        mockIsMock.mockReturnValue(true);
        mockGetPatientDetails.mockRejectedValueOnce(new Error('mock-mode') as any);

        const result = await handleSearch({
            nhsNumber: '1234567890',
            setSearchingState,
            handleSuccess,
            baseUrl,
            baseHeaders,
            mockLocal: { patientIsActive: false, patientIsDeceased: true } as any,
        });

        expect(result).toBeUndefined();
        expect(handleSuccess).toHaveBeenCalledTimes(1);
        expect(handleSuccess.mock.calls[0][0]).toMatchObject({
            nhsNumber: '1234567890',
            active: false,
            deceased: true,
        });
    });

    it('returns 400 message for bad request', async () => {
        const error = { response: { status: 400 } } as any;
        mockGetPatientDetails.mockRejectedValueOnce(error);

        const result = await handleSearch({
            nhsNumber: 'bad',
            setSearchingState,
            handleSuccess,
            baseUrl,
            baseHeaders,
            mockLocal: { patientIsActive: true, patientIsDeceased: false } as any,
        });

        expect(result).toEqual(['Enter a valid patient NHS number.', 400, error]);
    });

    it('returns 403 status with null error message', async () => {
        const error = { response: { status: 403 } } as any;
        mockGetPatientDetails.mockRejectedValueOnce(error);

        const result = await handleSearch({
            nhsNumber: '1234567890',
            setSearchingState,
            handleSuccess,
            baseUrl,
            baseHeaders,
            mockLocal: { patientIsActive: true, patientIsDeceased: false } as any,
        });

        expect(result).toEqual([null, 403, error]);
    });

    it.each(['SP_4002', 'SP_4003'])('returns expected error message for 404', async (errCode) => {
        const error = { response: { status: 404, data: { err_code: errCode } } } as any;
        mockGetPatientDetails.mockRejectedValueOnce(error);

        const result = await handleSearch({
            nhsNumber: '1234567890',
            setSearchingState,
            handleSuccess,
            baseUrl,
            baseHeaders,
            mockLocal: { patientIsActive: true, patientIsDeceased: false } as any,
        });

        expect(result).toEqual([errorCodes[errCode], 404, error]);
    });
});

describe('handlePatientSearchError', () => {
    const navigate = vi.fn();
    const setFailedSubmitState = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockErrorToParams.mockReturnValue('?x=1');
    });

    it('navigates to generic error page with restricted error code on 403 with SP_4006', () => {
        const error = {
            response: {
                status: 403,
                data: { err_code: 'SP_4006' },
            },
        } as any;

        handlePatientSearchError(403, navigate, setFailedSubmitState, error);

        expect(navigate).toHaveBeenCalledWith(
            `${routes.GENERIC_ERROR}?errorCode=${UIErrorCode.PATIENT_ACCESS_RESTRICTED}`,
        );
        expect(setFailedSubmitState).toHaveBeenCalledWith(403);
    });

    it('navigates to session-expired on 403', () => {
        const error = { response: { status: 403 } } as any;

        handlePatientSearchError(403, navigate, setFailedSubmitState, error);

        expect(navigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
        expect(setFailedSubmitState).toHaveBeenCalledWith(403);
    });

    it('navigates to server-error with params on non-403', () => {
        const error = { response: { status: 500 } } as any;

        handlePatientSearchError(500, navigate, setFailedSubmitState, error);

        expect(mockErrorToParams).toHaveBeenCalledWith(error);
        expect(navigate).toHaveBeenCalledWith(routes.SERVER_ERROR + '?x=1');
        expect(setFailedSubmitState).toHaveBeenCalledWith(500);
    });
});
