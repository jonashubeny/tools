import type { Generator } from '@lemma/core';
import { BASIC_ALGEBRA_GENERATORS } from './basic-algebra';
import { BASIC_DATA_GENERATORS } from './basic-data';
import { BASIC_FRACTION_GENERATORS } from './basic-fractions';
import { BASIC_GEOMETRY_GENERATORS } from './basic-geometry';
import { BASIC_NUMBER_GENERATORS } from './basic-numbers';
import { BASIC_PUZZLE_GENERATORS } from './basic-puzzles';

/** Generators for the lower-secondary track ('basic'), gathered from the files beside this one. */
export const BASIC_GENERATORS: Generator[] = [
  ...BASIC_NUMBER_GENERATORS,
  ...BASIC_FRACTION_GENERATORS,
  ...BASIC_ALGEBRA_GENERATORS,
  ...BASIC_DATA_GENERATORS,
  ...BASIC_GEOMETRY_GENERATORS,
  ...BASIC_PUZZLE_GENERATORS,
];
