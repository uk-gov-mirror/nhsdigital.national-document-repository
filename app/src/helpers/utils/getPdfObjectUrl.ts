import axios from 'axios';
import { DOWNLOAD_STAGE } from '../../types/generic/downloadStage';
import { SetStateAction } from 'react';

export const getPdfObjectUrl = async (
    cloudFrontUrl: string,
    setPdfObjectUrl: (value: SetStateAction<string>) => void,
    setDownloadStage: (value: SetStateAction<DOWNLOAD_STAGE>) => void,
): Promise<void> => {
    const { data } = await axios.get(cloudFrontUrl, {
        responseType: 'blob',
    });

    const objectUrl = URL.createObjectURL(data);

    setPdfObjectUrl(objectUrl);
    setDownloadStage(DOWNLOAD_STAGE.SUCCEEDED);
};
