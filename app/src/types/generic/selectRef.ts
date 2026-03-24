import type { RefObject } from 'react';
import type { RefCallBack } from 'react-hook-form';

export interface SelectRef extends RefObject<HTMLSelectElement | null>, RefCallBack {}
