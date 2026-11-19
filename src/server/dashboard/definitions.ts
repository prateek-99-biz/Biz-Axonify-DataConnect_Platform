/**
 * One definition per dashboard KPI, shown as a tooltip on the tile. Wording follows Axonify's own report names so a
 * number can be matched to AdminZone; where the platform differs from Axonify (or from the Power BI report) it says so.
 * Verified against AdminZone for NFXP and Emirates on 2026-10-28.
 */
export const KPI_DEFS = {
  participation: "Training users ÷ active users. Axonify's Participation report calls this 'Average Training Participation'; its 'Average Participation' counts logged-in users instead.",
  frequency: "Average days active in the last 30 days per logged-in user, weighted across teams by logged-in users (Axonify: 'Average Frequency (Days)').",
  activeUsers: "Employees in Axonify's default Participation view, 'Users in Active Training Programs' ('Number of Employees'). Axonify's 'All Users' view can be larger when some users are not in an active program. Parent teams are not added to their sub-teams.",
  loggedIn: "Active users with at least one session in the last 30 days (Axonify: 'Employees Logged In').",
  trainingUsers: "Active users who completed training in the last 30 days (Axonify: 'Employees Completed Training').",
  time: "Average minutes per day spent on the platform by logged-in users, weighted across teams by logged-in users.",
  health: "Equal-weight blend of training participation (latest month) and current knowledge (snapshot): 50% + 50%. From the Power BI Account Health Score.",
  currentKnowledge: "Average current score over every active user-topic-level record that has a score. Same method as Axonify's Knowledge Summary.",
  baselineKnowledge: "Average first-attempt score over the same records as current knowledge.",
  lift: "Current knowledge minus baseline knowledge, in percentage points.",
  confidence: "Average self-reported confidence (0-100) per active learner-topic, taking the learner's highest level in each topic; topics not started at all count as 0, levels not started inside a started topic are left out. The Knowledge & Confidence Matrix averages every level instead (not-started levels count as 0), so its confidence reads lower.",
  experts: "Learners whose average current score is 90% or higher.",
  topicCompletion: "Share of active learner-topics where the learner has reached Graduate or Expert on at least one question level. Axonify's Topic Progress report also counts Intermediate as completed, so its figure is higher.",
  graduateExpert: "Share of user-topic-level records at Graduate or Expert.",
  notStarted: "Share of user-topic-level records not yet started.",
  questionPool: "Average number of released questions across the topics assigned to each learner (each assigned topic counted once).",
  monthsToGraduate: "Average question pool ÷ questions answered per learner in the last 30 days (Power BI measure).",
} as const;

export type KpiMetric = keyof typeof KPI_DEFS;

/**
 * Definitions for tiles that are not account KPIs (sums over the selected topics). A tile shows one of these in place of
 * its metric's definition while keeping that metric's colour.
 */
export const TILE_DEFS = {
  graduateRecords: "Share of learner-topic-level records at Graduate or Expert, worked out per topic and averaged over the selected topics weighted by each topic's scored learners. Axonify's Topic Progress report also counts Intermediate as completed, so its figure is higher.",
  learnerTopics: "Learners with a score in each selected topic, added up across topics: a learner in five topics counts five times. It is not a count of distinct learners.",
  groupTopics: "Training groups linked to each selected topic (through programs or fast-track audiences), added up across topics: a group linked to five topics counts five times.",
} as const;
