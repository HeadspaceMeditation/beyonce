/**  The AWS V3 SDK wants to work in both the browser and node envs.
 *   So, it relies on DOM type definitions (File + Blob) that don't exist in node
 *   These fype declarations get us around that
 */
declare global {
  interface Blob {}
  interface File {}
}
export {}
