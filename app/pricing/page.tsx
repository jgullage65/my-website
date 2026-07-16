import Link from "next/link";

export const metadata = {
  title: "Pricing",
};

type PriceOption = {
  title: string;
  price: string;
  description: string;
  details: readonly string[];
  badge?: string;
};

type PricingSection = {
  eyebrow: string;
  title: string;
  description: string;
  options: readonly PriceOption[];
  note?: string;
};

const pricingSections: readonly PricingSection[] = [
  {
    eyebrow: "Websites",
    title: "A clear