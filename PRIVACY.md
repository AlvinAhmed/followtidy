# FollowTidy privacy notice

Version 0.3.0 — 20 October 2026

FollowTidy processes imported follower/following files and manually entered usernames on your computer. Lists and selections remain in dashboard memory until cleared, reloaded or closed. The extension does not send these lists to a developer server and contains no analytics, billing or advertising service.

When you start a reviewed queue, FollowTidy visits selected Instagram profiles and uses the signed-in Instagram session to perform requested actions. Instagram receives those visits and actions under its own policies. FollowTidy does not request or collect your password.

Chrome local extension storage holds temporary run controls and the most recent submitted operation, including its target username and timestamp. That record can remain after the dashboard closes. Removing the extension clears its extension storage. Clear imported data clears dashboard lists, not the stored operation record. Saving a selection creates a text file on your computer that you manage separately.

Permissions: `storage` coordinates queue execution and records the last submitted operation. `scripting` runs profile checks and reviewed unfollow actions. Access to `https://www.instagram.com/*` allows interaction with selected profiles. No other site access is requested.

For questions, open an issue in this repository. Do not post private exports, credentials or account lists in public issues.
