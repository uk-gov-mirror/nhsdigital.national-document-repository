import React, { JSX } from 'react';

type Props = {
    id?: string;
    status?: string;
};

const SpinnerV2 = ({ id, status }: Props): JSX.Element => {
    return (
        <div id={id} className="nhsuk-loader-v2" aria-label={status}>
            <output className="nhsuk-loader__text-v2">{status}</output>
            <span className="spinner-blue-v2"></span>
        </div>
    );
};

export default SpinnerV2;
