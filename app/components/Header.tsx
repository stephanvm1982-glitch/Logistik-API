import React from 'react';
import { Package, Search } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3">
          <Package size={32} />
          <div>
            <h1 className="text-3xl font-bold">Vrachtbeheer</h1>
            <p className="text-blue-100 text-sm">Ecuador & Colombia</p>
          </div>
        </div>
      </div>
    </header>
  );
}
