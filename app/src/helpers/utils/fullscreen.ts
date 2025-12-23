export const setFullScreen = (): void => {
    if (document.fullscreenEnabled) {
        document.documentElement.requestFullscreen?.();
    }
};
