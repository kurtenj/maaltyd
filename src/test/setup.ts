import '@testing-library/jest-dom'; // Only use the side-effect import
// import { expect, afterEach } from 'vitest'; // Remove expect from import
import { afterEach } from 'vitest'; // Import only afterEach
import { cleanup } from '@testing-library/react'; // Keep react-testing-library import
// import fetchMock from 'vitest-fetch-mock'; // Remove import
// import matchers from '@testing-library/jest-dom/matchers'; // Remove this
// import { extendExpect } from '@testing-library/jest-dom'; // Remove this

// Remove setup for fetch mock
// fetchMock.enableMocks(); // Remove this line

// Do not call expect.extend or extendExpect explicitly
// The side-effect import should handle it

afterEach(() => {
  cleanup();
  // Remove reset for fetch mock
  // fetchMock.resetMocks(); // Remove this line
});