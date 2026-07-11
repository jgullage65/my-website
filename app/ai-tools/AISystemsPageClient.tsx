"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

const systems = [
  {
    id: "copilots",
    label: "AI Copilots",
    title: "Business-aware assistants that do more than answer questions.",
    copy: "Custom copilots can guide customers, support your team, qualify requests, surface the right information, and