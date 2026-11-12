"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useShop } from "@/lib/client/shopStore";
import { setMuted } from "@/lib/client/speech";
import { ConversationDock } from "./ConversationDock";
import { EnterOverlay } from "./EnterOverlay";
import { ProductCard } from "./ProductCard";
import { ShopHeader } from "./ShopHeader";

// Heavy pieces load in the browser only: WebGL, the PayPal SDK and MediaPipe.
const BoutiqueCanvas = dynamic(() => import("./scene/BoutiqueCanvas"), { ssr: false });
const BagDrawer = dynamic(() => import("./BagDrawer"), { ssr: false });
const CareDesk = dynamic(() => import("./CareDesk"), { ssr: false });
const MirrorPanel = dynamic(() => import("@/components/mirror/MirrorPanel"), { ssr: false });

export function ShopExperience() {
  const bagOpen = useShop((s) => s.bagOpen);
  const careOpen = useShop((s) => s.careOpen);
  const mirrorOpen = useShop((s) => s.mirror !== "closed");
  const muted = useShop((s) => s.muted);

  // The saved bag lives in localStorage, so restore it after hydration.
  useEffect(() => {
    void useShop.persist.rehydrate();
  }, []);

  useEffect(() => setMuted(muted), [muted]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-ink-950">
      <div className="absolute inset-0 animate-fade">
        <BoutiqueCanvas />
      </div>
      <ShopHeader />
      <ConversationDock />
      <ProductCard />
      {bagOpen && <BagDrawer />}
      {careOpen && <CareDesk />}
      {mirrorOpen && <MirrorPanel />}
      <EnterOverlay />
    </main>
  );
}
