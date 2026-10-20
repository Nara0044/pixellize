/* ═══════════════════════════════════════════════════════════════
   NUDGEBEE — Personalized Briefing form
   Renders the /briefing question set, validates it, and emits the
   payload defined in assets/briefing/payload.schema.json.

   The whole form is driven by the GROUPS config below, so adding /
   renaming an option is a one-line edit. Enum `v` values MUST match
   the JSON Schema definitions.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var SCHEMA_VERSION = "2.0";

  /* Orchestrator endpoint. On localhost the local orchestrator
     (briefing-agent/server.js on :8080) is used, so `node server.js` must be
     running to submit from a dev page; everywhere else it's the deployed
     service (Cloud Run, project nudgebee-dev / us-central1).
     An empty string would mean PREVIEW MODE: validate and render the payload
     on-page without POSTing. */
  /* This form emits schemaVersion 2.0 (the rewritten question set). The
     deployed service only accepts it once briefing-agent is redeployed —
     until then it 422s — so local dev points at the local orchestrator:
     run `node briefing-agent/server.js` before submitting from localhost. */
  var BRIEFING_ENDPOINT = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? "http://localhost:8080/briefing"
    : "https://briefing-agent-137143602736.us-central1.run.app/briefing";

  /* True when this form is running inside the homepage popup iframe. In that
     case we relay results to the parent popup via postMessage instead of
     opening our own result modal — so there's a single popup, not nested ones. */
  var IN_POPUP = window.parent !== window;

  /* Primary-role priority, high → low. First match in the visitor's
     selection becomes `primaryRole` and sets the brief's opener. */
  var ROLE_PRIORITY = [
    "cto_vp_eng", "dir_vp_ops", "platform_k8s_lead", "sre_devops_lead",
    "ai_automation_lead", "finops_cost_owner", "cloud_infra_architect",
    "consultant_msp_si", "role_other"
  ];

  /* section: "about" (Start here) | "stack" (What are you running?)
                                   | "notes" (Anything we'd get wrong?)
     kind:    "single" | "multi" | "text"   (single = radio behaviour)
     max:     cap for multi-selects (optional)
     bands:   split the chip wall into labelled groups (one state key)
     rowOf:   render inside the named ROW_GROUP instead of standalone

     Only `roles`, `pains` and `intent` are required — nothing else blocks
     submit. Every question carries its own `help` sub-label (final copy). */
  var GROUPS = {
    roles: {
      section: "about", kind: "multi", max: 3, required: true,
      label: "What's your role?",
      help: "Pick up to 3 — we know you wear more hats than that.",
      options: [
        { v: "cto_vp_eng", l: "CTO / VP Engineering" },
        { v: "dir_vp_ops", l: "Dir / VP — SRE, DevOps, Infra or Support" },
        { v: "sre_devops_lead", l: "SRE / DevOps Lead" },
        { v: "platform_k8s_lead", l: "Platform or Kubernetes Lead" },
        { v: "ai_automation_lead", l: "AI / Automation Lead or Engineer" },
        { v: "finops_cost_owner", l: "FinOps / Cost Owner" },
        { v: "cloud_infra_architect", l: "Cloud / Infra Architect" },
        { v: "consultant_msp_si", l: "Consultant / MSP / SI partner" },
        { v: "role_other", l: "Other" }
      ]
    },
    pains: {
      section: "about", kind: "multi", max: 3, required: true,
      label: "What's hurting most right now?",
      help: "Pick up to 3 — the brief opens with these.",
      options: [
        { v: "alert_noise_resolution", l: "Alert noise and slow resolution" },
        { v: "troubleshooting_slow", l: "Troubleshooting takes too long" },
        { v: "cloud_costs_climbing", l: "Cloud costs keep climbing" },
        { v: "k8s_day2", l: "Kubernetes Day-2 — upgrades, scaling, reliability" },
        { v: "manual_ops_work", l: "Too much manual ops work" },
        { v: "l1_l2_escalations", l: "L1/L2 volume and escalations" },
        { v: "compliance_security", l: "Compliance and security posture" },
        { v: "just_exploring", l: "Nothing's on fire, just exploring" }
      ]
    },
    intent: {
      section: "about", kind: "single", required: true,
      label: "What are you going to do with this?",
      help: "Decides the tone — and whether page 4 is ROI math or an architecture diagram.",
      options: [
        { v: "exploring_self", l: "Just exploring for myself" },
        { v: "internal_case", l: "Building an internal case" }
      ]
    },

    /* The four "How big…" lines. Each is an independent single-select that
       renders inside the `size` row-group, not as a question of its own. */
    footprint: {
      section: "about", kind: "single", rowOf: "size", rowLabel: "Footprint",
      options: [
        { v: "single_cloud", l: "Single cloud" },
        { v: "multi_cloud", l: "Multi-cloud" },
        { v: "hybrid", l: "Hybrid (cloud + on-prem)" },
        { v: "on_prem_only", l: "On-prem only" }
      ]
    },
    clusters: {
      section: "about", kind: "single", rowOf: "size", rowLabel: "Clusters",
      options: [
        { v: "under_5", l: "Under 5" },
        { v: "5_20", l: "5–20" },
        { v: "20_plus", l: "20+" },
        { v: "hundreds", l: "Hundreds" },
        { v: "no_k8s", l: "Not running Kubernetes" }
      ]
    },
    regions: {
      section: "about", kind: "single", rowOf: "size", rowLabel: "Regions",
      options: [
        { v: "single_region", l: "Single region" },
        { v: "multi_region", l: "Multi-region" }
      ]
    },
    regulated: {
      section: "about", kind: "single", rowOf: "size", rowLabel: "Regulated",
      options: [
        { v: "regulated", l: "Regulated (audits, residency)" },
        { v: "not_regulated", l: "Not regulated" }
      ]
    },

    industry: {
      section: "about", kind: "single",
      label: "What business are you in?",
      help: "So we use your examples, not ours.",
      options: [
        { v: "tech_saas", l: "Tech / SaaS" },
        { v: "banking_finserv_insurance", l: "Banking / FinServ / Insurance" },
        { v: "healthcare_life_sciences", l: "Healthcare / Life Sciences" },
        { v: "telecom", l: "Telecom" },
        { v: "retail_ecommerce", l: "Retail / E-commerce" },
        { v: "manufacturing_industrial", l: "Manufacturing / Industrial" },
        { v: "ai_ml_company", l: "AI / ML company" },
        { v: "public_sector", l: "Public Sector" },
        { v: "msp_consulting", l: "MSP / Consulting" },
        { v: "industry_other", l: "Other" }
      ]
    },
    ownership: {
      section: "about", kind: "single",
      label: "Who keeps it running day to day?",
      help: "In-house, outsourced, or the awkward middle.",
      options: [
        { v: "small_team_all_hats", l: "A small team wearing every hat" },
        { v: "dedicated_inhouse_sre", l: "A dedicated in-house SRE / Ops team" },
        { v: "mostly_inhouse_some_msp", l: "Mostly in-house, MSP for some of it" },
        { v: "mostly_msp_oversight", l: "Mostly MSP, we keep oversight" },
        { v: "fully_outsourced", l: "Fully outsourced" },
        { v: "devs_run_what_they_build", l: "Devs run what they build, no central ops" }
      ]
    },
    competitors: {
      section: "about", kind: "multi", max: 3,
      label: "What are we up against?",
      help: "Tell us and the brief gets honest instead of generically better.",
      options: [
        { v: "manual_today", l: "Doing it manually today" },
        { v: "homegrown_scripts", l: "Homegrown scripts and runbooks" },
        { v: "apm_vendor_ai", l: "Datadog / Dynatrace / New Relic AI" },
        { v: "itsm_aiops", l: "ServiceNow / PagerDuty AIOps" },
        { v: "greenfield", l: "Nothing yet, greenfield" }
      ]
    },
    outcomes: {
      section: "about", kind: "multi", max: 3,
      label: "Six months in, what makes this a win?",
      help: "We'll close the brief on these, with numbers.",
      options: [
        { v: "faster_resolution", l: "Incidents resolved visibly faster" },
        { v: "lower_cloud_bill", l: "Cloud bill down" },
        { v: "fewer_escalations", l: "Fewer L1/L2 escalations" },
        { v: "better_oncall", l: "On-call stops being awful" },
        { v: "more_automation", l: "More automation of ops tasks" },
        { v: "agentic_fast_track", l: "Fast-tracking AI agents and agentic ops" }
      ]
    },

    cloud: {
      section: "stack", kind: "multi", label: "Cloud",
      help: "Where your workloads actually live.",
      options: [
        { v: "aws", l: "AWS" }, { v: "azure", l: "Azure" }, { v: "gcp", l: "GCP" },
        { v: "oci", l: "OCI" }, { v: "vmware_tanzu", l: "VMware / Tanzu" },
        { v: "on_prem_bare_metal", l: "On-prem / bare metal" },
        { v: "edge", l: "Edge" }, { v: "cloud_other", l: "Other" }
      ]
    },
    kubernetes: {
      section: "stack", kind: "multi", label: "Kubernetes",
      help: "Managed, self-run, or not at all.",
      options: [
        { v: "eks", l: "EKS" }, { v: "aks", l: "AKS" }, { v: "gke", l: "GKE" },
        { v: "openshift_rancher_tanzu", l: "OpenShift / Rancher / Tanzu" },
        { v: "k3s_edge", l: "K3s / edge" },
        { v: "ecs_fargate", l: "ECS / Fargate (no K8s)" },
        { v: "not_using_k8s", l: "Not using Kubernetes" },
        { v: "k8s_other", l: "Other" }
      ]
    },
    observability: {
      section: "stack", kind: "multi", label: "Observability",
      help: "Everything you have, not just the parts you like.",
      /* One question, three labelled bands — OSS ordered by adoption. */
      bands: [
        {
          l: "Open source",
          options: [
            { v: "prometheus", l: "Prometheus" }, { v: "grafana", l: "Grafana" },
            { v: "opentelemetry", l: "OpenTelemetry" }, { v: "elk_opensearch", l: "ELK / OpenSearch" },
            { v: "loki", l: "Loki" }, { v: "jaeger", l: "Jaeger" },
            { v: "thanos_mimir_vm", l: "Thanos / Mimir / VictoriaMetrics" },
            { v: "zabbix_nagios", l: "Zabbix / Nagios" }
          ]
        },
        {
          l: "Cloud native",
          options: [
            { v: "cloudwatch", l: "CloudWatch" }, { v: "azure_monitor", l: "Azure Monitor" },
            { v: "google_cloud_ops", l: "Google Cloud Ops" }
          ]
        },
        {
          l: "Commercial",
          options: [
            { v: "datadog", l: "Datadog" }, { v: "new_relic", l: "New Relic" },
            { v: "dynatrace", l: "Dynatrace" }, { v: "splunk", l: "Splunk" },
            { v: "grafana_cloud", l: "Grafana Cloud" }, { v: "appdynamics", l: "AppDynamics" },
            { v: "honeycomb", l: "Honeycomb" }, { v: "obs_other", l: "Other" }
          ]
        }
      ]
    },
    tickets: {
      section: "stack", kind: "multi", label: "Tickets & on-call",
      help: "Where incidents land today, and who gets woken up.",
      options: [
        { v: "jira", l: "Jira" }, { v: "servicenow", l: "ServiceNow" },
        { v: "pagerduty", l: "PagerDuty" }, { v: "opsgenie", l: "Opsgenie" },
        { v: "github_gitlab_issues", l: "GitHub / GitLab Issues" },
        { v: "zendesk", l: "Zendesk" }, { v: "freshservice", l: "Freshservice" },
        { v: "bmc_remedy", l: "BMC Remedy" }, { v: "incident_io", l: "incident.io" },
        { v: "rootly", l: "Rootly" }, { v: "tickets_other", l: "Other" }
      ]
    },
    codeCi: {
      section: "stack", kind: "multi", label: "Code & CI",
      help: "How changes get shipped — it tells us what the agent can safely touch.",
      options: [
        { v: "github_actions", l: "GitHub / Actions" }, { v: "gitlab_ci", l: "GitLab CI" },
        { v: "jenkins", l: "Jenkins" }, { v: "azure_devops", l: "Azure DevOps" },
        { v: "argocd_flux", l: "ArgoCD / Flux" }, { v: "ci_other", l: "Other" }
      ]
    },
    deployment: {
      section: "stack", kind: "single", label: "Where can this run?",
      help: "Rough answer is fine — we'll cover the details in the brief.",
      options: [
        { v: "saas_fine", l: "SaaS is fine" },
        { v: "own_cloud_or_dc", l: "In our own cloud account or data centre" },
        { v: "air_gapped", l: "Air-gapped, nothing leaves" }
      ]
    },

    freeText: {
      section: "notes", kind: "text", maxLength: 600,
      label: "Tell us in your words",
      help: "One sentence is plenty. Nubi reads it.",
      placeholder: "e.g. how you'd handle our 200-cluster mess without another agent per node — and whether this replaces our Datadog bill or sits next to it."
    }
  };

  /* Row-groups render several independent single-selects under one heading. */
  var ROW_GROUPS = {
    size: {
      section: "about",
      label: "How big is the thing you're running?",
      help: "Ballpark is fine, nobody's auditing this. Answer any line, skip the rest.",
      rows: ["footprint", "clusters", "regions", "regulated"]
    }
  };

  var STACK_KEYS = ["cloud", "kubernetes", "observability", "tickets", "codeCi"];
  var SIZE_KEYS = ROW_GROUPS.size.rows;

  /* Selection state: group key -> array of selected `v` values
     (or a string for kind:"text"). */
  var state = {};
  Object.keys(GROUPS).forEach(function (k) {
    state[k] = GROUPS[k].kind === "text" ? "" : [];
  });

  /* ── Rendering ─────────────────────────────────────────────── */

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* ── Icons ─────────────────────────────────────────────────── */
  /* Small line icons rendered on every chip. Each entry below is the inner
     markup of a 24×24 stroke icon; svg() wraps it with shared attributes.
     Options map to an icon by value (VALUE_ICON); anything unmapped falls back
     to its group's default (GROUP_ICON), so new options always get an icon. */
  function svg(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }
  var ICONS = {
    briefcase: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7"/><path d="M3 12.5h18"/>'),
    loop: svg('<path d="M4 12a8 8 0 0 1 13.5-5.8L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.5 5.8L4 16"/><path d="M4 20v-4h4"/>'),
    dollar: svg('<circle cx="12" cy="12" r="9"/><path d="M12 6.5v11"/><path d="M15 9a3.2 2.6 0 0 0-3-1.4c-1.6 0-2.9.9-2.9 2s1.3 1.9 2.9 1.9 3 .8 3 2-1.3 2-3 2A3.2 2.6 0 0 1 9 14"/>'),
    hexagon: svg('<path d="M12 2.5l8.5 4.9v9.2L12 21.5 3.5 16.6V7.4z"/><path d="M12 8l3.9 2.25v4.5L12 17l-3.9-2.25v-4.5z"/>'),
    layers: svg('<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>'),
    code: svg('<path d="M8.5 8L4 12l4.5 4"/><path d="M15.5 8l4.5 4-4.5 4"/><path d="M13.5 6l-3 12"/>'),
    headset: svg('<path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M20 19a3.5 3.5 0 0 1-3.5 3H13"/>'),
    monitor: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8.5 20h7"/><path d="M12 16v4"/>'),
    shield: svg('<path d="M12 3l7 3v5c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V6z"/>'),
    heart: svg('<path d="M12 20s-6.8-4.2-6.8-9.3A3.8 3.8 0 0 1 12 7.4a3.8 3.8 0 0 1 6.8 3.3C18.8 15.8 12 20 12 20z"/>'),
    antenna: svg('<path d="M5.5 18a9 9 0 0 1 0-12"/><path d="M18.5 6a9 9 0 0 1 0 12"/><path d="M8.5 15a5 5 0 0 1 0-6"/><path d="M15.5 9a5 5 0 0 1 0 6"/><circle cx="12" cy="12" r="1.4"/>'),
    factory: svg('<path d="M3 21V10l6 4V10l6 4V6l6 4v11z"/><path d="M3 21h18"/><path d="M7 21v-3M12 21v-3M17 21v-3"/>'),
    landmark: svg('<path d="M3.5 21h17"/><path d="M5 21V10.5M9.5 21V10.5M14.5 21V10.5M19 21V10.5"/><path d="M12 3l8 5H4z"/>'),
    grid: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1.3"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.3"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.3"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.3"/>'),
    seedling: svg('<path d="M12 21v-7"/><path d="M12 14c-1-3.5-4-4.5-7-4 0 3.5 3 5 7 4z"/><path d="M12 12c.6-3 3-4.5 6-4 .2 3-2 4.8-6 4z"/>'),
    chart: svg('<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 17v-4M12.5 17V9M17 17v-6"/>'),
    building: svg('<rect x="4.5" y="3" width="15" height="18" rx="1.5"/><path d="M9 7h.01M12 7h.01M15 7h.01M9 11h.01M12 11h.01M15 11h.01"/><path d="M10.5 21v-3h3v3"/>'),
    globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.4 2.5 3.6 5.7 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.7-3.6-9S9.6 5.5 12 3z"/>'),
    bell: svg('<path d="M6 9a6 6 0 0 1 12 0c0 5 2.2 6.5 2.2 6.5H3.8S6 14 6 9z"/><path d="M10 19a2 2 0 0 0 4 0"/>'),
    trending: svg('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/><path d="M12 15v2.5"/>'),
    cpu: svg('<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/><rect x="10" y="10" width="4" height="4" rx="1"/><path d="M9.5 3v2.5M14.5 3v2.5M9.5 18.5V21M14.5 18.5V21M3 9.5h2.5M3 14.5h2.5M18.5 9.5H21M18.5 14.5H21"/>'),
    puzzle: svg('<path d="M10.5 4.5a1.5 1.5 0 0 1 3 0V6h3a1 1 0 0 1 1 1v3h1.5a1.5 1.5 0 0 1 0 3H17.5v3a1 1 0 0 1-1 1h-3v1.5a1.5 1.5 0 0 1-3 0V17H7a1 1 0 0 1-1-1v-3H4.5a1.5 1.5 0 0 1 0-3H6V7a1 1 0 0 1 1-1h3.5z"/>'),
    server: svg('<rect x="3" y="4.5" width="18" height="6.5" rx="1.5"/><rect x="3" y="13" width="18" height="6.5" rx="1.5"/><path d="M6.5 7.75h.01M6.5 16.25h.01"/><path d="M9.5 7.75h4M9.5 16.25h4"/>'),
    cloud: svg('<path d="M7 18.5a4.5 4.5 0 0 1-.9-8.9A6 6 0 0 1 17.5 10.2 3.9 3.9 0 0 1 17 18.5z"/>'),
    xcircle: svg('<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>'),
    eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
    activity: svg('<path d="M3 12h3.5l2.5 7 4-15 2.5 8H21"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16 16"/>'),
    ticket: svg('<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v2a2 2 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2 2 0 0 0 0-5z"/><path d="M14 6.5v11"/>'),
    alert: svg('<path d="M12 3.5l8.5 15h-17z"/><path d="M12 10v4"/><path d="M12 16.5h.01"/>'),
    gitbranch: svg('<circle cx="6.5" cy="6" r="2.3"/><circle cx="6.5" cy="18" r="2.3"/><circle cx="17.5" cy="8" r="2.3"/><path d="M6.5 8.3v7.4"/><path d="M17.5 10.3c0 4-4.5 3.5-6.5 5.5"/>'),
    gitcommit: svg('<circle cx="12" cy="12" r="3.4"/><path d="M3 12h5.6M15.4 12H21"/>'),
    users: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><path d="M16.5 5.2a3.2 3.2 0 0 1 0 5.6"/><path d="M17.5 14.2a6 6 0 0 1 3.5 5.3"/>'),
    wrench: svg('<path d="M15.5 3.5a5.5 5.5 0 0 0-5 7.7L3.8 17.9a2 2 0 1 0 2.8 2.8l6.7-6.7a5.5 5.5 0 0 0 6.9-7.3l-3 3-2.8-.7-.7-2.8 3-3a5.5 5.5 0 0 0-1.2-.7z"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 6.8V12l3.4 2"/>'),
    pin: svg('<path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 1 0-13 0c0 5 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.4"/>'),
    cart: svg('<circle cx="9.5" cy="19.5" r="1.6"/><circle cx="17.5" cy="19.5" r="1.6"/><path d="M3 4h2.2l2.4 11h11L21 7.5H6"/>'),
    moon: svg('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'),
    rocket: svg('<path d="M13 4.5c3.5-2 6.5-1.5 6.5-1.5s.5 3-1.5 6.5c-1.7 3-4.6 5.3-7 6.5L7 12c1.2-2.4 3.5-5.3 6-7.5z"/><circle cx="14.5" cy="9.5" r="1.6"/><path d="M7 17c-1.5 1.5-1.2 4-1.2 4s2.5.3 4-1.2"/>'),
    compass: svg('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
    target: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2"/>'),
    flag: svg('<path d="M6 21V4"/><path d="M6 4.5h11l-2 3.5 2 3.5H6"/>'),
    dot: svg('<circle cx="12" cy="12" r="3.2"/>')
  };
  /* Per-option icon assignments. Unlisted values fall back to GROUP_ICON. */
  var VALUE_ICON = {
    /* roles */
    cto_vp_eng: "briefcase", dir_vp_ops: "users", sre_devops_lead: "loop",
    platform_k8s_lead: "hexagon", ai_automation_lead: "cpu", finops_cost_owner: "dollar",
    cloud_infra_architect: "layers", consultant_msp_si: "puzzle", role_other: "grid",
    /* pains */
    alert_noise_resolution: "bell", troubleshooting_slow: "search",
    cloud_costs_climbing: "trending", k8s_day2: "hexagon", manual_ops_work: "wrench",
    l1_l2_escalations: "headset", compliance_security: "lock", just_exploring: "eye",
    /* intent */
    exploring_self: "compass", internal_case: "chart",
    /* size — footprint / clusters / regions / regulated */
    single_cloud: "cloud", multi_cloud: "layers", hybrid: "server", on_prem_only: "building",
    under_5: "hexagon", "5_20": "hexagon", "20_plus": "hexagon", hundreds: "grid", no_k8s: "xcircle",
    single_region: "pin", multi_region: "globe",
    regulated: "shield", not_regulated: "xcircle",
    /* industry */
    tech_saas: "monitor", banking_finserv_insurance: "shield", healthcare_life_sciences: "heart",
    telecom: "antenna", retail_ecommerce: "cart", manufacturing_industrial: "factory",
    ai_ml_company: "cpu", public_sector: "landmark", msp_consulting: "puzzle", industry_other: "grid",
    /* ownership */
    small_team_all_hats: "seedling", dedicated_inhouse_sre: "users",
    mostly_inhouse_some_msp: "layers", mostly_msp_oversight: "eye",
    fully_outsourced: "puzzle", devs_run_what_they_build: "code",
    /* competitors */
    manual_today: "wrench", homegrown_scripts: "code", apm_vendor_ai: "eye",
    itsm_aiops: "ticket", greenfield: "seedling",
    /* outcomes */
    faster_resolution: "clock", lower_cloud_bill: "dollar", fewer_escalations: "headset",
    better_oncall: "moon", more_automation: "loop", agentic_fast_track: "rocket",
    /* cloud */
    aws: "cloud", azure: "cloud", gcp: "cloud", oci: "cloud", vmware_tanzu: "server",
    on_prem_bare_metal: "server", edge: "globe", cloud_other: "grid",
    /* kubernetes */
    eks: "hexagon", aks: "hexagon", gke: "hexagon", openshift_rancher_tanzu: "hexagon",
    k3s_edge: "globe", ecs_fargate: "layers", not_using_k8s: "xcircle", k8s_other: "grid",
    /* observability */
    prometheus: "activity", grafana: "chart", opentelemetry: "activity",
    elk_opensearch: "search", loki: "search", jaeger: "gitcommit",
    thanos_mimir_vm: "activity", zabbix_nagios: "monitor",
    cloudwatch: "cloud", azure_monitor: "cloud", google_cloud_ops: "cloud",
    datadog: "eye", new_relic: "eye", dynatrace: "eye", splunk: "search",
    grafana_cloud: "cloud", appdynamics: "activity", honeycomb: "hexagon", obs_other: "grid",
    /* tickets & on-call */
    jira: "ticket", servicenow: "ticket", pagerduty: "alert", opsgenie: "alert",
    github_gitlab_issues: "gitbranch", zendesk: "headset", freshservice: "headset",
    bmc_remedy: "ticket", incident_io: "alert", rootly: "alert", tickets_other: "grid",
    /* code & CI */
    github_actions: "gitbranch", gitlab_ci: "gitbranch", jenkins: "loop",
    azure_devops: "loop", argocd_flux: "gitcommit", ci_other: "grid",
    /* deployment */
    saas_fine: "cloud", own_cloud_or_dc: "server", air_gapped: "lock"
  };
  var GROUP_ICON = {
    roles: "briefcase", pains: "alert", intent: "compass",
    footprint: "cloud", clusters: "hexagon", regions: "globe", regulated: "shield",
    industry: "grid", ownership: "users", competitors: "target", outcomes: "flag",
    cloud: "cloud", kubernetes: "hexagon", observability: "eye",
    tickets: "ticket", codeCi: "gitbranch", deployment: "server"
  };
  function iconFor(key, opt) {
    return ICONS[VALUE_ICON[opt.v] || GROUP_ICON[key] || "dot"] || ICONS.dot;
  }

  function hintFor(g) {
    if (g.help) return g.help;
    if (g.kind === "single") return "Pick one";
    if (g.max) return "Pick up to " + g.max;
    return "Select any that apply";
  }

  /* One toggleable chip. `q` is the element refreshChips() re-scans when this
     group's selection changes — the whole question for a normal group, or just
     the sub-row for a row-group member. */
  function chipFor(key, opt, q) {
    var c = el("button", "brf-chip");
    c.type = "button";
    c.setAttribute("data-value", opt.v);
    c.setAttribute("aria-pressed", "false");
    c.appendChild(el("span", "brf-chip-ic", iconFor(key, opt)));
    var l = el("span", "brf-chip-l");
    l.textContent = opt.l;
    c.appendChild(l);
    c.addEventListener("click", function (e) { e.preventDefault(); selectOption(key, opt.v, q); });
    return c;
  }

  function chipRow(key, options, q) {
    var chips = el("div", "brf-chips");
    chips.setAttribute("role", GROUPS[key].kind === "single" ? "radiogroup" : "group");
    options.forEach(function (opt) { chips.appendChild(chipFor(key, opt, q)); });
    return chips;
  }

  /* The one free-text field on the form. State is a string, not an array. */
  function textFieldFor(key, g) {
    var ta = el("textarea", "brf-textarea");
    ta.rows = 3;
    ta.maxLength = g.maxLength || 600;
    ta.placeholder = g.placeholder || "";
    ta.addEventListener("input", function () { state[key] = ta.value; });
    return ta;
  }

  // Each question renders its options inline as a row of toggleable chips —
  // no dropdowns, everything visible at a glance. Single-select behaves like a
  // radio group (one active); multi toggles and honours `max`. A group with
  // `bands` splits its chips into labelled sub-groups under one state key.
  function renderGroup(key) {
    var g = GROUPS[key];
    var wrap = el("div", "brf-q" + (g.kind === "single" ? " is-single" : ""));
    wrap.setAttribute("data-group", key);

    var label = el("div", "brf-q-label");
    label.appendChild(el("span", "brf-q-title", g.label + (g.required ? ' <span class="brf-req">*</span>' : "")));
    var help = el("span", "brf-q-help");
    help.textContent = hintFor(g);
    label.appendChild(help);
    wrap.appendChild(label);

    var field = el("div", "brf-q-field");

    if (g.kind === "text") {
      field.appendChild(textFieldFor(key, g));
    } else if (g.bands) {
      g.bands.forEach(function (band) {
        var b = el("div", "brf-band");
        b.appendChild(el("span", "brf-band-l", band.l));
        b.appendChild(chipRow(key, band.options, wrap));
        field.appendChild(b);
      });
    } else {
      field.appendChild(chipRow(key, g.options, wrap));
    }

    var err = el("div", "brf-q-error", "Please make a selection.");
    err.hidden = true;
    field.appendChild(err);

    wrap.appendChild(field);
    return wrap;
  }

  /* Several independent single-selects under one shared heading ("How big is
     the thing you're running?"). Each line keeps its own state key, so it can
     be answered or skipped on its own. */
  function renderRowGroup(key) {
    var rg = ROW_GROUPS[key];
    var wrap = el("div", "brf-q brf-q-rows");
    wrap.setAttribute("data-rowgroup", key);

    var label = el("div", "brf-q-label");
    label.appendChild(el("span", "brf-q-title", rg.label));
    var help = el("span", "brf-q-help");
    help.textContent = rg.help;
    label.appendChild(help);
    wrap.appendChild(label);

    var field = el("div", "brf-q-field");
    rg.rows.forEach(function (rowKey) {
      var row = el("div", "brf-subrow is-single");
      row.setAttribute("data-group", rowKey);
      row.appendChild(el("span", "brf-subrow-l", GROUPS[rowKey].rowLabel));
      row.appendChild(chipRow(rowKey, GROUPS[rowKey].options, row));
      field.appendChild(row);
    });

    wrap.appendChild(field);
    return wrap;
  }

  function selectOption(key, value, q) {
    var g = GROUPS[key];
    var arr = state[key];
    var idx = arr.indexOf(value);

    if (g.kind === "single") {
      /* Clicking the active chip clears it — picking one shouldn't be a
         one-way door. Required groups are still caught at submit. */
      state[key] = idx > -1 ? [] : [value];
      refreshChips(q, key);
      clearError(key);
      return;
    }
    if (idx > -1) {
      arr.splice(idx, 1);
    } else {
      if (g.max && arr.length >= g.max) { flashMax(key, g.max); return; }
      arr.push(value);
    }
    refreshChips(q, key);
    clearError(key);
  }

  /* Sync a question's chips to state[key]. */
  function refreshChips(q, key) {
    var arr = state[key];
    Array.prototype.forEach.call(q.querySelectorAll(".brf-chip"), function (c) {
      c.setAttribute("aria-pressed", arr.indexOf(c.getAttribute("data-value")) > -1 ? "true" : "false");
    });
  }

  /* Row-group members carry data-group on their sub-row, not on a .brf-q —
     so match the attribute alone and let each helper no-op on what it lacks. */
  function questionEl(key) {
    return document.querySelector('[data-group="' + key + '"]');
  }

  function flashMax(key, max) {
    var q = questionEl(key);
    if (!q) return;
    var labelEl = q.querySelector(".brf-q-label");
    if (!labelEl) return;
    var hint = q.querySelector(".brf-max-hint") || (function () {
      var h = el("div", "brf-max-hint", "You can pick up to " + max + ".");
      labelEl.appendChild(h);
      return h;
    })();
    hint.classList.remove("show"); void hint.offsetWidth; hint.classList.add("show");
    var chips = q.querySelector(".brf-chips");
    if (chips) { chips.classList.remove("shake"); void chips.offsetWidth; chips.classList.add("shake"); }
  }

  function clearError(key) {
    var q = questionEl(key);
    if (!q) return;
    q.classList.remove("has-error");
    var e = q.querySelector(".brf-q-error");
    if (e) e.hidden = true;
  }

  function showError(key) {
    var q = questionEl(key);
    if (!q) return;
    q.classList.add("has-error");
    var e = q.querySelector(".brf-q-error");
    if (e) e.hidden = false;
  }

  /* ── Payload ───────────────────────────────────────────────── */

  function primaryRole(roles) {
    for (var i = 0; i < ROLE_PRIORITY.length; i++) {
      if (roles.indexOf(ROLE_PRIORITY[i]) > -1) return ROLE_PRIORITY[i];
    }
    return roles[0] || null;
  }

  function collectUtm() {
    var p = new URLSearchParams(window.location.search);
    var utm = {};
    ["source", "medium", "campaign", "term", "content"].forEach(function (k) {
      var val = p.get("utm_" + k);
      if (val) utm[k] = val;
    });
    return utm;
  }

  /* No contact is collected up front — the form is anonymous. The visitor
     self-identifies later, if they want, via "Email it to me" in the popup
     (POST /email), which is the only place an address is needed. */
  function buildPayload() {
    var stack = {};
    STACK_KEYS.forEach(function (k) { if (state[k].length) stack[k] = state[k].slice(); });

    /* Only the "How big…" lines the visitor actually answered — every line is
       independently skippable, so an unanswered one is omitted, not null. */
    var size = {};
    SIZE_KEYS.forEach(function (k) { if (state[k].length) size[k] = state[k][0]; });

    return {
      schemaVersion: SCHEMA_VERSION,
      aboutYou: {
        roles: state.roles.slice(),
        primaryRole: primaryRole(state.roles),
        pains: state.pains.slice(),
        intent: state.intent[0] || null,
        industry: state.industry[0] || null,
        ownership: state.ownership[0] || null,
        competitors: state.competitors.slice(),
        outcomes: state.outcomes.slice(),
        deployment: state.deployment[0] || null,
        size: size
      },
      notes: (state.freeText || "").trim(),
      stack: stack,
      meta: {
        referrer: document.referrer || "",
        landingPath: window.location.pathname,
        userAgent: navigator.userAgent,
        submittedAtClient: new Date().toISOString(),
        utm: collectUtm()
      }
    };
  }

  /* ── Validation ────────────────────────────────────────────── */

  function validate(form) {
    var firstBad = null;

    Object.keys(GROUPS).forEach(function (key) {
      if (GROUPS[key].required && state[key].length === 0) {
        showError(key);
        if (!firstBad) firstBad = document.querySelector('.brf-q[data-group="' + key + '"]');
      }
    });

    return firstBad;
  }

  /* ── Submit ────────────────────────────────────────────────── */

  function onSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var firstBad = validate(form);
    if (firstBad) {
      firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
      if (firstBad.focus) firstBad.focus({ preventScroll: true });
      return;
    }

    var payload = buildPayload();

    // Analytics — mirror the site's GTM pattern.
    (window.dataLayer = window.dataLayer || []).push({
      event: "briefing_submit",
      briefing_primary_role: payload.aboutYou.primaryRole,
      briefing_industry: payload.aboutYou.industry,
      briefing_pain_count: payload.aboutYou.pains.length
    });

    var btn = form.querySelector(".brf-submit");

    if (!BRIEFING_ENDPOINT) {
      // Preview mode: show the assembled payload in the modal.
      openModal();
      modalShowPreview(payload);
      // eslint-disable-next-line no-console
      console.log("[briefing] payload", payload);
      return;
    }

    btn.disabled = true;
    btn.classList.add("is-loading");
    if (IN_POPUP) postToParent({ type: "nb-briefing:loading" });
    else openModal();

    fetch(BRIEFING_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
      .then(function (data) {
        btn.disabled = false;
        btn.classList.remove("is-loading");
        if (data && data.landingUrl) {
          if (IN_POPUP) postToParent({ type: "nb-briefing:ready", landingUrl: data.landingUrl, pdfUrl: data.pdfUrl, id: data.id });
          else modalShowBrief(data.landingUrl, data.pdfUrl);
        } else {
          var pending = "Your brief is taking a little longer than expected — please try again in a moment.";
          if (IN_POPUP) postToParent({ type: "nb-briefing:error", message: pending });
          else modalShowError(pending);
        }
      })
      .catch(function () {
        btn.disabled = false;
        btn.classList.remove("is-loading");
        var oops = "Something went wrong generating your brief. Please try again.";
        if (IN_POPUP) postToParent({ type: "nb-briefing:error", message: oops });
        else modalShowError(oops);
      });
  }

  function postToParent(msg) {
    try { window.parent.postMessage(msg, "*"); } catch (e) { /* noop */ }
  }

  /* ── Brief modal (popup) ───────────────────────────────────── */

  /* Friendly rotating loader lines, ordered start → finish. When the list
     runs out (long generation), keep cycling the last few "almost there"
     lines instead of restarting from the top. */
  var LOADER_MSGS = [
    "Reading your answers…",
    "Matching your role to the right talking points…",
    "Skimming our knowledge base for the good bits…",
    "Tailoring this to your stack…",
    "Finding what's relevant to your industry…",
    "Cross-checking your priorities…",
    "Connecting the dots between your tools…",
    "Herding a few Kubernetes pods…",
    "Politely asking the cluster for insights…",
    "Turning YAML into plain English…",
    "Skipping the generic stuff you've read before…",
    "Writing the part your finance team will like…",
    "Trimming the fluff…",
    "Making it sound less like marketing…",
    "Brewing a fresh brief…",
    "Sharpening the pencils…",
    "Asking the robots to type faster…",
    "Weaving in your priorities…",
    "Double-checking the numbers…",
    "Lining up the sections…",
    "Making the tables look presentable…",
    "Packing it into a few tidy pages…",
    "Running a quick sanity check…",
    "Checking everything twice…",
    "Giving it one last read…",
    "Adding the finishing touches…",
    "Rendering your shareable pages…",
    "Warming up the PDF printer…",
    "Nearly there — formatting nicely…",
    "Still faster than writing it yourself…",
    "Good things take a few seconds…",
    "Taking a touch longer than usual — hang tight…",
    "Almost done — promise…",
    "Any moment now…"
  ];
  var LOADER_TAIL = 4, LOADER_TICK_MS = 2400;
  var loaderTimer = null, loaderIdx = 0;

  function startLoaderMsgs() {
    var p = modalLoading && modalLoading.querySelector("p");
    if (!p) return;
    stopLoaderMsgs();
    loaderIdx = 0;
    p.textContent = LOADER_MSGS[0];
    loaderTimer = window.setInterval(function () {
      if (modalLoading.hidden) return stopLoaderMsgs();
      loaderIdx++;
      if (loaderIdx >= LOADER_MSGS.length) loaderIdx = LOADER_MSGS.length - LOADER_TAIL;
      p.textContent = LOADER_MSGS[loaderIdx];
    }, LOADER_TICK_MS);
  }
  function stopLoaderMsgs() {
    if (loaderTimer) { window.clearInterval(loaderTimer); loaderTimer = null; }
  }

  var modal, modalFrame, modalPreview, modalLoading, modalError, modalOpen;

  function setupModal() {
    modal = document.getElementById("brfModal");
    if (!modal) return;
    modalFrame = document.getElementById("brfModalFrame");
    modalPreview = document.getElementById("brfModalPreview");
    modalLoading = document.getElementById("brfModalLoading");
    modalError = document.getElementById("brfModalError");
    modalOpen = document.getElementById("brfModalOpen");
    Array.prototype.forEach.call(modal.querySelectorAll("[data-close]"), function (el) {
      el.addEventListener("click", closeModal);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });
  }

  function openModal() {
    modalFrame.hidden = true; modalFrame.removeAttribute("src");
    modalPreview.hidden = true; modalPreview.textContent = "";
    modalError.hidden = true; modalError.textContent = "";
    modalOpen.hidden = true; modalOpen.removeAttribute("href");
    modalLoading.hidden = false;
    startLoaderMsgs();
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.hidden = true;
    modalFrame.removeAttribute("src");
    stopLoaderMsgs();
    document.body.style.overflow = "";
  }

  // Show the generated brief in an iframe (reuses the orchestrator's page),
  // keeping the shareable link + PDF as header actions.
  function modalShowBrief(landingUrl, pdfUrl) {
    modalLoading.hidden = true;
    stopLoaderMsgs();
    modalFrame.src = landingUrl;
    modalFrame.hidden = false;
    modalOpen.href = landingUrl; modalOpen.hidden = false;
    /* No PDF action in this header: the brief inside the iframe renders its
       own Download PDF button, and two identical buttons stacked in one view
       read as a bug. "Open full page" stays — the iframe can't offer that. */
  }

  function modalShowPreview(payload) {
    modalLoading.hidden = true;
    stopLoaderMsgs();
    modalPreview.textContent = JSON.stringify(payload, null, 2);
    modalPreview.hidden = false;
  }

  function modalShowError(msg) {
    modalLoading.hidden = true;
    stopLoaderMsgs();
    modalError.textContent = msg;
    modalError.hidden = false;
  }

  /* ── Init ──────────────────────────────────────────────────── */

  document.addEventListener("DOMContentLoaded", function () {
    var mounts = {
      about: document.querySelector('[data-groups="about"]'),
      stack: document.querySelector('[data-groups="stack"]'),
      notes: document.querySelector('[data-groups="notes"]')
    };
    if (!mounts.about || !mounts.stack || !mounts.notes) return;

    /* Row-group members render inside their parent question, in declaration
       order — the row-group takes the slot of its first member. */
    Object.keys(GROUPS).forEach(function (key) {
      var g = GROUPS[key];
      var mount = mounts[g.section] || mounts.about;
      if (!g.rowOf) return mount.appendChild(renderGroup(key));
      if (ROW_GROUPS[g.rowOf].rows[0] === key) mount.appendChild(renderRowGroup(g.rowOf));
    });

    var form = document.getElementById("briefingForm");
    form.addEventListener("submit", onSubmit);
    setupModal();
  });
})();
