import axios, { AxiosError } from 'axios';
import downloadReport from './downloadReport';
import { REPORT_TYPE, ReportData } from '../../types/generic/reports';
import { AuthHeaders } from '../../types/blocks/authHeaders';
import { afterEach, beforeEach, describe, expect, it, Mock, Mocked, vi } from 'vitest';
import { Procedure } from '@vitest/spy';

vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;
(mockedAxios.get as any) = vi.fn();

describe('downloadReport', () => {
    const report = {
        endpoint: '/download',
        reportType: REPORT_TYPE.ODS_REVIEW_SUMMARY,
    } as ReportData;

    let clickSpy: Mock<Procedure>;
    let mockAnchor: Partial<HTMLAnchorElement>;

    beforeEach(() => {
        clickSpy = vi.fn();
        mockAnchor = {
            setAttribute: vi.fn(),
            click: clickSpy,
        };

        vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
            if (tagName === 'a') {
                return mockAnchor as HTMLAnchorElement;
            }
            return document.createElement(tagName);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should fetch the report url from the API and trigger link click', async () => {
        mockedAxios.get.mockResolvedValue({ status: 200, data: { url: 'downloadFile' } });

        const args = {
            report,
            fileType: 'csv',
            baseUrl: 'http://example.com',
            baseHeaders: {
                'Content-Type': '',
                Authorization: 'token',
            } as AuthHeaders,
        };

        const getSpy = vi.spyOn(mockedAxios, 'get');

        await downloadReport(args);

        expect(getSpy).toHaveBeenCalledWith(args.baseUrl + report.endpoint, {
            headers: args.baseHeaders,
            params: { outputFileFormat: args.fileType, odsReportType: 'REVIEW' },
        });

        expect(mockAnchor.setAttribute).toHaveBeenCalledWith('download', '');
        expect(mockAnchor.href).toBe('downloadFile');
        expect(clickSpy).toHaveBeenCalled();
    });

    it('should throw an axios error when the request fails', async () => {
        const getSpy = vi.spyOn(mockedAxios, 'get').mockImplementation(() => {
            throw { response: { status: 404 } };
        });

        const args = {
            report,
            fileType: 'csv',
            baseUrl: 'http://example.com',
            baseHeaders: {
                'Content-Type': '',
                Authorization: 'token',
            } as AuthHeaders,
        };

        let errorCode;

        try {
            await downloadReport(args);
        } catch (e) {
            errorCode = (e as AxiosError)?.response?.status;
        }

        expect(errorCode).not.toBeUndefined();
        expect(errorCode).toBe(404);
        expect(getSpy).toHaveBeenCalledWith(args.baseUrl + report.endpoint, {
            headers: args.baseHeaders,
            params: { outputFileFormat: args.fileType, odsReportType: 'REVIEW' },
        });
    });
});
