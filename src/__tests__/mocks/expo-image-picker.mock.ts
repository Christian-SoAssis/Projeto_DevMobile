export const launchCameraAsync = jest.fn(() => Promise.resolve({ canceled: false, assets: [] }));
export const launchImageLibraryAsync = jest.fn(() => Promise.resolve({ canceled: false, assets: [] }));

export default {
  launchCameraAsync,
  launchImageLibraryAsync,
};
