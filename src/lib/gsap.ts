"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";

// Single registration point — import gsap from here in all fx components.
gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, CustomEase);

export { gsap, useGSAP, ScrollTrigger, SplitText, CustomEase };
