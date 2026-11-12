import type { Metadata } from "next";
import { OfficeExperience } from "@/components/office/OfficeExperience";

export const metadata: Metadata = {
  title: "Back office",
  description:
    "Penny, Otto and Kai run Mira Eyewear's money: a live PayPal ledger, supplier payouts after the owner's approval, and instant refunds under a clear care policy.",
};

export default function OfficePage() {
  return <OfficeExperience />;
}
