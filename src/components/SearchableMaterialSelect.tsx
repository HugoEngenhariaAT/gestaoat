import React, { useEffect, useState, useRef } from 'react';
import { Search } from 'lucide-react';
import { Material } from '../types';
import { cn } from '../lib/utils';

interface SearchableMaterialSelectProps {
  value: string;
  onChange: (id: string) => void;
  materials: Material[];
  required?: boolean;
  placeholder?: string;
}

export default function SearchableMaterialSelect({
  value,
  onChange,
  materials,
  required,
  placeholder = "Selecione..."
}: SearchableMaterialSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedMaterial = materials.find((m) => m.id === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredMaterials = materials.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      {required && (
        <select
          className="opacity-0 h-0 w-0 absolute pointer-events-none"
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{placeholder}</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}

      <div
        className={cn(
          "w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl flex justify-between items-center cursor-pointer select-none",
          isOpen ? "ring-2 ring-neutral-900 outline-none" : "hover:border-neutral-300"
        )}
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch('');
        }}
      >
        <span className={cn("truncate pr-2", selectedMaterial ? "text-neutral-900 font-medium" : "text-neutral-500")}>
          {selectedMaterial
            ? `${selectedMaterial.name} (${selectedMaterial.stock_quantity} ${selectedMaterial.unit})`
            : placeholder}
        </span>
        <svg
          className={cn("w-4 h-4 text-neutral-500 transition-transform shrink-0", isOpen && "rotate-180")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </div>

      {isOpen && (
        <div className="absolute z-[70] w-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-xl max-h-60 flex flex-col">
          <div className="p-2 border-b border-neutral-100 shrink-0 sticky top-0 bg-white rounded-t-xl z-10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
              <input
                type="text"
                autoFocus
                className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 text-sm text-neutral-900"
                placeholder="Pesquisar material..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="overflow-y-auto p-1 flex-1">
            {filteredMaterials.length > 0 ? (
              filteredMaterials.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "px-4 py-2 hover:bg-neutral-50 cursor-pointer rounded-lg text-sm transition-colors text-left",
                    value === m.id ? "bg-neutral-100 font-medium text-neutral-900" : "text-neutral-700"
                  )}
                  onClick={() => {
                    onChange(m.id);
                    setIsOpen(false);
                  }}
                >
                  {m.name} <span className="text-neutral-400 text-xs ml-1">({m.stock_quantity} {m.unit})</span>
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-neutral-500 text-center">
                Nenhum material encontrado
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
