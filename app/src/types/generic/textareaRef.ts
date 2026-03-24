import type { RefObject } from 'react';
import type { RefCallBack } from 'react-hook-form';

export interface TextAreaRef extends RefObject<HTMLTextAreaElement | null>, RefCallBack {}
