/**
 * BigQuery SQL for the dashboard datasets. Built from the Power BI report's queries (Axonify DataConnect views in
 * the `axonify___bizgroup_emea` dataset) and checked against config/bigquery-schema.json. Every query takes
 * @tenants (ARRAY<INT64>) and reads only; nothing here writes to BigQuery.
 */
export interface Source { project: string; dataset: string }

const ident = (s: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error(`Unsafe BigQuery identifier: ${s}`);
  return s;
};

const make = (src: Source) => (view: string) => `\`${ident(src.project)}.${ident(src.dataset)}.${ident(view)}\``;
type T = ReturnType<typeof make>;

const TENANT = "tenant_id IN UNNEST(@tenants)";

export const QUERIES = {
  clients: (t: T) => `SELECT id, name FROM ${t("tenant")} WHERE id IN UNNEST(@tenants)`,

  /**
   * One row per team per month. The view is a hierarchy roll-up (a parent includes its children's users), so the app
   * adds only the top-most rows when it builds account totals (calc.ts topRows).
   */
  teamMonthly: (t: T) => `
    SELECT
      tenant_id,
      FORMAT_DATE('%Y-%m', month) AS month,
      team,
      team_hierarchy,
      SUM(employee_count) AS active_users,
      SUM(employee_logged_in_count) AS logged_in_users,
      SUM(employee_training_count) AS training_users,
      SAFE_DIVIDE(SUM(average_frequency * employee_count), NULLIF(SUM(employee_count), 0)) AS frequency,
      SAFE_DIVIDE(SUM(average_time_spent_per_day_minutes * employee_count), NULLIF(SUM(employee_count), 0)) AS avg_time_per_day_min
    FROM ${t("analytics_foundation_team_monthly_participation")}
    WHERE ${TENANT}
      AND month >= DATE_SUB(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 24 MONTH)
      AND LOWER(current_team_status) = 'active'
    GROUP BY 1, 2, 3, 4`,

  /** Account-level knowledge, confidence, experts and completion (report: FactKnowledgeAccount). */
  knowledgeAccount: (t: T) => `
    WITH learner_knowledge AS (
      SELECT tenant_id, employee_id, AVG(current_score) AS learner_current
      FROM ${t("analytics_SDE_topic_progress")}
      WHERE ${TENANT} AND LOWER(user_status) = 'active' AND current_score IS NOT NULL AND baseline_score IS NOT NULL
      GROUP BY tenant_id, employee_id
    ),
    -- Axonify's Knowledge Summary averages every user-topic-level score, not each learner's average
    score_rows AS (
      SELECT tenant_id, AVG(baseline_score) AS avg_baseline, AVG(current_score) AS avg_current
      FROM ${t("analytics_SDE_topic_progress")}
      WHERE ${TENANT} AND LOWER(user_status) = 'active' AND current_score IS NOT NULL AND baseline_score IS NOT NULL
      GROUP BY tenant_id
    ),
    sde AS (
      SELECT lk.tenant_id,
        COUNT(DISTINCT lk.employee_id) AS learners,
        ANY_VALUE(sr.avg_baseline) AS avg_baseline,
        ANY_VALUE(sr.avg_current) AS avg_current,
        COUNT(DISTINCT IF(lk.learner_current >= 90, lk.employee_id, NULL)) AS expert_users
      FROM learner_knowledge lk JOIN score_rows sr USING (tenant_id)
      GROUP BY lk.tenant_id
    ),
    user_topic AS (
      SELECT tenant_id, user_id, topic_id,
        MAX(current_confidence) AS current_confidence,
        IF(COUNTIF(LOWER(topic_progress) = 'graduate') > 0, 1, 0) AS is_graduate
      FROM ${t("content_user_topic_progress")}
      WHERE ${TENANT} AND is_active = TRUE
      GROUP BY tenant_id, user_id, topic_id
    ),
    confidence AS (
      SELECT tenant_id,
        AVG(current_confidence) AS avg_confidence,
        SAFE_DIVIDE(SUM(is_graduate), COUNT(*)) AS topic_completion
      FROM user_topic
      GROUP BY tenant_id
    )
    SELECT s.tenant_id, s.learners, s.avg_baseline, s.avg_current, s.expert_users, c.avg_confidence, c.topic_completion
    FROM sde s LEFT JOIN confidence c USING (tenant_id)`,

  /** Released topics with knowledge, completion, question counts per level, modules and target groups. */
  topics: (t: T) => `
    WITH topic_base AS (
      SELECT tenant_id, id AS topic_internal_id,
        COALESCE(NULLIF(CAST(external_id AS STRING), ''), CONCAT('INTERNAL-', CAST(id AS STRING))) AS topic_key,
        create_date
      FROM ${t("content_topic")}
      WHERE ${TENANT} AND delete_date IS NULL AND LOWER(TRIM(status)) = 'released'
    ),
    sde AS (
      SELECT tenant_id, CAST(topic_id AS STRING) AS topic_key,
        ANY_VALUE(topic) AS topic_name, ANY_VALUE(subject) AS subject, ANY_VALUE(category) AS category,
        COUNT(DISTINCT employee_id) AS learners,
        AVG(baseline_score) AS avg_baseline, AVG(current_score) AS avg_current
      FROM ${t("analytics_SDE_topic_progress")}
      WHERE ${TENANT} AND topic_id IS NOT NULL AND current_score IS NOT NULL
      GROUP BY tenant_id, topic_key
    ),
    progress AS (
      SELECT tenant_id, topic_id AS topic_internal_id,
        SAFE_DIVIDE(COUNTIF(LOWER(topic_progress) = 'graduate'), COUNT(*)) AS completion
      FROM ${t("content_user_topic_progress")}
      WHERE ${TENANT} AND is_active = TRUE AND topic_id IS NOT NULL
      GROUP BY tenant_id, topic_internal_id
    ),
    questions AS (
      SELECT tenant_id, topic_id AS topic_internal_id,
        COUNT(DISTINCT IF(level = 1, id, NULL)) AS l1,
        COUNT(DISTINCT IF(level = 2, id, NULL)) AS l2,
        COUNT(DISTINCT IF(level = 3, id, NULL)) AS l3
      FROM ${t("content_question")}
      WHERE ${TENANT} AND delete_date IS NULL AND LOWER(TRIM(status)) = 'released'
      GROUP BY tenant_id, topic_internal_id
    ),
    modules AS (
      SELECT tenant_id, topic_id AS topic_internal_id, COUNT(DISTINCT id) AS modules
      FROM ${t("content_training_module")}
      WHERE ${TENANT} AND delete_date IS NULL AND LOWER(TRIM(status)) = 'released'
      GROUP BY tenant_id, topic_internal_id
    ),
    topic_program_items AS (
      SELECT DISTINCT tenant_id, object_id AS topic_internal_id, program_id, training_group_id
      FROM ${t("content_program_item")}
      WHERE ${TENANT} AND LOWER(TRIM(status)) = 'released' AND LOWER(object_type) LIKE '%topic%'
    ),
    topic_group_links AS (
      SELECT tenant_id, topic_internal_id, training_group_id FROM topic_program_items WHERE training_group_id IS NOT NULL
      UNION DISTINCT
      SELECT tpi.tenant_id, tpi.topic_internal_id, map.training_group_id
      FROM topic_program_items tpi
      JOIN ${t("content_manager_assigned_program_link")} map ON tpi.tenant_id = map.tenant_id AND tpi.program_id = map.program_id
      WHERE map.training_group_id IS NOT NULL
      UNION DISTINCT
      SELECT ftt.tenant_id, ftt.topic_id, ftg.training_group_id
      FROM ${t("content_program_fast_track_topic_link")} ftt
      JOIN ${t("content_program_fast_track_custom_audience_group_link")} ftg ON ftt.tenant_id = ftg.tenant_id AND ftt.program_id = ftg.program_id
      WHERE ftt.${TENANT} AND ftg.training_group_id IS NOT NULL
    ),
    group_counts AS (
      SELECT tenant_id, topic_internal_id, COUNT(DISTINCT training_group_id) AS target_groups
      FROM topic_group_links
      GROUP BY tenant_id, topic_internal_id
    )
    SELECT tb.tenant_id, tb.topic_key,
      COALESCE(sde.topic_name, CONCAT('Topic ', tb.topic_key)) AS topic_name,
      sde.subject, sde.category,
      sde.avg_baseline, sde.avg_current,
      COALESCE(sde.learners, 0) AS audience,
      COALESCE(p.completion, 0) AS completion,
      COALESCE(g.target_groups, 0) AS target_groups,
      COALESCE(m.modules, 0) AS modules,
      COALESCE(q.l1, 0) AS l1, COALESCE(q.l2, 0) AS l2, COALESCE(q.l3, 0) AS l3,
      FORMAT_DATE('%Y-%m-%d', DATE(tb.create_date)) AS created_at
    FROM topic_base tb
    LEFT JOIN sde ON tb.tenant_id = sde.tenant_id AND tb.topic_key = sde.topic_key
    LEFT JOIN progress p ON tb.tenant_id = p.tenant_id AND tb.topic_internal_id = p.topic_internal_id
    LEFT JOIN questions q ON tb.tenant_id = q.tenant_id AND tb.topic_internal_id = q.topic_internal_id
    LEFT JOIN modules m ON tb.tenant_id = m.tenant_id AND tb.topic_internal_id = m.topic_internal_id
    LEFT JOIN group_counts g ON tb.tenant_id = g.tenant_id AND tb.topic_internal_id = g.topic_internal_id`,

  /** Knowledge by learning frequency in the latest month (report: FactKnowledgeFrequency). */
  frequency: (t: T) => `
    WITH latest_month AS (
      SELECT MAX(month) AS latest_month
      FROM ${t("foundation_user_monthly_participation")}
      WHERE user_is_active = TRUE AND ${TENANT}
    ),
    user_frequency AS (
      SELECT fump.tenant_id, fu.employee_id,
        CASE
          WHEN SUM(fump.training_sessions_30_day) < 10 THEN 1
          WHEN SUM(fump.training_sessions_30_day) BETWEEN 10 AND 20 THEN 2
          ELSE 3
        END AS frequency_sort
      FROM ${t("foundation_user_monthly_participation")} fump
      JOIN latest_month lm ON fump.month = lm.latest_month
      LEFT JOIN ${t("foundation_user")} fu ON fump.tenant_id = fu.tenant_id AND fump.user_id = fu.id
      WHERE fump.user_is_active = TRUE AND fump.${TENANT}
      GROUP BY fump.tenant_id, fu.employee_id
    ),
    user_knowledge AS (
      SELECT tenant_id, employee_id, baseline_score AS baseline, current_score
      FROM ${t("analytics_SDE_topic_progress")}
      WHERE ${TENANT} AND LOWER(user_status) = 'active' AND current_score IS NOT NULL AND baseline_score IS NOT NULL
    )
    SELECT uf.tenant_id, uf.frequency_sort,
      COUNT(DISTINCT uf.employee_id) AS user_count,
      AVG(uk.current_score) AS avg_current,
      AVG(uk.current_score) - AVG(uk.baseline) AS avg_lift
    FROM user_frequency uf
    JOIN user_knowledge uk ON uf.tenant_id = uk.tenant_id AND uf.employee_id = uk.employee_id
    GROUP BY uf.tenant_id, uf.frequency_sort`,

  /** Learner-topic records by subject, question level and status (report: FactContentProgression, split by subject). */
  progress: (t: T) => `
    WITH sde AS (
      SELECT tenant_id, CAST(topic_id AS STRING) AS topic_key, ANY_VALUE(subject) AS subject
      FROM ${t("analytics_SDE_topic_progress")}
      WHERE ${TENANT} AND topic_id IS NOT NULL
      GROUP BY tenant_id, topic_key
    ),
    topic_dim AS (
      SELECT tp.tenant_id, tp.id AS topic_internal_id, sde.subject
      FROM ${t("content_topic")} tp
      LEFT JOIN sde ON sde.tenant_id = tp.tenant_id
        AND sde.topic_key = COALESCE(NULLIF(CAST(tp.external_id AS STRING), ''), CONCAT('INTERNAL-', CAST(tp.id AS STRING)))
      WHERE tp.${TENANT}
    )
    SELECT p.tenant_id, COALESCE(d.subject, 'Unassigned') AS subject, p.question_level, LOWER(p.topic_progress) AS status, COUNT(*) AS records
    FROM ${t("content_user_topic_progress")} p
    LEFT JOIN topic_dim d ON d.tenant_id = p.tenant_id AND d.topic_internal_id = p.topic_id
    WHERE p.${TENANT} AND p.is_active = TRUE AND p.question_level IS NOT NULL AND p.topic_progress IS NOT NULL
    GROUP BY 1, 2, 3, 4`,

  /** Learner segments on knowledge vs confidence (report: FactKnowledgeConfidenceMatrix). */
  matrix: (t: T) => `
    WITH latest_month AS (
      SELECT MAX(month) AS latest_month
      FROM ${t("foundation_user_monthly_participation")}
      WHERE user_is_active = TRUE AND ${TENANT}
    ),
    learner_knowledge AS (
      SELECT tenant_id, employee_id, AVG(current_score) AS avg_current
      FROM ${t("analytics_SDE_topic_progress")}
      WHERE ${TENANT} AND LOWER(user_status) = 'active' AND current_score IS NOT NULL
      GROUP BY tenant_id, employee_id
    ),
    learner_confidence AS (
      SELECT c.tenant_id, fu.employee_id,
        AVG(c.current_confidence) AS avg_confidence,
        SAFE_DIVIDE(COUNTIF(LOWER(c.topic_progress) = 'graduate'), COUNT(*)) AS graduate_rate
      FROM ${t("content_user_topic_progress")} c
      LEFT JOIN ${t("foundation_user")} fu ON c.tenant_id = fu.tenant_id AND c.user_id = fu.id
      WHERE c.${TENANT} AND c.is_active = TRUE AND fu.employee_id IS NOT NULL
      GROUP BY c.tenant_id, fu.employee_id
    ),
    learner_activity AS (
      SELECT fump.tenant_id, fu.employee_id, SUM(fump.training_sessions_30_day) AS sessions
      FROM ${t("foundation_user_monthly_participation")} fump
      JOIN latest_month lm ON fump.month = lm.latest_month
      LEFT JOIN ${t("foundation_user")} fu ON fump.tenant_id = fu.tenant_id AND fump.user_id = fu.id
      WHERE fump.user_is_active = TRUE AND fump.${TENANT} AND fu.employee_id IS NOT NULL
      GROUP BY fump.tenant_id, fu.employee_id
    ),
    base AS (
      SELECT k.tenant_id, k.employee_id,
        CASE WHEN k.avg_current <= 1 THEN k.avg_current ELSE LEAST(k.avg_current / 100, 1) END AS knowledge,
        -- current_confidence is on a 0-100 scale, so a low average is a real low score, not a smaller scale
        CASE WHEN c.avg_confidence IS NULL THEN NULL ELSE LEAST(GREATEST(c.avg_confidence, 0) / 100, 1) END AS confidence,
        c.graduate_rate,
        COALESCE(a.sessions, 0) AS sessions
      FROM learner_knowledge k
      LEFT JOIN learner_confidence c ON k.tenant_id = c.tenant_id AND k.employee_id = c.employee_id
      LEFT JOIN learner_activity a ON k.tenant_id = a.tenant_id AND k.employee_id = a.employee_id
    ),
    segmented AS (
      SELECT tenant_id, employee_id, knowledge, confidence,
        CASE
          WHEN sessions = 0 THEN 'Non-participants'
          WHEN graduate_rate >= 0.95 THEN 'Graduated'
          WHEN knowledge >= 0.90 AND confidence >= 0.70 THEN 'Experts'
          WHEN knowledge < 0.40 AND confidence >= 0.70 THEN 'Overconfident'
          WHEN knowledge >= 0.90 AND confidence < 0.50 THEN 'Underconfident'
          WHEN knowledge < 0.50 THEN 'Needs coaching'
          ELSE 'Intermediate'
        END AS segment
      FROM base
      WHERE knowledge IS NOT NULL AND confidence IS NOT NULL
    )
    SELECT tenant_id, segment, COUNT(DISTINCT employee_id) AS learners, AVG(knowledge) AS avg_knowledge, AVG(confidence) AS avg_confidence
    FROM segmented
    GROUP BY tenant_id, segment`,

  /** Monthly usage totals (report: FactUsageDaily, grouped by month). */
  usageMonthly: (t: T) => {
    const since = "DATE(create_date) >= DATE_SUB(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 24 MONTH)";
    const zeros = (...keep: string[]) =>
      ["logins", "training_activities", "training_seconds", "completed_training", "games_played", "points_spent", "broadcasts_sent"]
        .map((c) => (keep.includes(c) ? "" : `0 AS ${c}`)).filter(Boolean).join(", ");
    return `
    WITH events AS (
      SELECT tenant_id, DATE(create_date) AS d, COUNT(*) AS logins, ${zeros("logins")}
      FROM ${t("foundation_user_login_record")} WHERE ${TENANT} AND ${since} GROUP BY tenant_id, d
      UNION ALL
      SELECT tenant_id, DATE(create_date), 0, COUNT(*), SUM(COALESCE(time_spent, 0)), 0, 0, 0, 0
      FROM ${t("content_user_training")} WHERE ${TENANT} AND ${since} AND status = 'Active' GROUP BY tenant_id, DATE(create_date)
      UNION ALL
      SELECT tenant_id, DATE(complete_date), 0, 0, 0, COUNT(*), 0, 0, 0
      FROM ${t("content_user_completed_training")}
      WHERE ${TENANT} AND complete_date IS NOT NULL AND status = 'Active'
        AND DATE(complete_date) >= DATE_SUB(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 24 MONTH)
      GROUP BY tenant_id, DATE(complete_date)
      UNION ALL
      SELECT tenant_id, DATE(create_date), 0, 0, 0, 0, COUNT(*), 0, 0
      FROM ${t("game_play")} WHERE ${TENANT} AND ${since} AND status = 'Active' AND is_game_played = TRUE GROUP BY tenant_id, DATE(create_date)
      UNION ALL
      SELECT tenant_id, DATE(create_date), 0, 0, 0, 0, 0, SUM(ABS(COALESCE(points, 0))), 0
      FROM ${t("reward_point_transaction")}
      WHERE ${TENANT} AND ${since} AND status = 'Active'
        AND type IN ('Spin-to-Win Purchase', 'Raffle Ticket Purchase', 'Auction Won', 'Buy Now Purchase')
      GROUP BY tenant_id, DATE(create_date)
      UNION ALL
      SELECT tenant_id, DATE(COALESCE(start_date_local_time, start_date, create_date)), 0, 0, 0, 0, 0, 0, COUNT(DISTINCT id)
      FROM ${t("comms_message_configuration")}
      WHERE ${TENANT} AND status IN ('Live', 'Expired')
        AND DATE(COALESCE(start_date_local_time, start_date, create_date)) >= DATE_SUB(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 24 MONTH)
      GROUP BY tenant_id, DATE(COALESCE(start_date_local_time, start_date, create_date))
    )
    SELECT tenant_id, FORMAT_DATE('%Y-%m', d) AS month,
      SUM(logins) AS logins, SUM(training_activities) AS training_activities, SUM(training_seconds) AS training_seconds,
      SUM(completed_training) AS completed_training, SUM(games_played) AS games_played,
      SUM(points_spent) AS points_spent, SUM(broadcasts_sent) AS broadcasts_sent
    FROM events
    WHERE d IS NOT NULL
    GROUP BY tenant_id, month`;
  },

  platformAccess: (t: T) => `
    SELECT tenant_id,
      CASE
        WHEN from_mobile_app = TRUE THEN 'Mobile'
        WHEN LOWER(platform) LIKE '%android%' OR LOWER(platform) LIKE '%ios%' OR LOWER(platform) LIKE '%iphone%' THEN 'Mobile'
        WHEN LOWER(platform) LIKE '%ipad%' OR LOWER(platform) LIKE '%tablet%' THEN 'Tablet'
        WHEN platform IS NULL OR TRIM(platform) = '' THEN 'Unknown'
        ELSE 'Desktop'
      END AS platform_group,
      COUNT(*) AS logins
    FROM ${t("foundation_user_login_record")}
    WHERE ${TENANT} AND DATE(create_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    GROUP BY tenant_id, platform_group`,

  hours: (t: T) => `
    SELECT tenant_id, EXTRACT(HOUR FROM create_date) AS hour, COUNT(*) AS activity_count
    FROM ${t("content_user_training")}
    WHERE ${TENANT} AND DATE(create_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) AND status NOT IN ('Deleted', 'Cancelled')
    GROUP BY tenant_id, hour`,

  /** Share of last-month active users who used each feature in the last 30 days (report: FactFeatureUsage). */
  features: (t: T) => `
    WITH latest AS (
      SELECT MAX(month) AS month FROM ${t("foundation_user_monthly_participation")} WHERE user_is_active = TRUE AND ${TENANT}
    ),
    au AS (
      SELECT m.tenant_id, COUNT(DISTINCT m.user_id) AS active_users,
        COUNT(DISTINCT IF(m.training_sessions_30_day > 0, m.user_id, NULL)) AS trained
      FROM ${t("foundation_user_monthly_participation")} m JOIN latest ON m.month = latest.month
      WHERE m.user_is_active = TRUE AND m.${TENANT}
      GROUP BY m.tenant_id
    ),
    games AS (
      SELECT tenant_id, COUNT(DISTINCT user_id) AS users FROM ${t("game_play")}
      WHERE ${TENANT} AND DATE(create_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) AND is_game_played = TRUE GROUP BY tenant_id
    ),
    rewards AS (
      SELECT tenant_id, COUNT(DISTINCT user_id) AS users FROM ${t("reward_point_transaction")}
      WHERE ${TENANT} AND DATE(create_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) AND status NOT IN ('Deleted', 'Cancelled') GROUP BY tenant_id
    ),
    achievements AS (
      SELECT tenant_id, COUNT(DISTINCT user_id) AS users FROM ${t("foundation_user_achievement")}
      WHERE ${TENANT} AND DATE(create_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) GROUP BY tenant_id
    ),
    broadcasts AS (
      SELECT tenant_id, COUNT(DISTINCT user_id) AS users FROM ${t("comms_user_message_impression")}
      WHERE ${TENANT} AND DATE(create_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) GROUP BY tenant_id
    )
    SELECT au.tenant_id, 'Daily training' AS feature, 1 AS sort_order, au.trained AS users, au.active_users FROM au
    UNION ALL SELECT au.tenant_id, 'Games', 2, COALESCE(g.users, 0), au.active_users FROM au LEFT JOIN games g USING (tenant_id)
    UNION ALL SELECT au.tenant_id, 'Rewards', 3, COALESCE(r.users, 0), au.active_users FROM au LEFT JOIN rewards r USING (tenant_id)
    UNION ALL SELECT au.tenant_id, 'Achievements', 4, COALESCE(a.users, 0), au.active_users FROM au LEFT JOIN achievements a USING (tenant_id)
    UNION ALL SELECT au.tenant_id, 'Broadcasts', 5, COALESCE(b.users, 0), au.active_users FROM au LEFT JOIN broadcasts b USING (tenant_id)`,

  /**
   * Programs and reinforcement topics per training group. The report counted programs only through the fast-track
   * audience link, which is why it showed zeros; assignments also live on content_program_item, so both are counted.
   */
  deliveryGroups: (t: T) => `
    WITH program_links AS (
      SELECT pi.tenant_id, pi.training_group_id, pi.program_id
      FROM ${t("content_program_item")} pi
      JOIN ${t("content_program")} p ON pi.tenant_id = p.tenant_id AND pi.program_id = p.id
      WHERE pi.${TENANT} AND pi.training_group_id IS NOT NULL
        AND LOWER(TRIM(pi.status)) = 'released' AND LOWER(TRIM(p.status)) = 'released'
      UNION DISTINCT
      SELECT gl.tenant_id, gl.training_group_id, gl.program_id
      FROM ${t("content_program_fast_track_custom_audience_group_link")} gl
      JOIN ${t("content_program")} p ON gl.tenant_id = p.tenant_id AND gl.program_id = p.id
      WHERE gl.${TENANT} AND LOWER(TRIM(p.status)) = 'released'
    ),
    programs_per_group AS (
      SELECT tenant_id, training_group_id, COUNT(DISTINCT program_id) AS programs FROM program_links GROUP BY tenant_id, training_group_id
    ),
    topics_per_group AS (
      SELECT gl.tenant_id, gl.training_group_id, COUNT(DISTINCT tl.topic_id) AS reinforcement_topics
      FROM ${t("content_program_fast_track_custom_audience_group_link")} gl
      JOIN ${t("content_program")} p ON gl.tenant_id = p.tenant_id AND gl.program_id = p.id
      JOIN ${t("content_program_fast_track_topic_link")} tl ON gl.tenant_id = tl.tenant_id AND gl.program_id = tl.program_id
      WHERE gl.${TENANT} AND LOWER(TRIM(p.status)) = 'released'
      GROUP BY gl.tenant_id, gl.training_group_id
    )
    SELECT g.tenant_id, g.id AS group_id, g.name, g.status,
      COALESCE(pg.programs, 0) AS programs, COALESCE(tg.reinforcement_topics, 0) AS reinforcement_topics
    FROM ${t("foundation_training_group")} g
    LEFT JOIN programs_per_group pg ON g.tenant_id = pg.tenant_id AND g.id = pg.training_group_id
    LEFT JOIN topics_per_group tg ON g.tenant_id = tg.tenant_id AND g.id = tg.training_group_id
    WHERE g.${TENANT} AND g.delete_date IS NULL`,

  /** Question pool per learner and months to graduate (report: FactContentDelivery). */
  deliverySummary: (t: T) => `
    WITH released AS (
      SELECT tenant_id, topic_id, COUNT(DISTINCT id) AS questions
      FROM ${t("content_question")} WHERE ${TENANT} AND LOWER(TRIM(status)) = 'released' GROUP BY tenant_id, topic_id
    ),
    pool AS (
      SELECT c.tenant_id, c.user_id, SUM(COALESCE(r.questions, 0)) AS assigned_pool
      FROM ${t("content_user_topic_progress")} c
      LEFT JOIN released r ON c.tenant_id = r.tenant_id AND c.topic_id = r.topic_id
      WHERE c.${TENANT} AND c.is_active = TRUE
      GROUP BY c.tenant_id, c.user_id
    ),
    pool_summary AS (SELECT tenant_id, AVG(assigned_pool) AS avg_question_pool FROM pool GROUP BY tenant_id),
    answers AS (
      SELECT tenant_id, user_id, COUNT(*) AS answered
      FROM ${t("content_user_question_answer")}
      WHERE ${TENANT} AND DATE(create_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) AND status NOT IN ('Deleted', 'Cancelled')
      GROUP BY tenant_id, user_id
    ),
    answer_summary AS (SELECT tenant_id, AVG(answered) AS answered_per_user_30d FROM answers GROUP BY tenant_id)
    SELECT p.tenant_id, p.avg_question_pool, SAFE_DIVIDE(p.avg_question_pool, NULLIF(a.answered_per_user_30d, 0)) AS months_to_graduate
    FROM pool_summary p LEFT JOIN answer_summary a USING (tenant_id)`,

  /** Quarterly client rows for the portfolio (registered, active, training, retained, sessions, knowledge snapshot). */
  clientPeriod: (t: T) => `
    WITH uq AS (
      SELECT tenant_id, user_id, DATE_TRUNC(month, QUARTER) AS quarter_start,
        LOGICAL_OR(COALESCE(user_is_active, FALSE)) AS is_active,
        LOGICAL_OR(COALESCE(user_is_active, FALSE) AND COALESCE(training_sessions_30_day, 0) > 0) AS is_training,
        SUM(COALESCE(total_sessions_30_day, 0)) AS sessions
      FROM ${t("foundation_user_monthly_participation")}
      WHERE ${TENANT}
      GROUP BY tenant_id, user_id, quarter_start
    ),
    q AS (
      SELECT tenant_id, quarter_start, COUNTIF(is_active) AS active_users, COUNTIF(is_training) AS training_users, SUM(sessions) AS sessions
      FROM uq GROUP BY tenant_id, quarter_start
    ),
    registered AS (
      SELECT q.tenant_id, q.quarter_start, COUNT(*) AS registered_users
      FROM q JOIN ${t("foundation_user")} u ON u.tenant_id = q.tenant_id
        AND DATE(u.create_date) <= LAST_DAY(q.quarter_start, QUARTER)
        AND (u.terminate_date IS NULL OR DATE(u.terminate_date) > LAST_DAY(q.quarter_start, QUARTER))
        AND (u.delete_date IS NULL OR DATE(u.delete_date) > LAST_DAY(q.quarter_start, QUARTER))
      GROUP BY q.tenant_id, q.quarter_start
    ),
    retained AS (
      SELECT cur.tenant_id, cur.quarter_start, COUNT(*) AS retained_users
      FROM uq cur JOIN uq prev ON prev.tenant_id = cur.tenant_id AND prev.user_id = cur.user_id
        AND prev.quarter_start = DATE_SUB(cur.quarter_start, INTERVAL 3 MONTH)
      WHERE cur.is_active AND prev.is_active
      GROUP BY cur.tenant_id, cur.quarter_start
    ),
    knowledge AS (
      SELECT tenant_id, COUNT(DISTINCT employee_id) AS learners, AVG(current_score) AS avg_current
      FROM ${t("analytics_SDE_topic_progress")}
      WHERE ${TENANT} AND LOWER(user_status) = 'active' AND current_score IS NOT NULL
      GROUP BY tenant_id
    ),
    latest AS (SELECT MAX(quarter_start) AS quarter_start FROM q)
    SELECT q.tenant_id,
      CONCAT(CAST(EXTRACT(YEAR FROM q.quarter_start) AS STRING), '-Q', CAST(EXTRACT(QUARTER FROM q.quarter_start) AS STRING)) AS period,
      COALESCE(r.registered_users, q.active_users) AS registered_users,
      q.active_users, q.training_users,
      IF(q.quarter_start = latest.quarter_start, COALESCE(k.learners, 0), 0) AS knowledge_learners,
      IF(q.quarter_start = latest.quarter_start, k.avg_current, NULL) AS avg_knowledge,
      COALESCE(ret.retained_users, 0) AS retained_users,
      COALESCE(p.active_users, 0) AS previous_active_users,
      q.sessions
    FROM q
    CROSS JOIN latest
    LEFT JOIN registered r ON r.tenant_id = q.tenant_id AND r.quarter_start = q.quarter_start
    LEFT JOIN knowledge k ON k.tenant_id = q.tenant_id
    LEFT JOIN retained ret ON ret.tenant_id = q.tenant_id AND ret.quarter_start = q.quarter_start
    LEFT JOIN q p ON p.tenant_id = q.tenant_id AND p.quarter_start = DATE_SUB(q.quarter_start, INTERVAL 3 MONTH)`,
} satisfies Record<string, (t: T) => string>;

export type QueryName = keyof typeof QUERIES;

export function buildSql(name: QueryName, src: Source): string {
  return QUERIES[name](make(src));
}

/** View names a query reads; used to check queries against the schema file without a BigQuery connection. */
export function viewsIn(sql: string): string[] {
  return [...new Set([...sql.matchAll(/`[^`.]+\.[^`.]+\.([^`.]+)`/g)].map((m) => m[1]))];
}
