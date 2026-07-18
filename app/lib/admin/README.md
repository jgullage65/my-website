# Admin authorization integration

The admin dashboard is closed by default. Until Clerk is connected, middleware
returns `404` for every `/admin` request and `requireAdmin()` independently
prevents every admin page from rendering or querying data.

When Clerk is added:

1. Replace `getAdminPrincipal()` in `auth.ts` with a server-side Clerk session
   and role check. Only return a principal when the authenticated Clerk user has
   the `admin` role.
2. Replace the closed `/admin` branch in the repository-root `middleware.ts`
   with Clerk middleware that rejects unauthenticated and non-admin requests.
3. Keep every page-level `requireAdmin()` call. It is the authorization boundary
   immediately before admin data queries.

Do not authorize from client state, hidden navigation, email query parameters,
or unverified Clerk metadata.

Impersonation remains disabled until the Clerk server SDK is installed. Connect
the implementation boundary in `impersonation.ts` only through Clerk's supported
server-side session/impersonation APIs. The operations schema already includes
an append-only impersonation event table; start and exit events must be written
only after Clerk confirms the corresponding session transition.
