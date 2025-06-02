import React from 'react';
import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import logoSrc from '../assets/logo.svg'; // Use SVG logo
import { ROUTES } from '../utils/navigation';
import { CalendarHeart } from 'lucide-react'; // Import the icon

const Header: React.FC = () => {
  return (
    <header className="bg-stone-50 p-4 md:px-8 border-b border-stone-200 sticky top-0 z-10">
      <div className="container mx-auto flex justify-between items-center">
        {/* Logo linking to home */}
        <Link to={ROUTES.HOME} className="flex items-center">
          <img src={logoSrc} alt="Maaltyd Logo" className="h-8 w-auto" /> {/* Adjust height as needed */} 
        </Link>

        {/* Navigation Buttons */}
        <div className="flex space-x-2 items-center">
          {/* Add Recipe - Only for authenticated users */}
          <SignedIn>
            <Link 
              to={ROUTES.ADD_RECIPE} 
              className="inline-flex items-center justify-center rounded-md border border-stone-300 bg-white px-3 md:px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 transition duration-150 ease-in-out"
            >
               New<span className="hidden md:inline">&nbsp;Recipe</span>
            </Link>
          </SignedIn>
          
          {/* Meal Plan - Always visible */}
          <Link 
            to={ROUTES.MEAL_PLAN} // Assuming MEAL_PLAN route is defined
            className="inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-150 ease-in-out text-white bg-emerald-800 hover:bg-emerald-700 focus:ring-emerald-600"
          >
            <CalendarHeart className="mr-2 h-4 w-4" />
            Plan
          </Link>
          
          {/* Clerk Auth Components */}
          <SignedOut>
            <SignInButton>
              <button className="inline-flex items-center justify-center rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 transition duration-150 ease-in-out">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </div>
    </header>
  );
};

export default Header; 