import React from 'react';
import { Heart } from 'lucide-react';

const APP_VERSION = `v${__APP_VERSION__}`;

const Footer: React.FC = () => {
  return (
    <footer className="w-full pb-4">
      <div className="container mx-auto text-center space-y-1">
        <p className="text-xs text-stone-400 flex items-center justify-center gap-1">
          Grown in the Midwest <Heart size={12} className="text-pink-400 fill-pink-400" />
        </p>
        <p className="text-xs text-stone-400">
          Maaltyd {APP_VERSION}
        </p>
      </div>
    </footer>
  );
};

export default Footer; 