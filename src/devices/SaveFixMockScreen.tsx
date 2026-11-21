import React from "react";
import {
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Wallet,
  Sparkles,
  PieChart,
  Bell,
  ArrowDownLeft,
  ChevronRight,
} from "lucide-react";
import { interpolate } from "remotion";
import { FONT_FAMILIES } from "../typography/fonts";

export interface SaveFixMockScreenProps {
  mode: "splash" | "dashboard";
  transitionProgress?: number; // 0 (splash) -> 1 (dashboard)
}

/**
 * SaveFixMockScreen — High-fidelity Apple Design Award caliber mobile UI
 * Designed specifically for 19.5:9 Super Retina XDR displays.
 */
export const SaveFixMockScreen: React.FC<SaveFixMockScreenProps> = ({
  transitionProgress = 1,
}) => {
  const splashOpacity = interpolate(transitionProgress, [0, 0.45], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dashOpacity = interpolate(transitionProgress, [0.45, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dashScale = interpolate(transitionProgress, [0.45, 1], [0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="relative w-full h-full bg-[#07090E] text-white overflow-hidden flex flex-col justify-between select-none"
      style={{
        fontFamily: FONT_FAMILIES.sans,
      }}
    >
      {/* Background ambient mesh gradient (Zero-cost radial gradients without CSS blur filters) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-24 -left-20 w-80 h-80 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-1/3 -right-24 w-72 h-72 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(6, 182, 212, 0.14) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-20 left-10 w-80 h-80 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ===================================================================
          STATE 1: SPLASH SCREEN (SaveFix Launch Branding)
          =================================================================== */}
      {splashOpacity > 0 && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-8 z-20 pointer-events-none"
          style={{
            opacity: splashOpacity,
            transform: `scale(${interpolate(transitionProgress, [0, 0.5], [1, 1.08])})`,
          }}
        >
          {/* Glowing SaveFix Logo Icon */}
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-emerald-500 to-cyan-400 blur-xl opacity-50 scale-110" />
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-[#121926] to-[#0A0D14] border border-white/20 shadow-2xl flex items-center justify-center">
              <ShieldCheck className="w-12 h-12 text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
              <div className="absolute top-2 right-2">
                <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Typography */}
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2 flex items-center gap-1.5">
            Save<span className="text-emerald-400">Fix</span>
          </h1>
          <p className="text-xs uppercase tracking-[0.25em] text-white/50 font-medium">
            Automated Wealth Engine
          </p>

          <div className="mt-12 flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/10 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] font-mono text-white/70">Connecting Secure Enclave</span>
          </div>
        </div>
      )}

      {/* ===================================================================
          STATE 2: DASHBOARD SCREEN (Active App State)
          =================================================================== */}
      <div
        className="relative w-full h-full pt-14 pb-8 px-5 flex flex-col justify-between z-10"
        style={{
          opacity: dashOpacity,
          transform: `scale(${dashScale})`,
        }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-400 to-cyan-500 p-[1.5px]">
              <div className="w-full h-full rounded-full bg-[#0D111A] flex items-center justify-center">
                <span className="text-xs font-bold text-white">AK</span>
              </div>
            </div>
            <div>
              <p className="text-[11px] text-white/50 font-medium leading-none mb-0.5">Welcome back</p>
              <h2 className="text-sm font-semibold text-white leading-none">Alex Karev</h2>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center">
            <Bell className="w-4 h-4 text-white/80" />
          </div>
        </div>

        {/* Hero Balance Card */}
        <div className="rounded-3xl p-5 bg-gradient-to-b from-white/[0.10] to-white/[0.03] border border-white/[0.14] shadow-xl relative overflow-hidden backdrop-blur-md mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-white/60">Total Vault Balance</span>
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3 h-3" />
              <span>+18.4%</span>
            </div>
          </div>

          <div className="flex items-baseline gap-1 mb-4">
            <span className="text-3xl font-extrabold tracking-tight text-white font-mono">$48,920</span>
            <span className="text-lg font-bold text-white/50 font-mono">.40</span>
          </div>

          {/* Mini Sparkline Bar Chart */}
          <div className="h-10 w-full flex items-end gap-1.5 pt-2 border-t border-white/[0.08]">
            {[35, 45, 40, 60, 55, 75, 70, 85, 80, 95, 90, 100].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm transition-all"
                style={{
                  height: `${h}%`,
                  background:
                    i >= 8
                      ? "linear-gradient(to top, #10B981, #34D399)"
                      : "rgba(255, 255, 255, 0.15)",
                }}
              />
            ))}
          </div>
        </div>

        {/* Quick Action Matrix */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: "Deposit", icon: ArrowDownLeft, color: "text-emerald-400" },
            { label: "Invest", icon: ArrowUpRight, color: "text-cyan-400" },
            { label: "Vaults", icon: Wallet, color: "text-blue-400" },
            { label: "Analytics", icon: PieChart, color: "text-purple-400" },
          ].map((action, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-white/[0.05] border border-white/[0.08]"
            >
              <div className="w-9 h-9 rounded-xl bg-white/[0.08] flex items-center justify-center">
                <action.icon className={`w-4 h-4 ${action.color}`} />
              </div>
              <span className="text-[10px] font-medium text-white/70">{action.label}</span>
            </div>
          ))}
        </div>

        {/* Smart Auto-Stash Banner */}
        <div className="rounded-2xl p-3 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Smart Auto-Save Active</p>
              <p className="text-[10px] text-emerald-300/80">$450 stashed this week automatically</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-400/60" />
        </div>

        {/* Recent Transactions */}
        <div className="flex-1 flex flex-col justify-start">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white/80">Recent Activity</span>
            <span className="text-[10px] text-emerald-400 font-medium">See All</span>
          </div>

          <div className="space-y-2">
            {[
              { name: "Apple Services", date: "Today, 9:24 AM", amount: "-$14.99", gain: false },
              { name: "Salary Direct Deposit", date: "Yesterday", amount: "+$3,450.00", gain: true },
              { name: "Crypto Yield Payout", date: "Nov 19", amount: "+$84.20", gain: true },
            ].map((tx, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]"
              >
                <div>
                  <p className="text-xs font-medium text-white">{tx.name}</p>
                  <p className="text-[10px] text-white/40">{tx.date}</p>
                </div>
                <span
                  className={`text-xs font-semibold font-mono ${
                    tx.gain ? "text-emerald-400" : "text-white/80"
                  }`}
                >
                  {tx.amount}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Tab Bar */}
        <div className="mt-2 pt-2 border-t border-white/[0.08] flex items-center justify-around text-white/40">
          <div className="flex flex-col items-center gap-0.5 text-emerald-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mb-0.5" />
            <span className="text-[9px] font-semibold">Home</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <Wallet className="w-4 h-4" />
            <span className="text-[9px] font-medium">Vaults</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <PieChart className="w-4 h-4" />
            <span className="text-[9px] font-medium">Analytics</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[9px] font-medium">Security</span>
          </div>
        </div>
      </div>
    </div>
  );
};
