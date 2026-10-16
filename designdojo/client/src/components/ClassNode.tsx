import React from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { ClassDefinition } from '../types/domain';

export const ClassNode: React.FC<NodeProps> = ({ data, selected }) => {
  const cls = data.classDef as ClassDefinition;

  const badgeColors: Record<string, string> = {
    class: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    interface: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    abstract: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  };

  const isHighlighted = Boolean(data.highlighted);

  return (
    <>
      <NodeResizer
        isVisible={Boolean(selected)}
        minWidth={200}
        minHeight={100}
        onResizeEnd={(_e, params) => {
          if (data.onResize && typeof data.onResize === 'function') {
            (data.onResize as (id: string, w: number, h: number) => void)(cls.id, params.width, params.height);
          }
        }}
        handleClassName="!w-2 !h-2 !bg-indigo-500 !border !border-white !rounded-sm"
        lineClassName="!border-indigo-400 !border-dashed"
      />
      <div
        style={{
          width: cls.layout?.width || 220,
          minHeight: cls.layout?.height || 120,
          transform: cls.layout?.rotation ? `rotate(${cls.layout.rotation}deg)` : undefined,
        }}
        className={`rounded-lg bg-slate-900/95 backdrop-blur border transition-all shadow-xl text-xs font-mono ${
          isHighlighted
            ? 'border-rose-500 ring-2 ring-rose-500/50'
            : selected
            ? 'border-indigo-400 ring-2 ring-indigo-500/40'
            : 'border-slate-700 hover:border-slate-500'
        }`}
      >
        <Handle type="target" position={Position.Top} id="top" className="!bg-indigo-400 !w-2.5 !h-2.5" />
        <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-indigo-400 !w-2.5 !h-2.5" />
        <Handle type="target" position={Position.Left} id="left" className="!bg-indigo-400 !w-2.5 !h-2.5" />
        <Handle type="source" position={Position.Right} id="right" className="!bg-indigo-400 !w-2.5 !h-2.5" />

        <div className="px-3 py-2 border-b border-slate-800 bg-slate-950/60 rounded-t-lg flex items-center justify-between gap-2">
          <div>
            {cls.kind !== 'class' && (
              <div className="text-[10px] text-slate-400 italic leading-tight">
                &lt;&lt;{cls.kind}&gt;&gt;
              </div>
            )}
            <div className="font-bold text-slate-100 text-sm tracking-tight">{cls.name}</div>
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase ${badgeColors[cls.kind]}`}>
            {cls.kind}
          </span>
        </div>

        <div className="px-3 py-1.5 border-b border-slate-800/80 space-y-1 min-h-[28px]">
          {cls.attributes.length === 0 ? (
            <div className="text-[10px] text-slate-600 italic">No attributes</div>
          ) : (
            cls.attributes.map((attr) => (
              <div key={attr.id} className="text-slate-300 flex items-center gap-1 truncate">
                <span className="text-indigo-400 font-bold">{attr.visibility}</span>
                <span>{attr.name || '(unnamed)'}:</span>
                {attr.type ? (
                  <span className="text-amber-300">{attr.type}</span>
                ) : (
                  <span className="text-rose-400 font-bold bg-rose-950/60 px-1 rounded text-[10px] border border-rose-500/40">
                    missing type
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        <div className="px-3 py-1.5 space-y-1 min-h-[28px]">
          {cls.methods.length === 0 ? (
            <div className="text-[10px] text-slate-600 italic">No methods</div>
          ) : (
            cls.methods.map((m) => (
              <div key={m.id} className="text-slate-200 flex items-center gap-1 truncate">
                <span className="text-emerald-400 font-bold">{m.visibility}</span>
                <span>
                  {m.name || '(unnamed)'}(
                  {m.parameters.map((p, pIdx) => (
                    <span key={pIdx}>
                      {pIdx > 0 ? ', ' : ''}
                      {p.name}:{' '}
                      {p.type ? (
                        <span className="text-amber-300">{p.type}</span>
                      ) : (
                        <span className="text-rose-400 font-bold underline">?type</span>
                      )}
                    </span>
                  ))}
                  ):
                </span>
                {m.returnType ? (
                  <span className="text-sky-300">{m.returnType}</span>
                ) : (
                  <span className="text-rose-400 font-bold bg-rose-950/60 px-1 rounded text-[10px] border border-rose-500/40">
                    missing returnType
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
