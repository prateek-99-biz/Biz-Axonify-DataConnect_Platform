import { Activity, BookOpen, Brain, Cog, Gauge, Grid2x2, House, Layers, Package, ScanSearch, type LucideIcon } from "lucide-react";

export interface QbrPage { href: string; label: string; short: string; icon: LucideIcon; blurb: string }

/** The dashboard's pages in sidebar order. Content Delivery and Progression are top-level (as in the source report's sidebar). */
export const QBR_PAGES: QbrPage[] = [
  { href: "/qbr", label: "Homepage", short: "Home", icon: House, blurb: "Overall health and where to go next" },
  { href: "/qbr/engagement", label: "Engagement", short: "Engagement", icon: Activity, blurb: "Participation, frequency, active users" },
  { href: "/qbr/knowledge", label: "Knowledge", short: "Knowledge", icon: Brain, blurb: "Growth, confidence, topic progress" },
  { href: "/qbr/content", label: "Content", short: "Content", icon: BookOpen, blurb: "Topics, types, surveys, content health" },
  { href: "/qbr/usage", label: "Usage", short: "Usage", icon: Cog, blurb: "Hours, games, rewards, platform" },
  { href: "/qbr/teams", label: "Team Performance", short: "Teams", icon: Gauge, blurb: "Which teams are strong, which need attention" },
  { href: "/qbr/topics", label: "Topic Deep Dive", short: "Topics", icon: ScanSearch, blurb: "Learning objectives and question-level detail" },
  { href: "/qbr/matrix", label: "Knowledge & Confidence Matrix", short: "Matrix", icon: Grid2x2, blurb: "Data that drives performance" },
  { href: "/qbr/delivery", label: "Content Delivery", short: "Delivery", icon: Package, blurb: "How much content is assigned to groups" },
  { href: "/qbr/progression", label: "Content Progression", short: "Progression", icon: Layers, blurb: "Where users are across L1, L2 and L3" },
];
