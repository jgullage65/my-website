"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import type { ReactNode } from "react";

const portraitUrl = "https://i.postimg.cc/X7yd2PHq/9596D79E-9880-4FC7-9AD1-F44BDCDF2544-(1).jpg";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: