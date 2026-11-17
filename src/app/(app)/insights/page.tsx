import { redirect } from "next/navigation";

/** /insights has no page of its own (the breadcrumb links to it): send people to the leaderboard, the first Insights page. */
export default function InsightsIndex() {
  redirect("/insights/leaderboard");
}
