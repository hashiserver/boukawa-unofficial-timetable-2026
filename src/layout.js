/** Keep one time scale across floors while giving every card enough text space. */
export function requiredScale(cards, minimum = 4) {
  return Math.max(minimum, ...cards.map(({ height, duration }) => (height + 6) / duration));
}
