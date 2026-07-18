"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AiBuilderShell from "./AiBuilderShell";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";

type Project = {
  id: string;
  businessName: string;
  website: string | null;
  industry: string;
  status: string;
  messageCount: number;