import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { setFullScreen } from './fullscreen';

describe('setFullScreen', () => {
    let mockRequestFullscreen: ReturnType<typeof vi.fn>;
    let mockExitFullscreen: ReturnType<typeof vi.fn>;
    let originalDocumentElement: HTMLElement;

    beforeEach(() => {
        mockRequestFullscreen = vi.fn();
        mockExitFullscreen = vi.fn();

        // Store original values
        originalDocumentElement = document.documentElement;

        // Setup mocks
        Object.defineProperty(document, 'documentElement', {
            writable: true,
            configurable: true,
            value: {
                ...originalDocumentElement,
                requestFullscreen: mockRequestFullscreen,
            },
        });

        Object.defineProperty(document, 'exitFullscreen', {
            writable: true,
            configurable: true,
            value: mockExitFullscreen,
        });

        Object.defineProperty(document, 'fullscreenElement', {
            writable: true,
            configurable: true,
            value: null,
        });

        Object.defineProperty(document, 'fullscreenEnabled', {
            writable: true,
            configurable: true,
            value: true,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('when fullscreen is enabled', () => {
        it('calls requestFullscreen when no fullscreenElement exists', () => {
            setFullScreen();

            expect(mockRequestFullscreen).toHaveBeenCalledTimes(1);
            expect(mockRequestFullscreen).toHaveBeenCalledWith();
        });

        it('handles requestFullscreen being undefined gracefully', () => {
            Object.defineProperty(document, 'documentElement', {
                writable: true,
                configurable: true,
                value: {
                    requestFullscreen: undefined,
                },
            });

            expect(() => setFullScreen()).not.toThrow();
        });

        it('handles requestFullscreen being null gracefully', () => {
            Object.defineProperty(document, 'documentElement', {
                writable: true,
                configurable: true,
                value: {
                    requestFullscreen: null,
                },
            });

            expect(() => setFullScreen()).not.toThrow();
        });
    });

    describe('when fullscreen is not enabled', () => {
        beforeEach(() => {
            Object.defineProperty(document, 'fullscreenEnabled', {
                writable: true,
                configurable: true,
                value: false,
            });
        });

        it('does not call requestFullscreen', () => {
            setFullScreen();

            expect(mockRequestFullscreen).not.toHaveBeenCalled();
        });

        it('does nothing if fullscreenEnabled is false', () => {
            const result = setFullScreen();

            expect(result).toBeUndefined();
            expect(mockRequestFullscreen).not.toHaveBeenCalled();
        });
    });
});
