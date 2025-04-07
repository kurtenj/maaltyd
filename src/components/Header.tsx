import React from 'react';
import { Link } from 'react-router-dom';
import logoSrc from '../assets/logo.svg'; // Use SVG logo
import { ROUTES } from '../utils/navigation';

const Header: React.FC = () => {
  return (
    <header className="bg-stone-50 p-4 md:px-8 border-b border-stone-200 sticky top-0 z-10">
      <div className="container mx-auto flex justify-between items-center">
        {/* Logo linking to home */}
        <Link to={ROUTES.HOME} className="flex items-center">
          <img src={logoSrc} alt="Maaltyd Logo" className="h-8 w-auto" /> {/* Adjust height as needed */} 
        </Link>

        {/* Add Recipe Button */} 
        <Link 
          to={ROUTES.ADD_RECIPE} 
          className="inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-150 ease-in-out text-white bg-emerald-800 hover:bg-emerald-700 focus:ring-emerald-600"
        >
           New Recipe
        </Link>
      </div>
    </header>
  );
};

export default Header; 