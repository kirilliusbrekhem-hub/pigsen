"use client";
import { createContext, useContext, useEffect } from "react";

export const CrumbContext = createContext<(title: string | null) => void>(() => {});

/** Rendered by detail pages to name the current item in the top bar breadcrumbs. */
export function SetCrumb({ title }: { title: string }) {
  const set = useContext(CrumbContext);
  useEffect(() => {
    set(title);
    return () => set(null);
  }, [set, title]);
  return null;
}
