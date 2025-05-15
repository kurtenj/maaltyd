import React from 'react';

const APP_VERSION = 'v0.1.0'; // Hardcode version for now

const Footer: React.FC = () => {
  return (
    <footer className="w-full pb-4">
      <div className="container mx-auto text-center">
        <p className="text-xs text-stone-400">
          Maaltyd {APP_VERSION}
        </p>
      </div>
    </footer>
  );
};

export default Footer; 