'use client';

import React, { useState } from 'react';
import Header from '../components/Header';
import ShipmentTable from '../components/ShipmentTable';
import BarcodeSearch from '../components/BarcodeSearch';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'shipments' | 'barcode'>('shipments');

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-300">
          <button
            onClick={() => setActiveTab('shipments')}
            className={`px-4 py-3 font-semibold border-b-2 transition ${
              activeTab === 'shipments'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Verzendingen
          </button>
          <button
            onClick={() => setActiveTab('barcode')}
            className={`px-4 py-3 font-semibold border-b-2 transition ${
              activeTab === 'barcode'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Barcode Search
          </button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === 'shipments' && <ShipmentTable />}
          {activeTab === 'barcode' && <BarcodeSearch />}
        </div>
      </main>
    </div>
  );
}
