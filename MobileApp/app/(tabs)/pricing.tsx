import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";

import { useSubscriptionService, type SubscriptionMe } from "@/services/subscriptionService";
import { useSession } from "@/contexts/SessionContext";
import { Screen, Card, PrimaryButton, GhostButton, SectionTitle } from "@/components/ui";

type Cycle = "monthly" | "yearly";

type PlanDef = {
  key: "Free" | "Pro" | "Enterprise";
  emoji: string;
  name: string;
  tagline: string;
  monthly: number; // base price in USD
  yearly: number; // per-month-equivalent when paid annually
  rank: number;
  popular?: boolean;
  gradient: readonly [string, string, ...string[]];
  features: { included: boolean; text: string }[];
  ctaContact?: boolean;
};

const PLANS: PlanDef[] = [
  {
    key: "Free",
    emoji: "🌱",
    name: "Free",
    tagline: "Try MWMSYS — perfect to evaluate",
    monthly: 0,
    yearly: 0,
    rank: 0,
    gradient: ["#10b981", "#06b6d4"],
    features: [
      { included: true, text: "Up to 5 workers" },
      { included: true, text: "Basic attendance & leave" },
      { included: false, text: "Approve workflows" },
      { included: false, text: "Live map & alerts" },
      { included: false, text: "Priority support" },
    ],
  },
  {
    key: "Pro",
    emoji: "🚀",
    name: "Pro",
    tagline: "For growing teams that need full HR + safety",
    monthly: 29,
    yearly: 23,
    rank: 1,
    popular: true,
    gradient: ["#6366f1", "#8b5cf6", "#ec4899"],
    features: [
      { included: true, text: "Up to 200 workers" },
      { included: true, text: "Approve leave, OT & expenses" },
      { included: true, text: "Live map, panic feed & sync" },
      { included: true, text: "Payroll, timesheets, contracts" },
      { included: true, text: "Email support · 24h response" },
    ],
  },
  {
    key: "Enterprise",
    emoji: "🏛️",
    name: "Enterprise",
    tagline: "Custom limits, SSO and an account manager",
    monthly: 0,
    yearly: 0,
    rank: 2,
    gradient: ["#f59e0b", "#ef4444"],
    ctaContact: true,
    features: [
      { included: true, text: "Unlimited workers & employers" },
      { included: true, text: "SSO + custom roles" },
      { included: true, text: "API access & webhooks" },
      { included: true, text: "Dedicated account manager" },
      { included: true, text: "99.9% SLA · phone support" },
    ],
  },
];

function rankOf(planKey: string): number {
  const x = (planKey ?? "").toLowerCase();
  if (x.includes("enter")) return 2;
  if (x.includes("pro")) return 1;
  return 0;
}

function formatEndDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function PricingScreen() {
  const router = useRouter();
  const sub = useSubscriptionService();
  const session = useSession();

  const appRole = (session.claims?.appRole ?? session.claims?.role ?? "worker").toString();
  const isManager = appRole === "employer" || appRole === "agency";

  const [me, setMe] = useState<SubscriptionMe | null>(null);
  const [loading, setLoading] = useState(false);
  const [cycle, setCycle] = useState<Cycle>("yearly");

  const refresh = useCallback(async () => {
    if (!isManager) return;
    setLoading(true);
    try {
      const res = await sub.me();
      setMe(res ?? null);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, [isManager, sub]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const currentPlan = (me?.planType ?? "Free").toString();
  const currentRank = rankOf(currentPlan);
  const status = (me?.status ?? "Active").toString();
  const endDateLabel = formatEndDate(me?.endDate ?? null);

  const startCheckout = (planKey: PlanDef["key"]) => {
    router.push({ pathname: "/checkout/summary", params: { plan: planKey, cycle } } as any);
  };

  const contactSales = () => {
    router.push({ pathname: "/checkout/summary", params: { plan: "Enterprise", cycle: "yearly" } } as any);
  };

  return (
    <Screen
      title="💎 Pricing"
      subtitle={isManager ? "Pick the plan that fits your team" : "Plans for employers and agencies"}
      gradient={["#a855f7", "#ec4899", "#f59e0b"]}
      refreshing={loading}
      onRefresh={refresh}
    >
      {!isManager ? (
        <Card>
          <Text style={styles.workerNoteTitle}>👷 You're on the Worker app</Text>
          <Text style={styles.workerNoteText}>
            Workers don't need a plan — all worker features are free. Subscriptions are for employers and agencies who manage workforce.
          </Text>
          <GhostButton title="🔙 Back to home" onPress={() => router.replace("/(tabs)" as any)} style={{ marginTop: 12 }} />
        </Card>
      ) : (
        <>
          <CurrentPlanBanner planKey={currentPlan} status={status} endDateLabel={endDateLabel} loading={loading} />

          <CycleToggle cycle={cycle} onChange={setCycle} />

          {PLANS.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              cycle={cycle}
              currentRank={currentRank}
              isCurrent={plan.key.toLowerCase() === currentPlan.toLowerCase()}
              onSubscribe={() => startCheckout(plan.key)}
              onContact={contactSales}
            />
          ))}

          <SectionTitle title="✨ All paid plans include" />
          <Card>
            <FeatureBullet text="Unlimited offline panic alerts with auto-sync" />
            <FeatureBullet text="Worker mobile app for every team member" />
            <FeatureBullet text="GDPR-aligned data handling" />
            <FeatureBullet text="Cancel anytime — no long-term lock-in" />
          </Card>

          <Text style={styles.fineprint}>
            🔒 Secure payments powered by Stripe. Prices in USD. Taxes may apply at checkout.
          </Text>
        </>
      )}
    </Screen>
  );
}

function CurrentPlanBanner({
  planKey,
  status,
  endDateLabel,
  loading,
}: {
  planKey: string;
  status: string;
  endDateLabel: string | null;
  loading: boolean;
}) {
  const plan = PLANS.find((p) => p.key.toLowerCase() === planKey.toLowerCase()) ?? PLANS[0];
  const isFree = plan.key === "Free";
  const statusEmoji = status.toLowerCase().includes("cancel") ? "⚠️" : status.toLowerCase().includes("trial") ? "🧪" : "🟢";

  return (
    <View style={styles.banner}>
      <LinearGradient colors={plan.gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill as any} />
      <View style={styles.bannerOverlay} />
      <View style={styles.bannerRow}>
        <Text style={styles.bannerEmoji}>{plan.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerLabel}>YOUR CURRENT PLAN</Text>
          <Text style={styles.bannerPlan}>{plan.name}</Text>
          <Text style={styles.bannerStatus}>
            {loading ? "Refreshing…" : isFree ? "Free tier · Upgrade for full features" : `${statusEmoji} ${status}${endDateLabel ? ` · until ${endDateLabel}` : ""}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

function CycleToggle({ cycle, onChange }: { cycle: Cycle; onChange: (c: Cycle) => void }) {
  return (
    <View style={styles.toggleWrap}>
      <Pressable
        onPress={() => onChange("monthly")}
        style={[styles.toggleBtn, cycle === "monthly" && styles.toggleBtnActive]}
      >
        <Text style={[styles.toggleText, cycle === "monthly" && styles.toggleTextActive]}>Monthly</Text>
      </Pressable>
      <Pressable
        onPress={() => onChange("yearly")}
        style={[styles.toggleBtn, cycle === "yearly" && styles.toggleBtnActive]}
      >
        <Text style={[styles.toggleText, cycle === "yearly" && styles.toggleTextActive]}>Yearly</Text>
        <View style={styles.savePill}>
          <Text style={styles.savePillText}>Save 20%</Text>
        </View>
      </Pressable>
    </View>
  );
}

function PlanCard({
  plan,
  cycle,
  currentRank,
  isCurrent,
  onSubscribe,
  onContact,
}: {
  plan: PlanDef;
  cycle: Cycle;
  currentRank: number;
  isCurrent: boolean;
  onSubscribe: () => void;
  onContact: () => void;
}) {
  const monthly = cycle === "yearly" ? plan.yearly : plan.monthly;
  const showPrice = !plan.ctaContact && plan.key !== "Free";
  const direction = plan.rank - currentRank;

  let ctaLabel: string;
  let ctaVariant: "primary" | "success" | "danger" = "primary";
  let ctaHandler: (() => void) | null = null;
  let ctaDisabled = false;

  if (isCurrent) {
    ctaLabel = "✅ Current plan";
    ctaVariant = "success";
    ctaDisabled = true;
  } else if (plan.ctaContact) {
    ctaLabel = "📞 Contact sales";
    ctaHandler = onContact;
  } else if (plan.key === "Free") {
    ctaLabel = "⬇️ Downgrade to Free";
    ctaDisabled = true; // Stripe checkout handles paid plans only; downgrade via cancellation flow elsewhere.
  } else if (direction > 0) {
    ctaLabel = `🚀 Upgrade to ${plan.name}`;
    ctaHandler = onSubscribe;
  } else {
    ctaLabel = `⬇️ Switch to ${plan.name}`;
    ctaHandler = onSubscribe;
  }

  return (
    <View style={[styles.planWrap, plan.popular && styles.planWrapPopular]}>
      {plan.popular ? (
        <View style={styles.popularRibbon}>
          <Text style={styles.popularRibbonText}>⭐ MOST POPULAR</Text>
        </View>
      ) : null}

      <Card style={styles.planCard as any}>
        <View style={styles.planHeader}>
          <LinearGradient colors={plan.gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.planBadge}>
            <Text style={styles.planBadgeEmoji}>{plan.emoji}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planTag}>{plan.tagline}</Text>
          </View>
        </View>

        <View style={styles.priceRow}>
          {plan.ctaContact ? (
            <Text style={styles.priceCustom}>Custom</Text>
          ) : showPrice ? (
            <>
              <Text style={styles.priceCurrency}>$</Text>
              <Text style={styles.priceAmount}>{monthly}</Text>
              <Text style={styles.priceSuffix}>/mo</Text>
            </>
          ) : (
            <Text style={styles.priceFree}>Free forever</Text>
          )}
        </View>
        {showPrice && cycle === "yearly" ? (
          <Text style={styles.priceHint}>billed annually · ${monthly * 12}/yr</Text>
        ) : showPrice ? (
          <Text style={styles.priceHint}>billed monthly</Text>
        ) : null}

        <View style={styles.featureList}>
          {plan.features.map((f) => (
            <View key={f.text} style={styles.featureRow}>
              <FontAwesome
                name={f.included ? "check-circle" : "minus-circle"}
                size={14}
                color={f.included ? "#10b981" : "rgba(15,23,42,0.3)"}
              />
              <Text style={[styles.featureText, !f.included && styles.featureTextOff]}>{f.text}</Text>
            </View>
          ))}
        </View>

        {ctaHandler && !ctaDisabled ? (
          <PrimaryButton title={ctaLabel} variant={ctaVariant} onPress={ctaHandler} style={{ marginTop: 14 }} />
        ) : (
          <View style={[styles.disabledCta, ctaVariant === "success" && styles.disabledCtaSuccess]}>
            <Text style={[styles.disabledCtaText, ctaVariant === "success" && styles.disabledCtaTextSuccess]}>
              {ctaLabel}
            </Text>
          </View>
        )}
      </Card>
    </View>
  );
}

function FeatureBullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <FontAwesome name="check" size={12} color="#10b981" />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  workerNoteTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  workerNoteText: { marginTop: 6, fontSize: 13, color: "rgba(15,23,42,0.7)", lineHeight: 19 },

  banner: {
    borderRadius: 22,
    overflow: "hidden",
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 16,
    shadowColor: "#6366f1",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.12)" },
  bannerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  bannerEmoji: { fontSize: 38 },
  bannerLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2, color: "rgba(255,255,255,0.85)" },
  bannerPlan: { marginTop: 2, fontSize: 24, fontWeight: "900", color: "#fff" },
  bannerStatus: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.92)" },

  toggleWrap: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.15)",
  },
  toggleBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toggleBtnActive: { backgroundColor: "#0f172a" },
  toggleText: { fontSize: 13, fontWeight: "800", color: "rgba(15,23,42,0.6)" },
  toggleTextActive: { color: "#fff" },
  savePill: { backgroundColor: "#10b981", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  savePillText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },

  planWrap: { marginBottom: 14 },
  planWrapPopular: { marginTop: 14 },
  popularRibbon: {
    position: "absolute",
    top: -10,
    right: 16,
    zIndex: 2,
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  popularRibbonText: { fontSize: 10, fontWeight: "900", color: "#fff", letterSpacing: 1 },
  planCard: { borderWidth: 1, borderColor: "rgba(79,70,229,0.12)" },

  planHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  planBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366f1",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  planBadgeEmoji: { fontSize: 24 },
  planName: { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  planTag: { marginTop: 2, fontSize: 12, color: "rgba(15,23,42,0.6)", lineHeight: 17 },

  priceRow: { marginTop: 14, flexDirection: "row", alignItems: "flex-end", gap: 2 },
  priceCurrency: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginBottom: 6 },
  priceAmount: { fontSize: 40, fontWeight: "900", color: "#0f172a", letterSpacing: -1 },
  priceSuffix: { fontSize: 13, fontWeight: "700", color: "rgba(15,23,42,0.55)", marginBottom: 8, marginLeft: 2 },
  priceFree: { fontSize: 26, fontWeight: "900", color: "#10b981" },
  priceCustom: { fontSize: 26, fontWeight: "900", color: "#0f172a" },
  priceHint: { marginTop: 2, fontSize: 11, color: "rgba(15,23,42,0.5)", fontWeight: "700" },

  featureList: { marginTop: 14, gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 13, color: "#0f172a", fontWeight: "600", flex: 1 },
  featureTextOff: { color: "rgba(15,23,42,0.45)", fontWeight: "500" },

  disabledCta: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.06)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
  },
  disabledCtaText: { color: "rgba(15,23,42,0.5)", fontWeight: "800", fontSize: 14 },
  disabledCtaSuccess: { backgroundColor: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.35)" },
  disabledCtaTextSuccess: { color: "#047857" },

  bulletRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  bulletText: { fontSize: 13, color: "#0f172a", fontWeight: "600", flex: 1 },

  fineprint: { marginTop: 18, fontSize: 11, color: "rgba(15,23,42,0.5)", textAlign: "center", fontWeight: "600" },
});

// Avoid "imported but unused" if the project flips noUnusedLocals.
void ActivityIndicator;
