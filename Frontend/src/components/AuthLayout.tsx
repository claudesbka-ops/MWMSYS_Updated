import { ReactNode, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AnimatePresence, motion } from "framer-motion";

export default function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const [language, setLanguage] = useState("en");
  const valueProps = useMemo(
    () => [
      "Trusted by 50+ Embassies",
      "Live Panic Response in Minutes",
      "Audit-Ready Compliance Records",
      "Cross-Agency Incident Collaboration",
    ],
    [],
  );
  const [valuePropIndex, setValuePropIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setValuePropIndex((p) => (p + 1) % valueProps.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [valueProps.length]);

  return (
    <div className="min-h-screen bg-background grid grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(215,28%,15%)] via-[hsl(215,30%,12%)] to-[hsl(187,78%,18%)]" />
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_55%)]" />
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -bottom-52 -right-40 w-[28rem] h-[28rem] rounded-full bg-[hsl(38_92%_50%)]/15 blur-3xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/10">
              <span className="text-white font-bold text-sm">MW</span>
            </div>
            <div>
              <div className="text-white font-bold tracking-tight">MWMSYS</div>
              <div className="text-white/70 text-xs">Migrant Worker Assistance</div>
            </div>
          </div>

          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-[120px] bg-white/10 border-white/15 text-white">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ms">Malay</SelectItem>
              <SelectItem value="bn">Bangla</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative z-10 animate-in fade-in slide-in-from-bottom-3 duration-700">
          <h1 className="text-4xl font-bold text-white tracking-tight leading-tight max-w-xl">
            Safety-first assistance, built for enterprise collaboration.
          </h1>
          <div className="mt-4 max-w-xl">
            <AnimatePresence mode="wait">
              <motion.p
                key={valuePropIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="text-white/90 text-sm font-semibold tracking-wide"
              >
                {valueProps[valuePropIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
          <p className="text-white/70 mt-4 max-w-xl">
            Secure workflows for agencies, employers, embassies and labour departments — with real-time incident response.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 max-w-xl">
            {[
              { k: "Real-time", v: "Panic alerts + response" },
              { k: "Compliance", v: "Audit-ready records" },
              { k: "International", v: "Cross-border visibility" },
              { k: "Support", v: "AI + human handover" },
            ].map((x) => (
              <div key={x.k} className="rounded-2xl bg-white/10 border border-white/10 p-4 backdrop-blur">
                <div className="text-white font-semibold text-sm">{x.k}</div>
                <div className="text-white/70 text-xs mt-1">{x.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-white/60 text-xs">
          © {new Date().getFullYear()} MWMSYS
        </div>
      </div>

      <div className="flex flex-col min-h-screen">
        <div className="sticky top-0 z-10 bg-background/55 backdrop-blur-xl border-b border-border/60">
          <div className="h-14 px-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-border/60">
                <span className="text-primary font-bold text-xs">MW</span>
              </div>
              <div className="font-bold tracking-tight">MWMSYS</div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ms">Malay</SelectItem>
                  <SelectItem value="bn">Bangla</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                Support
              </Button>
            </div>
          </div>
        </div>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-primary/40 via-foreground/10 to-warning/30 shadow-2xl shadow-foreground/[0.08]">
              <div className="rounded-3xl glass-surface premium-ring p-6">
                <div className="mb-6">
                  <div className="text-2xl font-bold tracking-tight">{title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>
                </div>
                {children}
              </div>
            </div>
          </div>
        </main>

        <footer className="border-t border-border/60 bg-background/55 backdrop-blur-xl">
          <div className="px-6 py-4 text-xs text-muted-foreground flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center sm:justify-between">
            <div>Premium Enterprise Demo</div>
            <div className="flex gap-4">
              <a className="hover:text-foreground transition-colors" href="#">Privacy</a>
              <a className="hover:text-foreground transition-colors" href="#">Terms</a>
              <a className="hover:text-foreground transition-colors" href="#">Support</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
