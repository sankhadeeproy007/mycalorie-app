"use client";

import { useRef, type ChangeEvent } from "react";

/** A hidden image input and a `pick` that opens it; must be called from a tap so iOS shows the picker. */
export function usePhotoPicker(onPhoto: (file: File) => void) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onPhoto(file);
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="visually-hidden"
      tabIndex={-1}
      aria-hidden="true"
      onChange={onChange}
    />
  );

  return { input, pick: () => inputRef.current?.click() };
}
