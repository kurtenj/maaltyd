import React from 'react';

const APP_VERSION = 'v0.1.0'; // Hardcode version for now

const Footer: React.FC = () => {
  return (
    <footer className="w-full py-3 px-4 md:px-8 mt-auto bg-stone-100 border-t border-stone-200">
      <div className="container mx-auto text-center">
        <p className="text-xs text-stone-500">
          Maaltyd {APP_VERSION}
        </p>
      </div>
    </footer>
  );
};

export default Footer; 