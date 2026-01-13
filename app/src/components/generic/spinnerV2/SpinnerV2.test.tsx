import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SpinnerV2 from './SpinnerV2';

describe('SpinnerV2', () => {
    it('renders status text and uses it as aria-label', () => {
        render(<SpinnerV2 id="my-spinner" status="Loading..." />);

        const container = screen.getByLabelText('Loading...');
        expect(container).toHaveAttribute('id', 'my-spinner');
        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders without optional props', () => {
        render(<SpinnerV2 />);

        expect(document.querySelector('.nhsuk-loader-v2')).toBeTruthy();
    });
});
