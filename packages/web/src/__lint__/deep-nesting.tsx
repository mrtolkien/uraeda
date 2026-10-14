// Five nested blocks: refused by `max-depth`, whose limit is 4.
export function deepNesting(value: number) {
  if (value > 0) {
    if (value > 1) {
      if (value > 2) {
        if (value > 3) {
          if (value > 4) {
            return "deep";
          }
        }
      }
    }
  }
  return "shallow";
}
