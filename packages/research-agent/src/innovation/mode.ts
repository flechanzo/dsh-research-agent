/** Authority remains unavailable until independently calibrated rules have a reviewed implementation. */
export type InnovationMode = 'shadow' | 'authoritative'
export function validateInnovationMode(mode: InnovationMode): void {
  if (mode !== 'shadow') throw new Error('Rubric authoritative mode is unavailable: independent expert calibration and validated decision rules have not been completed. Use shadow.')
}
