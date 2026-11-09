'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Show, SignInButton, UserButton } from '@clerk/nextjs';
import logo from '../assets/logo.svg';
import { ROUTES } from '../utils/navigation';
import { Plus } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-stone-500/20 p-4 md:px-8 sticky top-0 z-50 backdrop-blur-sm">
      <div className="container mx-auto flex justify-between items-center">
        {/* Logo linking to home */}
        <Link href={ROUTES.HOME} className="flex items-center" aria-label="Maaltyd - Home">
          <Image src={logo} alt="Maaltyd Logo" className="h-8 w-auto" priority />
        </Link>

        {/* Navigation Buttons */}
        <div className="flex space-x-2 items-center">
          {/* Add Recipe - Only for authenticated users */}
          <Show when="signed-in">
            <Link
              href={ROUTES.ADD_RECIPE}
              className="inline-flex items-center justify-center rounded-md border border-stone-300 bg-white p-2 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 transition duration-150 ease-in-out"
              title="Add new recipe"
            >
              <Plus className="h-4 w-4" />
            </Link>
          </Show>

          {/* Clerk Auth Components */}
          <Show when="signed-out">
            <SignInButton>
              <button className="inline-flex items-center justify-center rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 transition duration-150 ease-in-out">
                Sign In
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
};

export default Header;
