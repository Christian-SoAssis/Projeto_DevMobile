export const manipulateAsync = jest.fn(() =>
  Promise.resolve({ uri: 'file:///manipulated.webp', width: 100, height: 100, size: 1000 })
);

export default { manipulateAsync };
