import type { RoleKey, TeamRole } from "../registry/types";

export type MemberStatus = "prospect" | "waitlisted" | "confirmed" | "withdrawn" | "removed";

export interface ActorData {
  kind: "person" | "system";
  personId: string | null;
  displayName: string;
  editionId: string | null;
  memberStatus: MemberStatus | null;
  roles: RoleKey[];
  teams: { teamId: string; teamKey: string; role: TeamRole }[];
}

/**
 * Who is acting, resolved on the server once per request. Pure: no DB, no Next.
 * Capability checks in permissions.ts files are functions of this object.
 */
export class Actor {
  readonly kind: ActorData["kind"];
  readonly personId: string | null;
  readonly displayName: string;
  readonly editionId: string | null;
  readonly memberStatus: MemberStatus | null;
  readonly roles: ReadonlySet<RoleKey>;
  readonly teams: ActorData["teams"];

  constructor(data: ActorData) {
    this.kind = data.kind;
    this.personId = data.personId;
    this.displayName = data.displayName;
    this.editionId = data.editionId;
    this.memberStatus = data.memberStatus;
    this.roles = new Set(data.roles);
    this.teams = data.teams;
  }

  static system(editionId: string | null = null): Actor {
    return new Actor({
      kind: "system",
      personId: null,
      displayName: "System",
      editionId,
      memberStatus: null,
      roles: [],
      teams: [],
    });
  }

  get isSystem(): boolean {
    return this.kind === "system";
  }
  get isAdmin(): boolean {
    return this.roles.has("admin");
  }
  /** A confirmed member of the current edition. */
  get isConfirmedMember(): boolean {
    return this.memberStatus === "confirmed";
  }
  /**
   * Applying to join this edition (spec applicants §1): a person whose membership is prospect or
   * waitlisted, and not an admin. Applicants see only the applicant screens.
   */
  get isApplicant(): boolean {
    return (
      this.kind === "person" &&
      !this.isAdmin &&
      (this.memberStatus === "prospect" || this.memberStatus === "waitlisted")
    );
  }
  get isAnyTeamLead(): boolean {
    return this.teams.some((t) => t.role === "lead" || t.role === "co_lead");
  }
  hasRole(role: RoleKey): boolean {
    return this.roles.has(role);
  }
  /** Team id or team key. */
  isMemberOf(team: string): boolean {
    return this.teams.some((t) => t.teamId === team || t.teamKey === team);
  }
  isLeadOf(team: string): boolean {
    return this.teams.some(
      (t) =>
        (t.teamId === team || t.teamKey === team) && (t.role === "lead" || t.role === "co_lead"),
    );
  }
  teamRole(team: string): TeamRole | null {
    return this.teams.find((t) => t.teamId === team || t.teamKey === team)?.role ?? null;
  }
}
