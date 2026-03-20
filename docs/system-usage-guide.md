# System Usage Guide

## Preface

This guide documents the system that is implemented in this repository today. It is based on the running example application under `src/example/` and the supporting Helix framework under `src/helix/`.

Status labels used throughout this guide:

- `Confirmed`: directly supported by the code or current source-of-truth docs.
- `Inferred`: strongly suggested by the code structure or UI copy, but not fully enforced end to end.
- `Missing / needs clarification`: unclear, incomplete, or contradicted by current implementation.

## 1. Audit Of Reviewed Sources

### Source-of-truth project docs reviewed

- `README.md`
- `ARCHITECTURE_ROADMAP.md`
- `Tech Specs.md`
- `NEXT_STEPS.md`

### Primary implementation sources reviewed

- Server and routing:
  - `src/example/server.ts`
  - `src/example/routes/index.ts`
  - `src/example/handlers/pages.handler.ts`
  - `src/example/handlers/users.handler.ts`
  - `src/example/handlers/api.handler.ts`
- Core domain and resources:
  - `src/example/domain.ts`
  - `src/example/resources/users.resource.ts`
  - `src/example/resources/posts.resource.ts`
  - `src/example/resources/external-products.resource.ts`
  - `src/example/resources/mongo-airbnb.resource.ts`
  - `src/example/resources/actions.ts`
  - `src/example/utils/query.ts`
  - `src/example/utils/http.ts`
- Layout, navigation, and page rendering:
  - `src/example/views/admin-layout.ts`
  - `src/example/views/users.view.ts`
  - `src/example/views/posts.ts`
  - `src/example/views/posts-create.ts`
  - `src/example/views/external-products.ts`
  - `src/example/views/external-products-rich.ts`
  - `src/example/views/host-listings.ts`
  - `src/example/views/mongo-airbnb.ts`
  - `src/example/views/settings.ts`
  - `src/example/views/search.ts`
  - `src/example/views/reports.ts`
  - `src/example/views-tsx/*.view.tsx` files for the page shells
- Client behavior and progressive enhancement:
  - `src/example/client/bootstrap.ts`
  - `src/example/client/runtime.ts`
  - `src/example/client/actions-users.ts`
  - `src/example/client/actions-posts.ts`
  - `src/example/client/actions-external.ts`
  - `src/example/client/actions-navigation.ts`
  - `src/example/client/actions-primitives.ts`
  - `src/example/client/primitives-demo.ts`
  - `src/example/client/external-grid.ts`
  - `src/example/client/host-listings.ts`
  - `src/example/client/mongo-airbnb.ts`
  - `src/example/shared/host-listings.ts`
  - `src/example/shared/mongo-airbnb.ts`
  - `src/example/shared/mongo-airbnb-query.ts`
  - `src/example/shared/external-products-query.ts`

### Tests reviewed to confirm behavior

- `src/tests/users-routes.test.ts`
- `src/tests/user-detail-drawer.test.ts`
- `src/tests/external-products.test.ts`
- `src/tests/mongo-airbnb.test.ts`
- `src/tests/external-details-navigation.test.ts`
- `src/tests/primitives-message.test.ts`

## 2. Proposed Documentation Outline

1. System overview
2. Roles and permissions
3. Getting started
4. Main navigation
5. Core workflows
6. Field and data guide
7. Real usage examples
8. Troubleshooting
9. FAQ
10. Operational notes
11. Known gaps and documentation risks

## 3. Uncertainties And Gaps Identified Before Writing

1. `Confirmed`: the repository contains a real example admin-style app, but it is also a framework demo. Some pages exist to demonstrate framework patterns rather than complete business workflows.
2. `Missing / needs clarification`: there is no implemented login, tenant selection, or role-based access control UI. Capability checks exist in framework actions, but the example handlers pass capabilities directly.
3. `Missing / needs clarification`: the user edit page posts to `/api/users/:id`, which returns JSON rather than redirecting back into the admin shell. The edit screen exists, but its save flow is not a polished end-user flow.
4. `Missing / needs clarification`: search and settings pages are demo pages. Their controls are interactive, but they do not complete a full persisted business workflow.
5. `Missing / needs clarification`: delete and activate user APIs exist, but no clear user-facing controls for them were found in the admin UI.
6. `Missing / needs clarification`: the external data page copy says it shows 30 rows per page, while the implemented page size is 100.

---

## System Overview

### What the system is

`Confirmed`: this repository contains two things working together:

1. The Helix framework, a server-first TypeScript web framework with streaming SSR, resumable client behavior, patch-based DOM updates, and a graph-based runtime model.
2. An example admin-style application that demonstrates how to use the framework through real pages and API flows.

For most users of the running system, the visible product is the example admin app. It behaves like a small internal operations console with data tables, detail drawers, demo forms, component demos, and data exploration screens.

### Who it is for

`Confirmed`:

- Internal staff exploring users, posts, and sample datasets
- Developers evaluating how Helix pages, APIs, and progressive enhancement work
- Support or onboarding staff who need a usage overview of the demo app
- Product or engineering stakeholders reviewing framework capabilities through a working UI

`Inferred`: it is best treated as an internal demo or reference application, not a finished production back-office product.

### What problems it solves

`Confirmed`:

- Demonstrates server-rendered admin pages that still feel interactive
- Shows table paging, sorting, modal and drawer detail views, inline validation, and partial page replacement
- Demonstrates external data integration and offline fallback patterns
- Shows how richer client interactions can be added without switching the whole app to client-side rendering

### Main modules and areas of the system

| Area | Purpose | Main routes |
| --- | --- | --- |
| Users | Browse users, sort, page, view details, create a user, load live panels | `/`, `/users/:id`, `/users/:id/edit` |
| Dashboard | Show summary metrics for users | `/dashboard` |
| Reports | Show user status summary and current page report | `/reports` |
| Posts | Browse posts and create a post | `/posts`, `/posts/new` |
| External Data | Explore a synthetic 10,000-row product dataset | `/external-data`, `/external-data-rich`, `/external-grid` |
| Host Listings | View the external product data as Airbnb-style cards | `/host-listings` |
| Airbnb Mongo | Browse MongoDB-backed or offline Airbnb-style listings with filters | `/airbnb-mongo` |
| Primitives | Interactive showcase for dialog, tooltip, menu, select, combobox, toast, and more | `/primitives` |
| Interactions | Drag-and-drop demo page | `/interactions` |
| Search and Settings | Demo pages for search primitives and settings primitives | `/search`, `/settings` |
| About | Framework overview page | `/about` |

## User Roles And Permissions

### Supported roles

`Missing / needs clarification`: no explicit user roles are implemented in the example application. There is no login screen, no session handling, and no role-specific navigation.

### Permission behavior that does exist

`Confirmed`: the Helix action layer supports capability checks such as `users:write` and `posts:write`.

`Confirmed`: the example action handlers call server actions with those capabilities already granted.

Practical meaning:

- End users are not prompted to authenticate.
- The UI does not change based on role.
- Permission failures are not part of the normal demo workflow.

### What each user can see and do

`Inferred`: because there is no role split, any person who can open the running app can access every visible route in the navigation and can trigger the same UI actions.

### Approval flows

`Missing / needs clarification`: no approval workflow, moderation queue, or sign-off flow was found.

## Getting Started

### Prerequisites

`Confirmed`:

1. Install dependencies with `npm install`.
2. Start the app with `npm run dev`.
3. Open `http://localhost:4173`.

Optional setup for the Mongo-backed listings page:

1. Set `MONGODB_URI`.
2. Optionally set `MONGODB_AIRBNB_DATABASE` and `MONGODB_AIRBNB_COLLECTION`.
3. Open `/airbnb-mongo`.

If MongoDB is not configured, the Airbnb Mongo page still works by using an offline curated sample dataset.

### Login and authentication

`Confirmed`: there is no login or authentication step.

### Environment or tenant selection

`Confirmed`: no tenant picker or environment switcher was found in the app UI.

### Initial setup steps for a first-time user

1. Open the home page at `/`.
2. Review the top or side navigation.
3. Start with `Users`, `Dashboard`, `Reports`, and `Posts` for the main admin workflows.
4. Use `External Data`, `Host Listings`, and `Airbnb Mongo` to explore the data demo areas.
5. Use `Primitives` and `Interactions` if you are validating framework interaction patterns.

### First-time user flow

`Confirmed`:

1. The app loads server-rendered HTML first.
2. Client behavior resumes after load through the Helix bootstrap.
3. Many navigation actions inside the admin shell replace only the core content area rather than doing a full page reload.
4. Some pages, such as Host Listings and Airbnb Mongo, enhance pagination and filtering through route-specific client scripts.

## Main Navigation

### Overall layout

`Confirmed`: the app uses an admin shell with:

- a sticky top bar
- a side navigation
- a main content area with a page title
- an `app-core` region that is replaced during in-app navigation

### Navigation items

`Confirmed`: the main navigation includes:

- Users
- Dashboard
- Reports
- Primitives
- Interactions
- External Grid
- External Data
- External Data Rich
- Host Listings
- Airbnb Mongo
- Posts
- New Post
- Search
- Settings
- About

### How users move around

`Confirmed`:

1. Clicking a main navigation link normally triggers a client handler bound to `app-nav`.
2. The client requests `/components/app-core?path=...`.
3. Only the main content region is replaced.
4. The browser history is updated.
5. Any page-specific primitive wiring is reinitialized.

`Inferred`: this gives the app a partial-SPA feel while keeping page rendering server-driven.

### Important navigation exceptions

`Confirmed`:

- `/host-listings` manages its own pager enhancement through `src/example/client/host-listings.ts`.
- `/airbnb-mongo` manages its own filter and pager enhancement through `src/example/client/mongo-airbnb.ts`.
- `/users/:id` and `/users/:id/edit` are full-page routes outside the normal admin shell swap pattern.

## Core Workflows

### Users: browse, sort, and page

**Purpose**

Review the user list and move through paged results.

**When to use it**

Use this as the default landing page for user operations.

**Required inputs**

None.

**Steps**

1. Open `/`.
2. Review the user table showing Name, Email, Status, and a Details action.
3. Click `Name` or `Email` sort buttons to change sort order.
4. Click `Prev` or `Next` to move through pages.

**Expected result**

- The table updates without a full page reload.
- Sort indicators update to show ascending or descending order.
- Page state stays in sync with the client runtime.

**Common mistakes and edge cases**

- `Confirmed`: user paging is limited to the available pages and the pager disables when you reach the start or end.
- `Confirmed`: sorting one column resets the page back to page 1.

### Users: open a user detail drawer

**Purpose**

See user details without leaving the list page.

**When to use it**

Use it when you need a quick read-only view of a user.

**Required inputs**

- A row in the Users table

**Steps**

1. On `/`, click `Details` for a user row.
2. Wait for the drawer to open.
3. Review ID, Name, Email, and Status.
4. Use the `Edit User` link if you need the edit screen.
5. Click `Close` or dismiss the drawer.

**Expected result**

- The drawer opens immediately.
- The content briefly shows loading placeholders.
- Data is fetched from `/api/users/:id`.

**Common mistakes and edge cases**

- `Confirmed`: if the detail fetch fails, the drawer stays open and shows an error message instead of data.
- `Confirmed`: the edit link is still populated even when detail loading fails.

### Users: create a new user

**Purpose**

Add a new user to the in-memory user store.

**When to use it**

Use it from the home page when you want to test create flow behavior.

**Required inputs**

- `Name`
- `Email`

**Steps**

1. Open `/`.
2. Scroll to the `Add user` section.
3. Enter a name with at least 2 characters.
4. Enter an email address containing `@` and at least 5 characters.
5. Click `Create User`.

**Expected result**

- Client-side validation runs first.
- If valid, the form posts to `/actions/create-user`.
- The user list refreshes after success.
- The form resets and shows `User created.`

**Common mistakes and edge cases**

- `Confirmed`: invalid name shows `Name must be at least 2 characters.`
- `Confirmed`: invalid email shows `Enter a valid email address.`
- `Confirmed`: server and client both return a form-level prompt to fix highlighted fields.
- `Confirmed`: new users are created with `pending` status by default.

### Users: load the live panel

**Purpose**

Replace only a section of the home page with server-rendered content.

**When to use it**

Use it to inspect summary content, reports content, help content, or an embedded external-data panel.

**Required inputs**

- One of the panel buttons: `Summary`, `Reports`, `External Data`, or `Help`

**Steps**

1. Open `/`.
2. In `Live component load`, click one of the panel buttons.
3. Wait for the section to update.

**Expected result**

- The panel container fetches HTML from `/components/users-panel`.
- Only that panel region changes.

**Common mistakes and edge cases**

- `Confirmed`: the external-data live panel uses its own server-rendered external product component.
- `Inferred`: this area is mainly a demonstration of server-rendered fragment replacement, not a business-critical workflow.

### Users: open full detail page

**Purpose**

View a user on a standalone page.

**Steps**

1. On `/`, click a user name.
2. Review the user detail page at `/users/:id`.

**Expected result**

- The page shows Name, Email, Status, and ID.

**Edge cases**

- `Confirmed`: invalid IDs return `400 Invalid user ID`.
- `Confirmed`: missing users return a `404` HTML page with `User not found`.

### Users: edit a user

**Purpose**

Edit name, email, or status on a standalone form.

**When to use it**

Use it for direct update testing.

**Required inputs**

- Name
- Email
- Status (`active` or `pending`)

**Steps**

1. Open `/users/:id/edit` directly or from the detail drawer.
2. Change the form values.
3. Click `Save Changes`.

**Expected result**

- `Confirmed`: the form submits `POST` to `/api/users/:id`.
- `Confirmed`: the server updates the in-memory user record and returns JSON for the updated user.

**Common mistakes and edge cases**

- `Missing / needs clarification`: this flow does not redirect back to the admin shell or show a success page. In a normal browser form submission, the user is likely to end on a raw JSON response.
- `Confirmed`: invalid user IDs return `400`.
- `Confirmed`: missing users return `404`.

### Dashboard: review user metrics

**Purpose**

See the current totals for all users.

**Steps**

1. Open `/dashboard`.
2. Review the cards for total users, active users, pending users, and activation rate.

**Expected result**

- The page renders summary cards based on the in-memory user store.

### Reports: review user status report

**Purpose**

See a summary of the current users page and a view-only report table.

**Steps**

1. Open `/reports`.
2. Review the summary section.
3. Review the users table for the current users page.

**Expected result**

- The summary shows active and pending users on the current page and the total number of pages.

**Common mistakes and edge cases**

- `Confirmed`: export is not implemented yet. The page explicitly says CSV and JSON export are coming soon.

### Posts: browse posts

**Purpose**

Page through the posts dataset.

**When to use it**

Use it to review the seed posts and test incremental page updates.

**Steps**

1. Open `/posts`.
2. Review the columns: ID, User, Title, and truncated Body.
3. Click `Prev` or `Next` to page.

**Expected result**

- The page fetches `/api/posts?page=...`.
- The posts table updates in place.
- The URL is updated to the new page.

**Common mistakes and edge cases**

- `Confirmed`: page size is 10.
- `Confirmed`: the pager disables at the start and end of the dataset.
- `Confirmed`: if the upstream JSONPlaceholder dataset is unavailable, the app uses an offline seed dataset instead.

### Posts: create a post

**Purpose**

Add a post to the server-backed in-memory posts store.

**Required inputs**

- `User ID`
- `Title`
- `Body`

**Steps**

1. Open `/posts/new`.
2. Enter `1` for `User ID`.
3. Enter a title with at least 3 characters.
4. Enter a body with at least 10 characters.
5. Click `Create Post`.

**Expected result**

- Validation runs.
- The form posts JSON to `/actions/create-post`.
- On success, the app navigates back to `/posts?page=1`.

**Common mistakes and edge cases**

- `Confirmed`: invalid inputs show field-specific errors.
- `Confirmed`: unexpected failures show a generic form error.

### External Data: browse synthetic product table

**Purpose**

Review a large synthetic product dataset with paging and detail modal behavior.

**Steps**

1. Open `/external-data`.
2. Review the products table.
3. Click `Prev` or `Next` to page.
4. Click `Details` on a row to open the modal.

**Expected result**

- Page changes fetch `/api/external-data`.
- Product detail fetches `/api/external-data/:id`.
- The modal shows brand, category, price, stock, rating, source, thumbnail, and description.

**Common mistakes and edge cases**

- `Confirmed`: the dataset is synthesized from DummyJSON product seeds and expanded to 10,000 rows.
- `Missing / needs clarification`: page copy says 30 rows per page, but the implemented page size is 100.

### External Data Rich: browse richer product table

**Purpose**

See the same external dataset in a denser, visually richer table with more styling and a drawer detail view.

**Steps**

1. Open `/external-data-rich`.
2. Review the preview image, title, brand, category, price band, stock band, and rating band styling.
3. Use `Prev` and `Next`.
4. Click `Details` to open the drawer.

**Expected result**

- The page fetches `/api/external-data-rich`.
- Product details open in a drawer-style panel.

### External Grid: sort, filter, and edit table cells

**Purpose**

Demonstrate spreadsheet-style table interaction.

**When to use it**

Use it for editing and sorting experiments rather than durable data entry.

**Steps**

1. Open `/external-grid`.
2. Click a sortable header to sort.
3. Use the per-column filters to narrow rows.
4. Click inside a cell to edit it.
5. Press `Enter` or blur the cell to commit the local edit.
6. Use the pager buttons to move through server-backed pages.

**Expected result**

- Sorting and filtering fetch updated server pages.
- Cell edits apply locally in the browser.
- Status text explains what changed.

**Common mistakes and edge cases**

- `Confirmed`: text filters debounce for 250 ms before navigating.
- `Confirmed`: select-style filter changes navigate immediately.
- `Confirmed`: numeric cells reject invalid non-numeric values and restore the previous value.
- `Missing / needs clarification`: inline grid edits are not persisted to the server.

### Host Listings: browse card-based listings

**Purpose**

Review the external product dataset in a card layout.

**Steps**

1. Open `/host-listings`.
2. Review the listing cards.
3. Use the pager links to move through pages.

**Expected result**

- Pagination fetches `/api/host-listings`.
- Only the grid and pager update.
- The browser history is updated.

**Common mistakes and edge cases**

- `Confirmed`: this page currently supports pager navigation, but there are no visible sort or filter controls in the page UI.

### Airbnb Mongo: filter and browse stay listings

**Purpose**

Browse a MongoDB-backed discovery page with offline fallback support.

**When to use it**

Use it for the richest data-browsing workflow in the example app.

**Available controls**

- Market chips
- Room Type chips
- Quick filter chips for budget and guest count
- Sort chips
- Reset filters
- Pager

**Steps**

1. Open `/airbnb-mongo`.
2. Review the source label to see whether data came from MongoDB or the offline sample.
3. Click a market chip such as `Barcelona` or `New York`.
4. Optionally click a room type.
5. Optionally click a quick budget filter such as `Under $280`.
6. Optionally click a guest filter such as `4+ guests`.
7. Change sort using chips such as `Top Rated`, `Most Reviewed`, `Price Low`, or `Spacious`.
8. Use `Prev` and `Next` to move through pages.
9. Use `Reset filters` if you want to clear active filters.

**Expected result**

- The controls fetch `/api/airbnb-mongo`.
- The controls, grid, pager, and source label update in place.
- The URL query string reflects the active state.

**Common mistakes and edge cases**

- `Confirmed`: supported markets are limited to the configured option list.
- `Confirmed`: supported room types are limited to the configured option list.
- `Confirmed`: `maxPrice` is clamped to 5000 and `minGuests` is clamped to 16 when parsed from the URL.
- `Confirmed`: if no rows match, the page shows a no-results empty state.
- `Confirmed`: if MongoDB is not configured or connection fails, the page falls back to an offline curated sample.

### Primitives: test interaction patterns

**Purpose**

Validate the framework’s headless UI primitives.

**Steps**

1. Open `/primitives`.
2. Try the dialog, popover, tooltip, menu, dropdown, tabs, accordion, toast, select, and combobox examples.
3. In the final section, type a message and submit the form.

**Expected result**

- Each primitive behaves interactively in place.
- The final message form updates a live label, shows an alert, posts to `/actions/submit-primitive-message`, and displays the server thank-you message.

**Common mistakes and edge cases**

- `Confirmed`: blank message submission does not proceed and instead shows `Please enter a message.`

### Interactions: reorder drag-and-drop list

**Purpose**

Demonstrate client-owned drag-and-drop behavior inside a server-rendered page.

**Steps**

1. Open `/interactions`.
2. Drag a row to a new position.
3. Review the status and order text.
4. Use the reset control to restore the original order.

**Expected result**

- Reordering happens locally in the browser.

**Common mistakes and edge cases**

- `Missing / needs clarification`: no server persistence for the reordered state was found.

### Search page

**Purpose**

Demonstrate search-related primitives rather than execute a full search workflow.

**Steps**

1. Open `/search`.
2. Type into the combobox input.
3. Use the help trigger.
4. Use the popular search links if you want to jump back to filtered user list states.

**Expected result**

- The page behaves like a UI demo.

**Common mistakes and edge cases**

- `Missing / needs clarification`: the form itself does not appear to render a real search result set.
- `Confirmed`: the page explicitly says full-text search is coming soon.

### Settings page

**Purpose**

Demonstrate settings-style controls and headless primitives.

**Steps**

1. Open `/settings`.
2. Review the auto-activate checkbox and page-size selector.
3. Open the help tooltip if needed.

**Expected result**

- The controls render and behave locally.
- The page clearly says settings are read-only in demo mode.

**Common mistakes and edge cases**

- `Missing / needs clarification`: the form has `method="POST" action="/settings"` but no matching POST route was found, so this is not a completed save workflow.

## Field And Data Guide

### User fields

| Field | Meaning | Required | Validation | Notes |
| --- | --- | --- | --- | --- |
| `id` | Numeric user identifier | System-generated | Positive integer in APIs | New users are assigned the next available ID |
| `name` | User name | Yes | Minimum 2 characters on create | Editable |
| `email` | User email | Yes | Must contain `@` and be at least 5 characters on create | Editable |
| `status` | User lifecycle state | Inferred yes on update | `active` or `pending` | New users default to `pending` |

### Post fields

| Field | Meaning | Required | Validation | Notes |
| --- | --- | --- | --- | --- |
| `id` | Numeric post ID | System-generated | Positive integer | Assigned server-side |
| `userId` | Owning user ID | Yes | Positive integer | No UI lookup for existing users |
| `title` | Post title | Yes | Minimum 3 characters | Max length 120 in the UI input |
| `body` | Post body | Yes | Minimum 10 characters | Multi-line textarea |

### External product fields

`Confirmed`:

- `id`
- `title`
- `brand`
- `category`
- `price`
- `stock`
- `rating`

Rich detail adds:

- `description`
- `thumbnail`
- `sourceId`

### Mongo Airbnb listing fields

| Field | Meaning |
| --- | --- |
| `id` | Listing identifier, mapped from Mongo `_id` or sample data |
| `name` | Listing title |
| `summary` | Trimmed summary text |
| `propertyType` | Property type |
| `roomType` | Room type |
| `market` | Market or city group |
| `country` | Country |
| `hostName` | Host name |
| `imageUrl` | Listing image |
| `price` | Nightly price |
| `reviewScore` | Review score, normalized for display |
| `reviewsCount` | Number of reviews |
| `accommodates` | Guest capacity |
| `bedrooms` | Bedroom count |
| `beds` | Bed count |
| `bathrooms` | Bathroom count |

### Status values and enums

`Confirmed`:

- User status: `active`, `pending`
- User sort columns: `name`, `email`
- User sort directions: `asc`, `desc`
- Mongo Airbnb sort columns: `reviewScore`, `price`, `reviews`, `accommodates`, `name`
- Mongo Airbnb source values: `mongodb`, `offline-sample`

### Relationships between entities

`Confirmed`:

- Posts reference a user by `userId`.
- Users do not show a visible posts relationship in the UI.
- External data and Mongo Airbnb areas are standalone demos rather than being related to users or posts.

## Real Usage Examples

### Example 1: Add a support user and verify it appears in the list

1. Open `/`.
2. In `Add user`, enter `Jamie Support` and `jamie.support@example.com`.
3. Click `Create User`.
4. Wait for the status message `User created.`
5. Review the table and page state.

Expected result:

- A new row appears after the list refresh.
- The new user has `pending` status.

### Example 2: Investigate a user without leaving the main page

1. Open `/`.
2. Click `Details` for a row.
3. Review the drawer data.
4. Click `Edit User` if you need the full edit form.

Expected result:

- The drawer opens quickly.
- Data is loaded from the user detail API.

### Example 3: Create a post and return to the posts list

1. Open `/posts/new`.
2. Enter `1` for `User ID`.
3. Enter `Welcome note` for `Title`.
4. Enter at least 10 characters for `Body`.
5. Click `Create Post`.

Expected result:

- The app navigates to `/posts?page=1`.
- The new post appears near the top because new posts are inserted at the start of the in-memory store.

### Example 4: Find affordable larger stays on the Airbnb Mongo page

1. Open `/airbnb-mongo`.
2. Click `Barcelona`.
3. Click `Entire home/apt`.
4. Click `Under $280`.
5. Click `4+ guests`.
6. Optionally choose `Top Rated` or `Price Low`.

Expected result:

- The grid shows only matching stays.
- The URL records your filters.
- The source label tells you whether the results came from MongoDB or the fallback sample.

### Example 5: Use the external grid as a QA demo

1. Open `/external-grid`.
2. Sort by `Price`.
3. Filter `Brand`.
4. Edit a numeric cell, such as `Stock`.
5. Blur the cell.

Expected result:

- The sort and filter refresh from the API.
- The inline cell edit updates locally and the status line confirms the change.

## Troubleshooting

### The app does not load

Check:

1. `npm install` completed successfully.
2. `npm run dev` is running.
3. You are opening `http://localhost:4173`.

### The Airbnb Mongo page shows fallback data instead of MongoDB data

Likely causes:

- `MONGODB_URI` is not set
- The MongoDB connection failed
- The configured database or collection name is wrong

What to check:

1. Set `MONGODB_URI`.
2. If needed, set `MONGODB_AIRBNB_DATABASE` and `MONGODB_AIRBNB_COLLECTION`.
3. Reload `/airbnb-mongo`.
4. Check whether the source label changes from offline sample to MongoDB.

### A user detail drawer shows an error

Likely cause:

- The request to `/api/users/:id` failed or the user no longer exists.

What to check:

1. Refresh the page.
2. Try opening the user directly at `/users/:id`.
3. Confirm the user still exists in the current in-memory store.

### Creating a user or post does nothing useful

Likely causes:

- Validation failed
- A server request failed

What to check:

1. Review the field-level error messages.
2. Make sure the values meet the validation rules in this guide.
3. Retry after correcting the values.

### Saving the edit user page gives raw JSON

Likely cause:

- This is how the current implementation behaves.

What to check:

1. Confirm the change in the JSON response.
2. Navigate back to `/` or `/users/:id` manually.

`Missing / needs clarification`: this should likely be turned into a redirect or in-shell update flow in a future pass.

### Search page does not show actual search results

Likely cause:

- The page is a search primitive demo, not a complete search product feature.

What to do:

1. Use the popular links to open pre-sorted user list states.
2. Treat the page as a UI demonstration rather than a production search tool.

## FAQ

### Is there a login?

`Confirmed`: no.

### Are user changes persistent after restart?

`Inferred`: no. The users and posts examples are backed by in-memory stores or seeded data, so restarts reset state.

### Can I delete or activate users from the UI?

`Missing / needs clarification`: APIs exist for those actions, but no clear user-facing controls were found in the admin UI.

### Does the app work without JavaScript?

`Inferred`: initial HTML pages render server-side, but many richer interactions depend on the client bootstrap and enhancement scripts.

### Can I use the Airbnb Mongo page without MongoDB?

`Confirmed`: yes. It uses an offline curated sample when MongoDB is unavailable.

### What key opens the Helix devtools?

`Confirmed`: `Ctrl+M`.

## Operational Notes

### Data integrity and persistence

`Confirmed`:

- Users are stored in an in-memory array in `src/example/domain.ts`.
- Posts are seeded from JSONPlaceholder, then cached locally in memory, with offline fallback if fetch fails.
- External products are synthesized from DummyJSON seeds.
- Airbnb Mongo can use live MongoDB data or offline sample data.

Practical meaning:

- Demo data is useful for interaction testing.
- It should not be treated as durable production storage.

### Caching and freshness visible to users

`Confirmed`:

- Users page resource uses memory cache with `staleMs: 2000` and `revalidateMs: 5000`.
- User detail resource uses `staleMs: 5000`.
- Posts, external products, and Mongo Airbnb pages also use server memory caches.

### Navigation behavior

`Confirmed`:

- Main admin navigation swaps the core content area.
- Browser history is preserved for in-app navigation.
- Host Listings and Airbnb Mongo handle their own pager navigation and `popstate` behavior.

### Audit and history behavior

`Missing / needs clarification`: no audit log or visible change history was found.

### Multi-tenant behavior

`Confirmed`: none was found.

### Security and privacy considerations visible to users

`Confirmed`:

- No login or role guard is visible.
- No permission prompts are visible.
- Capability checks exist behind the scenes for create actions.

`Missing / needs clarification`: this is not sufficient to describe a production security model.

## Known Gaps And Documentation Risks

1. `Missing / needs clarification`: the edit-user save flow ends at a JSON API response instead of a user-friendly success flow.
2. `Missing / needs clarification`: search and settings pages are partially interactive demos, not complete business workflows.
3. `Missing / needs clarification`: delete and activate user APIs exist, but no user-facing controls were found.
4. `Missing / needs clarification`: there is no real auth, role model, or permission-aware navigation.
5. `Confirmed`: the external data page text conflicts with the implemented page size.
6. `Inferred`: some page copy uses product-style language for framework demonstrations, so users should distinguish demo capability from finished workflow.
