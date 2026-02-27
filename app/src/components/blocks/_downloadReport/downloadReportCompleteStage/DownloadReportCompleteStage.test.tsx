import { render, screen } from '@testing-library/react';
import DownloadReportCompleteStage from './DownloadReportCompleteStage';
import { REPORT_TYPE, ReportData } from '../../../../types/generic/reports';
import { getFormattedDate } from '../../../../helpers/utils/formatDate';
import { describe, expect, it, Mock } from 'vitest';
import { routes } from '../../../../types/generic/routes';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});
const mockNavigate = vi.fn();

describe('DownloadReportCompleteStage', () => {
    it('should render correctly', () => {
        const report = {
            title: 'title',
            reportType: REPORT_TYPE.ODS_PATIENT_SUMMARY,
        } as ReportData;

        render(<DownloadReportCompleteStage report={report} />);

        const title = screen.getByTestId('report-download-complete-header');
        expect(title).toBeInTheDocument();
        expect(title.innerHTML).toContain(report.title);

        const downloadDate = screen.getByTestId('report-download-complete-date');
        expect(downloadDate).toBeInTheDocument();
        expect(downloadDate.innerHTML).toBe(getFormattedDate(new Date()));

        expect(screen.getByTestId('home-button')).toBeInTheDocument();
        expect(screen.getByTestId('back-to-download-page-button')).toBeInTheDocument();
        expect(screen.getByText('Go to home')).toBeInTheDocument();
    });

    it('should navigate to home on home button click', () => {
        const report = {
            title: 'title',
            reportType: REPORT_TYPE.ODS_PATIENT_SUMMARY,
        } as ReportData;

        render(<DownloadReportCompleteStage report={report} />);

        const homeButton = screen.getByTestId('home-button');
        homeButton.click();

        expect(mockNavigate).toHaveBeenCalledWith(routes.HOME);
    });

    it('should navigate to report download page on back button click', () => {
        const report = {
            title: 'title',
            reportType: REPORT_TYPE.ODS_PATIENT_SUMMARY,
        } as ReportData;

        render(<DownloadReportCompleteStage report={report} />);

        const backButton = screen.getByTestId('back-to-download-page-button');
        backButton.click();

        expect(mockNavigate).toHaveBeenCalledWith(
            `${routes.REPORT_DOWNLOAD}?reportType=${report.reportType}`,
        );
    });

    it('should display "for:" in heading when report type is PATIENT', () => {
        const report = {
            title: 'Lloyd George summary report',
            reportType: REPORT_TYPE.ODS_PATIENT_SUMMARY,
        } as ReportData;

        render(<DownloadReportCompleteStage report={report} />);

        const heading = screen.getByTestId('report-download-complete-header');
        expect(heading.textContent).toBe(
            'You have downloaded the Lloyd George summary report for:',
        );
    });

    it('should display "to review" in heading when report type is REVIEW', () => {
        const report = {
            title: 'Documents review summary report',
            reportType: REPORT_TYPE.ODS_REVIEW_SUMMARY,
        } as ReportData;

        render(<DownloadReportCompleteStage report={report} />);

        const heading = screen.getByTestId('report-download-complete-header');
        expect(heading.textContent).toBe('You have downloaded the report on documents to review');
    });
});
