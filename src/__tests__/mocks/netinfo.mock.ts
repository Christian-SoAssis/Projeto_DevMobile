const unsubscribeFn = jest.fn();
(unsubscribeFn as any).remove = jest.fn();

export const addEventListener = jest.fn(() => unsubscribeFn);
export const fetch = jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true }));

export default {
  addEventListener,
  fetch,
};
