import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-5xl flex items-center gap-3 px-4 py-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 font-bold text-sm">
            TP
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Token Prediction</h1>
            <p className="text-xs text-gray-400">Polymarket 15-min UP/DOWN predictions</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        {children}
      </main>
    </div>
  );
}
