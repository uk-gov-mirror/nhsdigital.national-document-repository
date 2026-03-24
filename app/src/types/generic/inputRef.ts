import type { RefObject } from 'react';
import type { RefCallBack } from 'react-hook-form';

export interface InputRef extends RefObject<HTMLInputElement | null>, RefCallBack {}
