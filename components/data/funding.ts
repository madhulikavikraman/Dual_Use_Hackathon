// Twist 1 (PRD 17.1, decisions D-26 to D-28): the federal funding pathway, as shown on /evidence and
// included in the evidence JSON for a grant reviewer. Client-safe constants (no server imports).

export interface FundingLeg {
  leg: string;
  program: string;
  who: string;
  size: string;
  fit: string;
}

export interface FundingSource {
  label: string;
  url: string;
}

export const FUNDING: { one_line: string; legs: FundingLeg[]; milestones_note: string; sources: FundingSource[] } = {
  one_line:
    "VoiceFlare launches on an NSF SBIR Phase I grant (up to $305,000, zero equity), sells to counties and cities that buy it with FEMA preparedness grants they already receive (UASI and EMPG), and reaches the defense customer through DoD SBIR topics and the Defense Innovation Unit.",
  legs: [
    {
      leg: "Primary: launch",
      program: "NSF SBIR/STTR Phase I (America's Seed Fund), solicitation NSF 26-510",
      who: "NSF grants the company directly; no equity",
      size:
        "Phase I up to $305,000 for 6 to 18 months; Phase II up to $1,250,000. A Project Pitch comes first; an invitation is valid for the next two deadlines: Nov 4, 2026 and Mar 4, 2027 (then Jul 7, 2027).",
      fit:
        "NSF funds nearly all technology areas without a matching topic. The risk it pays to retire is ours: a 90-second edge read on an alert polygon at 3 AM, and multilingual distress calls classified well enough to reach a person.",
    },
    {
      leg: "Alternative 1: the customer's money",
      program: "FEMA Homeland Security Grant Program (UASI) and Emergency Management Performance Grants (EMPG)",
      who: "FEMA funds states, which pass money to counties and cities, which buy the platform",
      size:
        "FY2026 HSGP about $1.064 billion (UASI about $584 million); FY2026 EMPG about $337 million. Next cycle: FY2027 notices, expected mid-2027.",
      fit:
        "Public alert and warning systems are on FEMA's Authorized Equipment List (04AP-09-ALRT, newer lists 13IT-00-ALRT), and Los Angeles/Long Beach is a UASI urban area. Telecom fees are not allowable, so call minutes go on the operating budget and the grant buys the platform.",
    },
    {
      leg: "Alternative 2: the defense customer",
      program: "DoD SBIR/STTR topics (DSIP) and the Defense Innovation Unit's Commercial Solutions Opening",
      who: "DoD components award SBIR contracts; DIU awards prototype Other Transaction agreements",
      size:
        "SBIR/STTR reauthorized April 13, 2026 (S. 3971) through Sept 30, 2031, after a lapse from Oct 1, 2025; DIU's standing CSO takes solution briefs against posted areas of interest.",
      fit:
        "An installation command post before a base-wide lockdown: zones are housing areas and gates, sentinels are gate posts, and the registry speaks ADPAAS, NFAAS and AFPAAS. We apply with Phase I data in hand.",
    },
  ],
  milestones_note:
    "Phase I milestones, each measured by the product itself on this page: (1) hold opened to a quorum read in under 90 s in at least 80% of drills; (2) 18 of 20 gold-set calls classified correctly across languages and 100% recall on needs_help_now; (3) the delivery canary flags a seeded wrong-polygon or no-delivery failure within 60 s of the send, every drill. Safety bar on all three: zero instructions read that a human did not approve.",
  sources: [
    { label: "NSF SBIR/STTR Phase I solicitation NSF 26-510", url: "https://nsf.gov/funding/opportunities/small-business-innovation-research-small-business-technology/nsf26-510/solicitation" },
    { label: "America's Seed Fund (NSF)", url: "https://seedfund.nsf.gov/" },
    { label: "Crowell & Moring: SBIR/STTR reauthorized after six-month lapse", url: "https://www.crowell.com/en/insights/client-alerts/sbirsttr-programs-reauthorized-after-six-month-lapse" },
    { label: "FEMA FY2026 HSGP notice (SHSP, UASI)", url: "https://www.fema.gov/sites/default/files/documents/fema_gpd_hsgp-nofo-fy2026.pdf" },
    { label: "FEMA FY2026 EMPG notice", url: "https://www.fema.gov/sites/default/files/documents/fema_gpd_empg_nofo_fy2026.pdf" },
    { label: "FEMA Authorized Equipment List 04AP-09-ALRT", url: "https://fema.gov/authorized-equipment-list-item/04ap-09-alrt" },
    { label: "FEMA Authorized Equipment List 13IT-00-ALRT", url: "https://www.fema.gov/ht/authorized-equipment-list-item/13it-00-alrt" },
    { label: "DIU Commercial Solutions Opening (SAM.gov)", url: "https://sam.gov/opp/f20f4abc83ff426d9ed10cb2a2d02a69/view" },
    { label: "Defense Innovation Unit", url: "https://www.diu.mil/" },
    { label: "DHS SBIR (watch list)", url: "https://www.dhs.gov/science-and-technology/sbir" },
  ],
};
