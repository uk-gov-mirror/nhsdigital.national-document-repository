export type SimulateProgressOptions = {
    timeConstant?: number;
    autoStart?: boolean;
};

export type SimulateProgressTimer = {
    progress: number;
    start: () => void;
    stop: () => void;
};

const createSimulateProgress = (opts: SimulateProgressOptions = {}): SimulateProgressTimer => {
    const timeConstant = opts.timeConstant ?? 1000;
    const intervalFrequency = 100;
    let time = 0;
    let intervalId: NodeJS.Timeout | null = null;

    const timer: SimulateProgressTimer = {
        progress: 0,
        start: () => {
            time = 0;
            intervalId = setInterval(() => {
                time += intervalFrequency;
                timer.progress = 1 - Math.exp((-1 * time) / timeConstant);
            }, intervalFrequency);
        },
        stop: () => {
            if (intervalId !== null) {
                clearInterval(intervalId);
                intervalId = null;
            }
        },
    };

    if (opts.autoStart) {
        timer.start();
    }

    return timer;
};

export default createSimulateProgress;
