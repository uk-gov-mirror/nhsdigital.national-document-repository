import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import createSimulateProgress from './simulateProgress';

describe('createSimulateProgress', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns a timer with progress at 0 and start/stop methods', () => {
        const timer = createSimulateProgress();

        expect(timer.progress).toBe(0);
        expect(typeof timer.start).toBe('function');
        expect(typeof timer.stop).toBe('function');
    });

    it('does not auto-start by default', () => {
        const timer = createSimulateProgress();

        vi.advanceTimersByTime(500);

        expect(timer.progress).toBe(0);
    });

    it('auto-starts when autoStart option is true', () => {
        const timer = createSimulateProgress({ autoStart: true });

        vi.advanceTimersByTime(500);

        expect(timer.progress).toBeGreaterThan(0);
    });

    it('starts updating progress when start is called', () => {
        const timer = createSimulateProgress();

        timer.start();
        vi.advanceTimersByTime(500);

        expect(timer.progress).toBeGreaterThan(0);
    });

    it('stops updating progress when stop is called', () => {
        const timer = createSimulateProgress();

        timer.start();
        vi.advanceTimersByTime(500);
        timer.stop();

        const progressAtStop = timer.progress;

        vi.advanceTimersByTime(500);

        expect(timer.progress).toBe(progressAtStop);
    });

    it('calculates progress using exponential decay formula', () => {
        const timeConstant = 1000;
        const timer = createSimulateProgress({ timeConstant });

        timer.start();
        vi.advanceTimersByTime(1000);

        const expectedProgress = 1 - Math.exp(-1000 / timeConstant);
        expect(timer.progress).toBeCloseTo(expectedProgress, 5);
    });

    it('uses custom timeConstant when provided', () => {
        const fastTimer = createSimulateProgress({ timeConstant: 500 });
        const slowTimer = createSimulateProgress({ timeConstant: 2000 });

        fastTimer.start();
        slowTimer.start();
        vi.advanceTimersByTime(500);

        expect(fastTimer.progress).toBeGreaterThan(slowTimer.progress);

        fastTimer.stop();
        slowTimer.stop();
    });

    it('resets time when start is called again', () => {
        const timer = createSimulateProgress();

        timer.start();
        vi.advanceTimersByTime(1000);

        const progressAfterFirstRun = timer.progress;

        timer.stop();
        timer.start();
        vi.advanceTimersByTime(100);

        expect(timer.progress).toBeLessThan(progressAfterFirstRun);

        timer.stop();
    });

    it('approaches but never reaches 1', () => {
        const timer = createSimulateProgress({ timeConstant: 1000 });

        timer.start();
        vi.advanceTimersByTime(10000);

        expect(timer.progress).toBeGreaterThan(0.99);
        expect(timer.progress).toBeLessThan(1);

        timer.stop();
    });

    it('handles stop being called when not started', () => {
        const timer = createSimulateProgress();

        expect(() => timer.stop()).not.toThrow();
    });
});
