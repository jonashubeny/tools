import type { TutorMode } from '@lemma/core';
import { createContext, useContext } from 'react';

/** What the tutor is being asked about when it is opened from somewhere in the app. */
export interface TutorTarget {
  problemId?: string;
  concept?: string;
  mode?: TutorMode;
  /** Text to put in the message box, e.g. the learner's wrong answer. */
  draft?: string;
}

export interface TutorApi {
  enabled: boolean;
  isOpen: boolean;
  target: TutorTarget;
  open: (target?: TutorTarget) => void;
  close: () => void;
}

export const TutorContext = createContext<TutorApi>({
  enabled: false,
  isOpen: false,
  target: {},
  open: () => undefined,
  close: () => undefined,
});

export const useTutor = (): TutorApi => useContext(TutorContext);
