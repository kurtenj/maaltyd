import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Header from './Header';

vi.mock('@clerk/nextjs', () => ({
  Show: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UserButton: () => <div data-testid="user-button">User</div>,
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, className }: { src: { src: string } | string; alt: string; className?: string }) => (
    <img src={typeof src === 'string' ? src : src.src} alt={alt} className={className} />
  ),
}));

describe('Header', () => {
  it('renders navigation links and logo', () => {
    render(<Header />);

    expect(screen.getByAltText(/maaltyd logo/i)).toBeInTheDocument();
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
    expect(screen.getByTestId('user-button')).toBeInTheDocument();
  });
});
