export const procurementPermissions = [
  'Procurement.View',
  'Procurement.Create',
  'Procurement.EditOwn',
  'Procurement.Submit',
  'Procurement.TechnicalApprove',
  'Procurement.FinancialApprove',
  'Procurement.ExecutiveApprove',
  'Procurement.Cancel',
] as const

export type ProcurementPermission = (typeof procurementPermissions)[number]

export function hasProcurementPermission(
  permissions: readonly string[],
  permission: ProcurementPermission,
) {
  return permissions.includes(permission)
}
