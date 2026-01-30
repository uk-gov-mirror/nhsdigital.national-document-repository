import LloydGeorgeSummaryDescription from '../../components/blocks/_downloadReport/downloadReportSelectStage/ReportDescriptions/LloydGeorgeSummaryDescription';
import { endpoints } from './endpoints';
import ReviewSummaryDescription from '../../components/blocks/_downloadReport/downloadReportSelectStage/ReportDescriptions/ReviewSummaryDescription';

export enum REPORT_TYPE {
    ODS_PATIENT_SUMMARY = 'PATIENT',
    ODS_REVIEW_SUMMARY = 'REVIEW',
}

export type FileTypeData = {
    extension: string;
    label: string;
};

export type ReportData = {
    title: string;
    description: () => React.JSX.Element;
    fileTypes: FileTypeData[];
    reportType: REPORT_TYPE;
    endpoint: string;
};

export const getReportByType = (reportType: REPORT_TYPE): ReportData | undefined => {
    return reports.find((r) => r.reportType === reportType);
};

export const reports: ReportData[] = [
    {
        title: 'Lloyd George summary report',
        description: LloydGeorgeSummaryDescription,
        fileTypes: [
            { extension: 'csv', label: 'a CSV' },
            { extension: 'xlsx', label: 'an Excel' },
            { extension: 'pdf', label: 'a PDF' },
        ],
        reportType: REPORT_TYPE.ODS_PATIENT_SUMMARY,
        endpoint: endpoints.ODS_REPORT,
    },
    {
        title: 'Documents review summary report',
        description: ReviewSummaryDescription,
        fileTypes: [{ extension: 'csv', label: 'a CSV' }],
        reportType: REPORT_TYPE.ODS_REVIEW_SUMMARY,
        endpoint: endpoints.ODS_REPORT,
    },
];
