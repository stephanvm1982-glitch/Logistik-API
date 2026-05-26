'use client';

import React, { useState } from 'react';
import { AlertCircle, Search, Copy } from 'lucide-react';

interface BarcodeResult {
  code: string;
  shipmentId: string;
  status: string;
  location: string;
}

export default function BarcodeSearch() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<BarcodeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/barcodes?code=${encodeURIComponent(code)}`);
      if (!response.ok) throw new Error('Barcode niet gevonden');
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Barcode Zoeken</h2>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Voer barcode in..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:bg-gray-400"
        >
          <Search size={16} />
          {loading ? 'Zoeken...' : 'Zoeken'}
        </button>
      </form>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-2">
          <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
          <div>
            <label className="text-sm font-semibold text-gray-600">Barcode</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 bg-white px-3 py-2 rounded border border-gray-200 font-mono">
                {result.code}
              </code>
              <button
                onClick={() => copyToClipboard(result.code)}
                className="p-2 hover:bg-white rounded transition"
              >
                <Copy size={16} className="text-green-700" />
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Verzending ID</label>
            <p className="mt-1 text-green-900 font-mono">{result.shipmentId}</p>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Status</label>
            <p className="mt-1 text-green-900">{result.status}</p>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Locatie</label>
            <p className="mt-1 text-green-900">{result.location}</p>
          </div>
          {copied && <p className="text-sm text-green-700">✓ Gekopieerd!</p>}
        </div>
      )}
    </div>
  );
}
