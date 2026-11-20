export const requestForegroundPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
export const getCurrentPositionAsync = jest.fn(() =>
  Promise.resolve({ coords: { latitude: -21.55, longitude: -45.43, accuracy: 10 } })
);
export const watchPositionAsync = jest.fn(() => Promise.resolve('watch-id-1'));
export const stopWatchingAsync = jest.fn(() => Promise.resolve());

export default {
  requestForegroundPermissionsAsync,
  getCurrentPositionAsync,
  watchPositionAsync,
  stopWatchingAsync,
};
