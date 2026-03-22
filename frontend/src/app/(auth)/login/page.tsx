"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Phone, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

const phoneSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
});
const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type OTPForm = z.infer<typeof otpSchema>;

// ── Dashboard SVG Illustration ────────────────────────────────────────────────
// Rule: never put filter + clipPath on the same element — they create separate
// compositing layers and the clip breaks. Instead: shadow goes on a plain <rect>,
// clipped content goes in a sibling <g clipPath="...">.
function DashboardIllustration() {
  const G = "#4d8731";
  const GL = "#6db83e";
  const GOLD = "#D4A853";
  const INDIGO = "#818cf8";
  const BLUE = "#60a5fa";
  const BD = "rgba(255,255,255,0.1)";
  const CARD = "rgba(255,255,255,0.055)";
  const T = "rgba(255,255,255,0.88)";
  const M = "rgba(255,255,255,0.38)";
  const F = "system-ui,-apple-system,sans-serif";

  // 5-bar chart (cleaner than 7)
  const bars = [
    { h: 48, lbl: "Mon" },
    { h: 72, lbl: "Tue" },
    { h: 38, lbl: "Wed" },
    { h: 88, lbl: "Thu", peak: true },
    { h: 60, lbl: "Fri" },
  ];
  // bar geometry — all within main card inner x: 74..408
  const BB = 284; // bar baseline y
  const BX0 = 86; // first bar x
  const BST = 60; // step between bars
  const BW = 34; // bar width

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.7, ease: "easeOut" }}
      className="w-full flex items-center justify-center"
    >
      <svg
        viewBox="0 0 480 430"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-[440px]"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="lgG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GL} />
            <stop offset="100%" stopColor={G} />
          </linearGradient>
          <linearGradient id="lgD" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
          </linearGradient>
          <radialGradient id="rGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={G} stopOpacity="0.14" />
            <stop offset="100%" stopColor={G} stopOpacity="0" />
          </radialGradient>

          {/* Drop shadows */}
          <filter id="fMain" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="6"
              stdDeviation="12"
              floodColor="#000"
              floodOpacity="0.45"
            />
          </filter>
          <filter id="fCard" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow
              dx="0"
              dy="4"
              stdDeviation="8"
              floodColor="#000"
              floodOpacity="0.38"
            />
          </filter>

          {/* ClipPaths — one per card so content never bleeds out */}
          <clipPath id="cpMain">
            <rect x="62" y="92" width="356" height="256" rx="14" />
          </clipPath>
          <clipPath id="cpHR">
            {" "}
            <rect x="4" y="24" width="144" height="88" rx="12" />
          </clipPath>
          <clipPath id="cpFin">
            {" "}
            <rect x="332" y="14" width="144" height="88" rx="12" />
          </clipPath>
          <clipPath id="cpInv">
            {" "}
            <rect x="4" y="330" width="144" height="88" rx="12" />
          </clipPath>
          <clipPath id="cpTask">
            <rect x="332" y="330" width="144" height="88" rx="12" />
          </clipPath>
        </defs>

        {/* Background glow */}
        <ellipse cx="240" cy="215" rx="230" ry="165" fill="url(#rGlow)" />

        {/* Dashed connector lines — drawn first so they sit behind cards */}
        <line
          x1="148"
          y1="68"
          x2="82"
          y2="92"
          stroke={BD}
          strokeWidth="1"
          strokeDasharray="4,3"
        />
        <line
          x1="332"
          y1="58"
          x2="398"
          y2="92"
          stroke={BD}
          strokeWidth="1"
          strokeDasharray="4,3"
        />
        <line
          x1="148"
          y1="374"
          x2="82"
          y2="348"
          stroke={BD}
          strokeWidth="1"
          strokeDasharray="4,3"
        />
        <line
          x1="332"
          y1="374"
          x2="398"
          y2="348"
          stroke={BD}
          strokeWidth="1"
          strokeDasharray="4,3"
        />

        {/* ━━━━ MAIN DASHBOARD CARD ━━━━ */}
        <motion.g
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.6, ease: "easeOut" }}
        >
          {/* Shadow on rect, NOT on the group — keeps clipPath working */}
          <rect
            x="62"
            y="92"
            width="356"
            height="256"
            rx="14"
            fill={CARD}
            stroke={BD}
            strokeWidth="1"
            filter="url(#fMain)"
          />
          <g clipPath="url(#cpMain)">
            {/* Chrome dots */}
            <circle cx="80" cy="112" r="4" fill="rgba(255,70,70,0.55)" />
            <circle cx="94" cy="112" r="4" fill="rgba(255,175,0,0.55)" />
            <circle cx="108" cy="112" r="4" fill="rgba(60,210,90,0.55)" />
            <text
              x="122"
              y="117"
              fill={T}
              fontSize="8"
              fontWeight="600"
              fontFamily={F}
            >
              Dashboard
            </text>

            {/* Live badge */}
            <rect
              x="368"
              y="104"
              width="38"
              height="16"
              rx="8"
              fill={G}
              fillOpacity="0.2"
            />
            <circle cx="377" cy="112" r="3" fill={GL}>
              <animate
                attributeName="opacity"
                values="1;0.3;1"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </circle>
            <text
              x="383"
              y="116"
              fill={GL}
              fontSize="7"
              fontWeight="600"
              fontFamily={F}
            >
              LIVE
            </text>

            {/* Header divider */}
            <line
              x1="62"
              y1="126"
              x2="418"
              y2="126"
              stroke={BD}
              strokeWidth="1"
            />

            {/* ── KPI boxes (3 equal columns) ── */}
            {/* Box 1 — Revenue: x=74, w=100 */}
            <rect
              x="74"
              y="134"
              width="100"
              height="52"
              rx="7"
              fill="rgba(255,255,255,0.04)"
              stroke={BD}
              strokeWidth="1"
            />
            <text x="83" y="150" fill={M} fontSize="7" fontFamily={F}>
              Revenue
            </text>
            <text
              x="83"
              y="167"
              fill={GOLD}
              fontSize="15"
              fontWeight="700"
              fontFamily={F}
            >
              ₹4.2L
            </text>
            <text x="83" y="180" fill="#4ade80" fontSize="6.5" fontFamily={F}>
              ↑ 12% MoM
            </text>

            {/* Box 2 — Staff: x=184, w=100 */}
            <rect
              x="184"
              y="134"
              width="100"
              height="52"
              rx="7"
              fill="rgba(255,255,255,0.04)"
              stroke={BD}
              strokeWidth="1"
            />
            <text x="193" y="150" fill={M} fontSize="7" fontFamily={F}>
              Employees
            </text>
            <text
              x="193"
              y="167"
              fill={T}
              fontSize="15"
              fontWeight="700"
              fontFamily={F}
            >
              12
            </text>
            <text x="193" y="180" fill={M} fontSize="6.5" fontFamily={F}>
              5 present today
            </text>

            {/* Box 3 — Tasks: x=294, w=112 */}
            <rect
              x="294"
              y="134"
              width="112"
              height="52"
              rx="7"
              fill="rgba(255,255,255,0.04)"
              stroke={BD}
              strokeWidth="1"
            />
            <text x="303" y="150" fill={M} fontSize="7" fontFamily={F}>
              Open Tasks
            </text>
            <text
              x="303"
              y="167"
              fill={T}
              fontSize="15"
              fontWeight="700"
              fontFamily={F}
            >
              24
            </text>
            <text x="303" y="180" fill={GL} fontSize="6.5" fontFamily={F}>
              8 due today
            </text>

            {/* ── Bar chart ── */}
            <text x="74" y="204" fill={M} fontSize="7" fontFamily={F}>
              Weekly Production
            </text>

            {/* Horizontal grid */}
            {[0.35, 0.7, 1].map((f, i) => (
              <line
                key={i}
                x1="74"
                y1={BB - f * 82}
                x2="406"
                y2={BB - f * 82}
                stroke={BD}
                strokeWidth="0.5"
                strokeDasharray="3,3"
              />
            ))}

            {/* Bars */}
            {bars.map(({ h, lbl, peak }, i) => {
              const bx = BX0 + i * BST;
              const by = BB - h;
              return (
                <g key={lbl}>
                  <motion.rect
                    x={bx}
                    y={by}
                    width={BW}
                    height={h}
                    rx="5"
                    fill={peak ? "url(#lgG)" : "url(#lgD)"}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 + i * 0.08, duration: 0.4 }}
                  />
                  {peak && (
                    <text
                      x={bx + BW / 2}
                      y={by - 5}
                      fill={GL}
                      fontSize="6"
                      fontWeight="600"
                      fontFamily={F}
                      textAnchor="middle"
                    >
                      Peak
                    </text>
                  )}
                  <text
                    x={bx + BW / 2}
                    y={BB + 12}
                    fill={M}
                    fontSize="6.5"
                    fontFamily={F}
                    textAnchor="middle"
                  >
                    {lbl}
                  </text>
                </g>
              );
            })}

            {/* Revenue sparkline */}
            <text x="74" y="316" fill={M} fontSize="6.5" fontFamily={F}>
              Revenue trend
            </text>
            <polyline
              points="74,330 120,323 168,326 216,315 264,319 312,308 360,311 400,302"
              stroke={G}
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="400" cy="302" r="3" fill={G} />
            <circle cx="400" cy="302" r="5.5" fill={G} fillOpacity="0.22">
              <animate
                attributeName="r"
                values="4;7;4"
                dur="2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.3;0;0.3"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
            <text x="404" y="306" fill={GL} fontSize="6.5" fontFamily={F}>
              Now
            </text>
          </g>
        </motion.g>

        {/* ━━━━ HR CARD — top left ━━━━ */}
        <motion.g
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.5 }}
        >
          <rect
            x="4"
            y="24"
            width="144"
            height="88"
            rx="12"
            fill={CARD}
            stroke={BD}
            strokeWidth="1"
            filter="url(#fCard)"
          />
          <g clipPath="url(#cpHR)">
            {/* Icon — Lucide Users */}
            <rect
              x="14"
              y="35"
              width="24"
              height="24"
              rx="6"
              fill={G}
              fillOpacity="0.18"
            />
            <g
              transform="translate(14,35)"
              stroke={GL}
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </g>
            {/* Text */}
            <text
              x="44"
              y="46"
              fill={T}
              fontSize="8"
              fontWeight="600"
              fontFamily={F}
            >
              HR & Attendance
            </text>
            <text x="44" y="58" fill={M} fontSize="6.5" fontFamily={F}>
              12 Employees
            </text>
            {/* Attendance dots */}
            <text
              x="14"
              y="78"
              fill={M}
              fontSize="6"
              fontFamily={F}
              letterSpacing="0.4"
            >
              PRESENT TODAY
            </text>
            {Array.from({ length: 7 }).map((_, j) => (
              <motion.circle
                key={j}
                cx={14 + j * 14}
                cy={92}
                r={4.5}
                fill={j < 5 ? G : "rgba(255,255,255,0.1)"}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.48 + j * 0.05 }}
              />
            ))}
            <text x="114" y="96" fill={GL} fontSize="6.5" fontFamily={F}>
              5 / 7
            </text>
          </g>
        </motion.g>

        {/* ━━━━ FINANCE CARD — top right ━━━━ */}
        <motion.g
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.52, duration: 0.5 }}
        >
          <rect
            x="332"
            y="14"
            width="144"
            height="88"
            rx="12"
            fill={CARD}
            stroke={BD}
            strokeWidth="1"
            filter="url(#fCard)"
          />
          <g clipPath="url(#cpFin)">
            {/* Icon — Lucide IndianRupee */}
            <rect
              x="342"
              y="24"
              width="24"
              height="24"
              rx="6"
              fill={GOLD}
              fillOpacity="0.18"
            />
            <g
              transform="translate(342,24)"
              stroke={GOLD}
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 3h12" />
              <path d="M6 8h12" />
              <path d="M6 13l8.5 8" />
              <path d="M6 13h3" />
              <path d="M9 13c6.667 0 6.667-10 0-10" />
            </g>
            {/* Text */}
            <text
              x="372"
              y="34"
              fill={T}
              fontSize="8"
              fontWeight="600"
              fontFamily={F}
            >
              Finance
            </text>
            <text x="372" y="46" fill={M} fontSize="6.5" fontFamily={F}>
              Revenue & GST
            </text>
            {/* Value row */}
            <text
              x="342"
              y="68"
              fill={GOLD}
              fontSize="14"
              fontWeight="700"
              fontFamily={F}
            >
              ₹4.2L
            </text>
            <text x="392" y="68" fill="#4ade80" fontSize="7.5" fontFamily={F}>
              ↑ 12%
            </text>
            {/* Trend line — clipped to card */}
            <polyline
              points="342,88 360,82 374,84 390,76 408,79 424,71 462,65"
              stroke={GOLD}
              strokeWidth="1.3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.6"
            />
          </g>
        </motion.g>

        {/* ━━━━ INVENTORY CARD — bottom left ━━━━ */}
        <motion.g
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.62, duration: 0.5 }}
        >
          <rect
            x="4"
            y="330"
            width="144"
            height="88"
            rx="12"
            fill={CARD}
            stroke={BD}
            strokeWidth="1"
            filter="url(#fCard)"
          />
          <g clipPath="url(#cpInv)">
            {/* Icon — Lucide Package */}
            <rect
              x="14"
              y="340"
              width="24"
              height="24"
              rx="6"
              fill={INDIGO}
              fillOpacity="0.18"
            />
            <g
              transform="translate(14,340)"
              stroke={INDIGO}
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </g>
            {/* Text */}
            <text
              x="44"
              y="352"
              fill={T}
              fontSize="8"
              fontWeight="600"
              fontFamily={F}
            >
              Inventory
            </text>
            <text x="44" y="364" fill={M} fontSize="6.5" fontFamily={F}>
              847 SKUs
            </text>
            {/* Category bars — label + track + fill, all within x:14..138 */}
            {[
              { lbl: "Serums", pct: 82, c: G },
              { lbl: "Creams", pct: 55, c: BLUE },
              { lbl: "Masks", pct: 38, c: GOLD },
            ].map(({ lbl, pct, c }, i) => (
              <g key={lbl}>
                <text
                  x="14"
                  y={381 + i * 13}
                  fill={M}
                  fontSize="6"
                  fontFamily={F}
                >
                  {lbl}
                </text>
                <rect
                  x="52"
                  y={374 + i * 13}
                  width="80"
                  height="5"
                  rx="2.5"
                  fill="rgba(255,255,255,0.08)"
                />
                <motion.rect
                  x="52"
                  y={374 + i * 13}
                  width={0}
                  height="5"
                  rx="2.5"
                  fill={c}
                  opacity="0.75"
                  animate={{ width: (80 * pct) / 100 }}
                  transition={{
                    delay: 0.75 + i * 0.1,
                    duration: 0.55,
                    ease: "easeOut",
                  }}
                />
              </g>
            ))}
          </g>
        </motion.g>

        {/* ━━━━ TASKS CARD — bottom right ━━━━ */}
        <motion.g
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72, duration: 0.5 }}
        >
          <rect
            x="332"
            y="330"
            width="144"
            height="88"
            rx="12"
            fill={CARD}
            stroke={BD}
            strokeWidth="1"
            filter="url(#fCard)"
          />
          <g clipPath="url(#cpTask)">
            {/* Icon — Lucide CheckSquare */}
            <rect
              x="342"
              y="340"
              width="24"
              height="24"
              rx="6"
              fill={BLUE}
              fillOpacity="0.18"
            />
            <g
              transform="translate(342,340)"
              stroke={BLUE}
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </g>
            {/* Text */}
            <text
              x="372"
              y="352"
              fill={T}
              fontSize="8"
              fontWeight="600"
              fontFamily={F}
            >
              Tasks
            </text>
            <text x="372" y="364" fill={M} fontSize="6.5" fontFamily={F}>
              8 / 12 done
            </text>
            {/* Progress bar */}
            <rect
              x="342"
              y="373"
              width="126"
              height="5"
              rx="2.5"
              fill="rgba(255,255,255,0.08)"
            />
            <motion.rect
              x="342"
              y="373"
              width={0}
              height="5"
              rx="2.5"
              fill={G}
              opacity="0.85"
              animate={{ width: (126 * 8) / 12 }}
              transition={{ delay: 0.85, duration: 0.65, ease: "easeOut" }}
            />
            {/* Task items */}
            {[
              { txt: "Report review", done: true },
              { txt: "Payroll run", done: false },
            ].map(({ txt, done }, i) => (
              <g key={txt}>
                <rect
                  x="342"
                  y={384 + i * 13}
                  width="9"
                  height="9"
                  rx="2"
                  fill={done ? G : "rgba(255,255,255,0.08)"}
                  stroke={done ? G : BD}
                  strokeWidth="1"
                />
                {done && (
                  <path
                    d={`M344 ${388.5 + i * 13} L346.5 ${391 + i * 13} L350 ${386 + i * 13}`}
                    stroke="white"
                    strokeWidth="1.2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                <text
                  x="355"
                  y={393 + i * 13}
                  fill={done ? M : T}
                  fontSize="6.8"
                  fontFamily={F}
                >
                  {txt}
                </text>
              </g>
            ))}
          </g>
        </motion.g>

        {/* Connector endpoint dots */}
        {[
          { cx: 148, cy: 68, fill: G },
          { cx: 82, cy: 92, fill: G },
          { cx: 332, cy: 58, fill: GOLD },
          { cx: 398, cy: 92, fill: GOLD },
          { cx: 148, cy: 374, fill: INDIGO },
          { cx: 82, cy: 348, fill: INDIGO },
          { cx: 332, cy: 374, fill: BLUE },
          { cx: 398, cy: 348, fill: BLUE },
        ].map((d, i) => (
          <circle
            key={i}
            cx={d.cx}
            cy={d.cy}
            r="2.5"
            fill={d.fill}
            opacity="0.5"
          />
        ))}
      </svg>
    </motion.div>
  );
}

// ── Login Page ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated } = useAuthStore();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, router]);

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });
  const otpForm = useForm<OTPForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  async function onSendOtp({ phone: p }: PhoneForm) {
    setLoading(true);
    try {
      const res = await api.auth.sendOtp(p);
      setPhone(p);

      // OTP returned directly (no SMS service) — auto-fill and auto-login
      if (res.otp) {
        otpForm.setValue("otp", res.otp);
        setStep("otp");
        toast.success("Signing you in…");
        try {
          const loginRes = await api.auth.verifyOtp(p, res.otp);
          setAuth(loginRes.employee, loginRes.access_token);
          toast.success(`Welcome back, ${loginRes.employee.name}!`);
          router.push("/dashboard");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Auto-login failed");
        }
        return;
      }

      setStep("otp");
      toast.success("OTP sent to your mobile number");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyOtp({ otp }: OTPForm) {
    setLoading(true);
    try {
      const res = await api.auth.verifyOtp(phone, otp);
      setAuth(res.employee, res.access_token);
      toast.success(`Welcome back, ${res.employee.name}!`);
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left Panel ── */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 bg-[#0d0d0f] relative overflow-hidden flex-col justify-between p-10"
      >
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <Image
            src="/logo.png"
            alt="Backero Private Limited"
            width={140}
            height={40}
            className="object-contain brightness-0 invert"
            priority
          />
          <p className="text-white/35 text-xs mt-1 tracking-wide">
            Company Operating System
          </p>
        </div>

        {/* Illustration */}
        <div className="relative z-10 flex-1 flex items-center justify-center py-4">
          <DashboardIllustration />
        </div>

        {/* Footer tagline */}
        <div className="relative z-10 space-y-3">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-white/55 text-sm leading-relaxed"
          ></motion.p>
          <p className="text-white/20 text-xs">© 2022 Backero Pvt. Ltd.</p>
        </div>
      </motion.div>

      {/* ── Right Panel — Login Form ── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-sm space-y-8"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Image
              src="/favicon.png"
              alt="Backero"
              width={36}
              height={36}
              className="object-contain"
            />
            <Image
              src="/logo.png"
              alt="Backero Private Limited"
              width={110}
              height={32}
              className="object-contain"
            />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">Sign in</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {step === "phone"
                ? "Enter your registered mobile number"
                : `Enter the 6-digit OTP sent to +91 ${phone}`}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {step === "phone" ? (
              <motion.form
                key="phone-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={phoneForm.handleSubmit(onSendOtp)}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="phone">Mobile Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      maxLength={10}
                      placeholder="98XXXXXXXX"
                      className="pl-10"
                      {...phoneForm.register("phone")}
                    />
                  </div>
                  {phoneForm.formState.errors.phone && (
                    <p className="text-destructive text-xs">
                      {phoneForm.formState.errors.phone.message}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Send OTP
                </Button>
              </motion.form>
            ) : (
              <motion.form
                key="otp-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={otpForm.handleSubmit(onVerifyOtp)}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="otp">One-Time Password</Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="• • • • • •"
                      className="pl-10 tracking-[0.5em] text-center font-mono text-lg"
                      {...otpForm.register("otp")}
                    />
                  </div>
                  {otpForm.formState.errors.otp && (
                    <p className="text-destructive text-xs">
                      {otpForm.formState.errors.otp.message}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Verify & Sign In
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep("phone")}
                >
                  ← Change number
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="text-center text-xs text-muted-foreground">
            Only registered employees can sign in.
            <br />
            Contact admin if you need access.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
