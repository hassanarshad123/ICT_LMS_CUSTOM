'use client';

import { useState, useEffect } from 'react';
import { isValidHex } from '@/lib/utils/color-convert';

export interface ColorPickerProps {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}

export function ColorPicker({ label, description, value, onChange }: ColorPickerProps) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  const handleTextChange = (v: string) => {
    setText(v);
    if (isValidHex(v)) {
      onChange(v.toUpperCase());
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <p className="text-xs text-gray-400 mb-2">{description}</p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
        />
        <input
          type="text"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="#1A1A1A"
          maxLength={7}
          className={`flex-1 px-3 py-2 rounded-lg border text-sm font-mono ${
            isValidHex(text) ? 'border-gray-200' : 'border-red-300'
          } focus:outline-none focus:border-primary transition-colors`}
        />
      </div>
    </div>
  );
}
