'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Shipment {
  id: string;
  status: string;
  origin: string;
  destination: string;
  date: string;
  weight: string;
}

export default function ShipmentTable() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShipments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/shipments');
      if (!response.ok) throw new Error('Failed to fetch shipments');
      const data = await response.json();
      setShipments(data.shipments || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
    const interval = setInterval(fetchShipments, 300000); // Refresh every 5 mins
    return () => clearInterval(interval);
  }, []);

  if (loading && shipments.length === 0) {
    return <div className="p-8 text-center text-gray-500">Laden...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-2">
        <AlertCircle className="text-red-600" size={20} />
        <div>
          <p className="font-semibold text-red-900">Fout</p>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Verzendingen</h2>
        <button
          onClick={fetchShipments}
          className="flex gap-2 items-center px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          <RefreshCw size={16} />
          Verversen
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Herkomst</th>
              <th className="px-4 py-3 text-left">Bestemming</th>
              <th className="px-4 py-3 text-left">Datum</th>
              <th className="px-4 py-3 text-left">Gewicht</th>
            </tr>
          </thead>
          <tbody>
            {shipments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Geen verzendingen gevonden
                </td>
              </tr>
            ) : (
              shipments.map((shipment) => (
                <tr key={shipment.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{shipment.id}</td>
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      shipment.status === 'Delivered'
                        ? 'bg-green-100 text-green-800'
                        : shipment.status === 'In Transit'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {shipment.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{shipment.origin}</td>
                  <td className="px-4 py-3">{shipment.destination}</td>
                  <td className="px-4 py-3">{shipment.date}</td>
                  <td className="px-4 py-3">{shipment.weight}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
