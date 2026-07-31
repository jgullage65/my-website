"use client";

import { useEffect, useState } from "react";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";
import AiBuilderForm from "./AiBuilderForm";
import AiBuilderWorkspaceFrame from "./AiBuilderWorkspaceFrame";
import type { BuilderState } from "./AiBuilderClient";

type Props = {
  builder: Builder