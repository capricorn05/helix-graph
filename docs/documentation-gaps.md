# Documentation Gaps And Product Risks

## Scope

This file records the main ambiguities, inconsistencies, and incomplete user-facing behaviors found while documenting the current system implementation.

## Confirmed Gaps

### 1. No implemented authentication or role model

- No login route or auth flow was found.
- No tenant selection was found.
- No user-role-specific UI behavior was found.
- Capability checks exist in the action layer, but the example handlers grant capabilities directly.

Impact:

- User-facing permissions cannot be documented as a real product feature.
- Role-based access guidance for admins, managers, or support staff would be speculative.

### 2. Edit user flow is technically present but operationally incomplete

- `/users/:id/edit` renders a real form.
- The form submits `POST` to `/api/users/:id`.
- `handleUpdateUser` returns JSON for the updated user instead of redirecting or rendering a success page.

Impact:

- A normal browser form submission likely ends on raw JSON, which is not a polished admin workflow.

### 3. Search page is a demo, not a complete search workflow

- The page renders a combobox, help popover, and popular links.
- No real search results area or backed search result flow was found.
- The page itself says full-text search is coming soon.

Impact:

- End-user search documentation must stay limited and explicit.

### 4. Settings page is read-only demo UI

- The page states it is read-only in demo mode.
- The form uses `method="POST" action="/settings"`.
- No matching POST settings handler or route was found.

Impact:

- Settings cannot be documented as a saveable configuration workflow.

### 5. Delete and activate user APIs exist without clear UI entry points

- `DELETE /api/users/:id` exists.
- `POST /api/users/:id/activate` exists.
- No clear user-facing buttons or forms for these actions were found in the visible app pages.

Impact:

- Support or admin documentation for these actions would need to be API-oriented, not UI-oriented.

## Confirmed Inconsistencies

### 6. External Data page copy conflicts with implementation

- `src/example/views-tsx/external-products.view.tsx` says the page shows 30 rows per page.
- `EXTERNAL_PRODUCTS_PAGE_SIZE` in `src/example/resources/external-products.resource.ts` is 100.

Impact:

- User-facing copy and actual behavior disagree.

### 7. About page overstates CRUD completeness

- The About page advertises "real-time user management (create, read, update, delete)".
- Create and read are clearly supported.
- Update exists but is not a polished end-user workflow.
- Delete exists only at the API layer from the current documentation pass.

Impact:

- The claim is stronger than the full visible user experience.

## Inferred Risks

### 8. Demo app and product app boundaries are not always obvious

- Several pages exist to demonstrate framework techniques rather than complete operations workflows.
- Users can mistake a UI demo for a production-ready admin capability.

Impact:

- Internal documentation should keep labeling demo-only workflows clearly.

## Recommended Follow-Ups

1. Decide whether `/users/:id/edit` should redirect back into the admin shell after save.
2. Add explicit "demo-only" messaging to Search and Settings if that distinction should be visible to end users.
3. Resolve the `/external-data` rows-per-page copy mismatch.
4. Decide whether delete and activate user actions should have visible UI controls.
5. Document or implement a real authentication and authorization model if this example app is expected to support operational users.
