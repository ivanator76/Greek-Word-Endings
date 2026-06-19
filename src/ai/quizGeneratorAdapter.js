export function createQuizSource(coreGenerator) {
  return {
    mode: 'deterministic',
    next(filters) {
      return coreGenerator(filters);
    },
  };
}
