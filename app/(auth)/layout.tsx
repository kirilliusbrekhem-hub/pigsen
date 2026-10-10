import { Brand, Rosette } from "@/components/kapital/Art";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="kp kp-auth">
      <Rosette size={620} opacity={0.4} style={{ top: -160, right: -220 }} />
      <div className="top">
        <Brand href="/" pill />
      </div>
      {children}
    </div>
  );
}
