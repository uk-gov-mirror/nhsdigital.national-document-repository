import axios from 'axios';
import { DOWNLOAD_STAGE } from '../../types/generic/downloadStage';
import { SetStateAction } from 'react';

export const getPdfObjectUrl = async (
    cloudFrontUrl: string,
    setPdfObjectUrl: (value: SetStateAction<string>) => void,
    setDownloadStage: (value: SetStateAction<DOWNLOAD_STAGE>) => void = (): void => {},
): Promise<number> => {
    const { data } = await axios.get<Blob>(cloudFrontUrl, {
        responseType: 'blob',
    });

    const objectUrl = URL.createObjectURL(data);

    setPdfObjectUrl(objectUrl);
    setDownloadStage(DOWNLOAD_STAGE.SUCCEEDED);
    return data.size;
};
