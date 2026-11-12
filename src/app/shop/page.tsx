import type { Metadata } from "next";
import { ShopExperience } from "@/components/shop/ShopExperience";

export const metadata: Metadata = {
  title: "Mira Eyewear boutique",
  description: "Meet Lumi, the robot stylist: a 3D eyewear boutique with an AR magic mirror and PayPal checkout.",
};

export default function ShopPage() {
  return <ShopExperience />;
}
