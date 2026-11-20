export const shareAsync = jest.fn(() => Promise.resolve({ action: 'shared' }));

export default { shareAsync };
