"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";

const phoneSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
});

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type OTPForm = z.infer<typeof otpSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

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
      await api.auth.sendOtp(p);
      setPhone(p);
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
      setAuth(res.employee, res.access_token, res.refresh_token);
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
      {/* Left Panel — Brand */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 bg-brand-charcoal relative overflow-hidden flex-col justify-between p-12"
      >
        {/* Decorative circles */}
        <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full bg-brand-rose/10" />
        <div className="absolute bottom-[-80px] left-[-80px] w-[300px] h-[300px] rounded-full bg-brand-gold/10" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div>
              <Image
                src="/logo.png"
                alt="Backero Private Limited"
                width={140}
                height={40}
                className="object-contain brightness-0 invert"
                priority
              />
            </div>
          </div>
          <p className="text-white/40 text-sm">Company Operating System</p>
        </div>

        <div className="relative z-10 space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-4xl font-bold text-white leading-tight"
          >
            Everything your
            <span className="text-brand-rose block">company needs,</span>
            in one place.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="text-white/60 text-base leading-relaxed max-w-sm"
          >
            HR, Finance, Inventory, Tasks, and Production — all unified for
            Backero Cosmetics.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="grid grid-cols-2 gap-3"
          >
            {[
              "HR & Attendance",
              "Finance & GST",
              "Inventory",
              "Task Management",
            ].map((f) => (
              <div
                key={f}
                className="flex items-center gap-2 text-white/50 text-sm"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-brand-rose" />
                {f}
              </div>
            ))}
          </motion.div>
        </div>

        <p className="relative z-10 text-white/25 text-xs">
          © 2025 Backero Cosmetics Pvt. Ltd.
        </p>
      </motion.div>

      {/* Right Panel — Login Form */}
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
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
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
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
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
