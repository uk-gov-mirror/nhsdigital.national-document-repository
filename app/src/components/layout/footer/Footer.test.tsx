import { render, screen } from '@testing-library/react';
import Footer from './Footer';
import { describe, expect, it, Mock } from 'vitest';
import { routes } from '../../../types/generic/routes';

vi.mock('react-router-dom', () => {
    const actual = vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockUseNavigate,
    }
});
const mockUseNavigate = vi.fn();

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

    it('should navigate to cookie policy on link click', () => {
        render(<Footer />);
        const cookiesPolicyLink = screen.getByTestId('cookies-policy-link');
        cookiesPolicyLink.click();
        expect(mockUseNavigate).toHaveBeenCalledWith(routes.COOKIES_POLICY);
    });
});
