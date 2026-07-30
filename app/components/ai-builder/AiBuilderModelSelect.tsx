"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type AiBuilderModelChoice = {
  id: string;
  provider: string;
  displayName: string;
  /** Retained in the server projection for compatibility; intentionally not rendered. */
  recommended: boolean;
  highUsage: boolean;
};

const providerNames: Record<string