import { render, screen } from '@testing-library/react';
import Footer from './Footer';
import { describe, expect, it } from 'vitest';

describe('Footer', () => {
    describe('Rendering', () => {
        it('renders privacy policy link', () => {
            render(<Footer />);
            expect(screen.getByTestId('privacy-link')).toBeInTheDocument();
        });
        it('renders service updates link', () => {
            render(<Footer />);
            expect(screen.getByTestId('service-updates-link')).toBeInTheDocument();
        });
        it('renders help and guidance link', () => {
            render(<Footer />);
            expect(screen.getByTestId('help-and-guidance-link')).toBeInTheDocument();
        });
    });
});
