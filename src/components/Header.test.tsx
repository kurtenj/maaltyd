import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Header from './Header';

describe('Header', () => {
  it('renders navigation links and logo', () => {
    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );
    
    expect(screen.getByAltText(/maaltyd logo/i)).toBeInTheDocument();
    expect(screen.getByText(/plan/i)).toBeInTheDocument();
    expect(screen.getByText(/new/i)).toBeInTheDocument();
  });
});