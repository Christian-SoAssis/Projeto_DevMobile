export const addEventListener = jest.fn(() => ({ remove: jest.fn() }));
export const fetch = jest.fn(() => Promise.resolve({ isInternetReachable: true }));

export default {
  addEventListener,
  fetch,
};
