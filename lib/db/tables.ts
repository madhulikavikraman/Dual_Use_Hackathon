import type {
  AlertItem, Call, Campaign, Canary, Cluster, Dispatch, EvacPlan, HelpRequest, Hold, Household, HouseholdStatus, Intent,
  LedgerEntry, LocationFix, LocationShare, Meta, PickupRun, Proposal, Report, SimRun, TwistEntry, Zone, ZoneEvent,
} from "@/lib/types";

/** Every table and its row type. The Supabase migrations create the same tables. */
export interface Tables {
  households: Household;
  campaigns: Campaign;
  calls: Call;
  household_status: HouseholdStatus;
  alerts_feed: AlertItem;
  twist_log: TwistEntry;
  sim_runs: SimRun;
  zones: Zone;
  zone_events: ZoneEvent;
  proposals: Proposal;
  intents: Intent;
  help_requests: HelpRequest;
  locations: LocationFix;
  location_shares: LocationShare;
  dispatches: Dispatch;
  pickup_runs: PickupRun;
  holds: Hold;
  canaries: Canary;
  reports: Report;
  clusters: Cluster;
  ledger: LedgerEntry;
  evac_plans: EvacPlan;
  meta: Meta;
}

export type TableName = keyof Tables;

export const TABLES: TableName[] = [
  "households", "campaigns", "calls", "household_status", "alerts_feed", "twist_log", "sim_runs",
  "zones", "zone_events", "proposals", "intents", "help_requests", "locations", "location_shares", "dispatches", "pickup_runs",
  "holds", "canaries", "reports", "clusters", "ledger", "evac_plans", "meta",
];

/** Tables whose rows have no `id` column; they are matched by these keys instead. */
export const COMPOSITE_KEYS: Partial<Record<TableName, string[]>> = {
  household_status: ["campaign_id", "household_id"],
};

export type Row<T extends TableName> = Tables[T];
export type Match<T extends TableName> = Partial<Tables[T]>;

export interface Store {
  readonly backend: "local" | "supabase";
  all<T extends TableName>(table: T): Promise<Row<T>[]>;
  where<T extends TableName>(table: T, match: Match<T>): Promise<Row<T>[]>;
  get<T extends TableName>(table: T, id: string): Promise<Row<T> | null>;
  insert<T extends TableName>(table: T, rows: Row<T> | Row<T>[]): Promise<void>;
  /** Patch one row by id. Returns the updated row, or null when it does not exist. */
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T> | null>;
  /** Patch every row matching `match`. Returns the number of rows changed. */
  updateWhere<T extends TableName>(table: T, match: Match<T>, patch: Partial<Row<T>>): Promise<number>;
  /** Insert or replace rows, keyed by `id` or the table's composite key. */
  upsert<T extends TableName>(table: T, rows: Row<T> | Row<T>[]): Promise<void>;
  remove<T extends TableName>(table: T, match: Match<T>): Promise<number>;
  clear(table: TableName): Promise<void>;
}
