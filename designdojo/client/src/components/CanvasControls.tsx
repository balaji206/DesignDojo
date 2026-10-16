import React from 'react';
import { useReactFlow, useStore } from '@xyflow/react';
import { Plus, Minus, Maximize2, RotateCcw } from 'lucide-react';

export const CanvasControls: React.FC = () => {
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const zoomPercent = Math.round((zoom || 1) * 100);

  return (
    <div className="absolute bottom-6 right-6 z-30 flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-1.5 shadow-2xl shadow-black/80 ring-1 ring-white/10">
      {/* Zoom In */}
      <button
        type="button"
        onClick={() => zoomIn({ duration: 200 })}
        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-indigo-600 active:bg-indigo-700 text-slate-100 hover:text-white transition flex items-center justify-center shadow-sm"
        title="Zoom In (+)"
        aria-label="Zoom In"
      >
        <Plus className="w-4 h-4 stroke-[2.5]" />
      </button>

      {/* Zoom percentage button - clicking resets to 100% */}
      <button
        type="button"
        onClick={() => zoomTo(1, { duration: 200 })}
        className="px-2.5 h-8 rounded-lg bg-slate-950/60 hover:bg-slate-800 text-[11px] font-mono font-bold text-indigo-300 hover:text-white transition flex items-center justify-center border border-slate-800/80"
        title="Click to reset zoom to 100%"
        aria-label="Current Zoom Percentage"
      >
        {zoomPercent}%
      </button>

      {/* Zoom Out */}
      <button
        type="button"
        onClick={() => zoomOut({ duration: 200 })}
        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-indigo-600 active:bg-indigo-700 text-slate-100 hover:text-white transition flex items-center justify-center shadow-sm"
        title="Zoom Out (-)"
        aria-label="Zoom Out"
      >
        <Minus className="w-4 h-4 stroke-[2.5]" />
      </button>

      <div className="w-px h-5 bg-slate-700/80 mx-0.5" />

      {/* Fit to View */}
      <button
        type="button"
        onClick={() => fitView({ duration: 250, padding: 0.2 })}
        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-indigo-600 active:bg-indigo-700 text-slate-100 hover:text-white transition flex items-center justify-center shadow-sm"
        title="Fit All Classes on Screen"
        aria-label="Fit View"
      >
        <Maximize2 className="w-4 h-4" />
      </button>

      {/* Reset to 100% */}
      <button
        type="button"
        onClick={() => zoomTo(1, { duration: 200 })}
        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-indigo-600 active:bg-indigo-700 text-slate-100 hover:text-white transition flex items-center justify-center shadow-sm"
        title="Reset Zoom to 100%"
        aria-label="Reset Zoom"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
