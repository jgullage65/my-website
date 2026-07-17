"use client";

import { useState, type ReactNode } from "react";
import type {
  BuilderState,
  UserKnowledge,
  WebsiteKnowledge,
} from "./AiBuilderClient";

type Props = {
  value: BuilderState;
  onChange: (value: BuilderState) => void;
  onBuild: () => void;
};

type WebsiteImportPayload = {
  ok?: boolean;
  import?: {
    businessName?: string;
    industry?: string;
    website?: string;
    productsServices?: string;
    idealCustomers?: string;
    additionalKnowledge?: string;
  };
  pages?: Array<{ url: string; title: