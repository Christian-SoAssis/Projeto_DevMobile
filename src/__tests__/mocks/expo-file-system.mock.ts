export const readAsStringAsync = jest.fn(() => Promise.resolve(''));
export const writeAsStringAsync = jest.fn(() => Promise.resolve());
export const deleteAsync = jest.fn(() => Promise.resolve());
export const getInfoAsync = jest.fn(() => Promise.resolve({ exists: false }));
export const createDownloadResumable = jest.fn(() => ({ downloadAsync: jest.fn(() => Promise.resolve()) }));
export const documentDirectory = '/documents';
export const cacheDirectory = '/cache';

export default {
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  getInfoAsync,
  createDownloadResumable,
  documentDirectory,
  cacheDirectory,
};
