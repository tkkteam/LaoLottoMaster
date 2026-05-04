export const normalize = (value: number, max: number) => {
  return max === 0 ? 0 : value / max;
};

export const randomInt = (max: number) => {
  return Math.floor(Math.random() * max);
};