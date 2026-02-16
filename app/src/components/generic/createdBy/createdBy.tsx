import { Card } from 'nhsuk-react-components';
import { JSX } from 'react';

export type CreatedByProps = {
    odsCode: string;
    dateUploaded: string;
    cssClass?: string;
};

export const CreatedByCard = ({ odsCode, dateUploaded, cssClass }: CreatedByProps): JSX.Element => (
    <Card.Content className={cssClass}>
        Created by practice {odsCode} on {dateUploaded}
    </Card.Content>
);

export const CreatedByText = ({ odsCode, dateUploaded, cssClass }: CreatedByProps): JSX.Element => (
    <p className={cssClass}>
        Created by practice {odsCode} on {dateUploaded}
    </p>
);
