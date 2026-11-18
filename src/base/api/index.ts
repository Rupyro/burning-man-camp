// The public base API. Modules may import ONLY this file (plus ./schema and ./testing)
// from src/base. Everything else in src/base is internal (enforced by ESLint boundaries).

export type { AuditEntry } from "../audit/audit";
export { evaluateAccess } from "../authz/access";
export type { ActorData, MemberStatus } from "../authz/actor";
export { Actor } from "../authz/actor";
export type { CapabilityCheck, PermissionSet } from "../authz/permissions";
export { BASE_CAPABILITIES, can, definePermissions } from "../authz/permissions";
export { loadAlertHours } from "../engine/alerts";
/** Queue an email through the camp outbox (console only until a real email account exists). */
export { enqueueEmail } from "../engine/notify";
export type { AlertHours } from "../engine/rules/alerts";
export { alertHours } from "../engine/rules/alerts";
export { ForbiddenError, UnauthenticatedError, ValidationError } from "../errors";
export type { ActionFailure, ActionFailureCode } from "../guard/action-result";
export { isActionFailure } from "../guard/action-result";
export type { ActionContext } from "../guard/context";
export type { ModulePageProps } from "../guard/guard-layout";
export { guardModuleLayout, guardModulePage } from "../guard/guard-layout";
export {
  moduleAction,
  publicAction,
  requireCapability,
  sessionAction,
} from "../guard/module-action";
export type { ApprovedRow, BatchImporter, Importers } from "../ingest/batches";
export { approveBatch, undoBatch } from "../ingest/batches";
export { CAMP_GUIDE } from "../landing/camp-info";
export { handoverItems } from "../landing/handover";
export { getRegistry, registerModules } from "../registry/runtime";
export type * from "../registry/types";
export { getAutomationSettings, setAutomationSetting } from "../settings/automation";
