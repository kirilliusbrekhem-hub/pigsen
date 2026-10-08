import type { Theme } from "@/types";

/**
 * Applies the signed-in user's saved theme before the page paints and remembers it for the root layout's
 * boot script (which runs on every page without a DB lookup).
 */
export function ThemeScript({ theme }: { theme: Theme }) {
  const t = JSON.stringify(theme);
  const js = `try{var t=${t},d=document.documentElement;if(t==="system")d.removeAttribute("data-theme");else d.setAttribute("data-theme",t);localStorage.setItem("pigsen-theme",t)}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
