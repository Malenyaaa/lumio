/** Deployment settings from the environment (see `.env.example`). */

const flag = (value: string | undefined) => value?.trim().toLowerCase() === 'true'

export const config = {
  /**
   * Hides the password form on the profile page. Meant for setups where accounts are managed by an identity provider
   * (OIDC/SSO), so a password changed in Jellyfin would be meaningless or even confusing.
   */
  passwordChangeDisabled: flag(import.meta.env.VITE_PASSWORD_CHANGE_DISABLED),
  /** Where users manage their account instead (e.g. the identity provider's settings page). Shown when password change is disabled. */
  accountUrl: import.meta.env.VITE_ACCOUNT_URL?.trim() || undefined,
  /**
   * Pins the login to VITE_JELLYFIN_URL: the server field disappears from the login screen. Only takes effect when that
   * URL is set, otherwise there would be no way to sign in at all.
   */
  serverLocked: flag(import.meta.env.VITE_SERVER_LOCKED) && !!import.meta.env.VITE_JELLYFIN_URL?.trim(),
}
