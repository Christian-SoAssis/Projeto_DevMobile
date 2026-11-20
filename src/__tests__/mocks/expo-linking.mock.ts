export const createURL = jest.fn(() => 'enlace://');
export const openURL = jest.fn(() => Promise.resolve(true));

export default { createURL, openURL };
