# FollowTidy

A free desktop Chrome extension to review your Instagram following list and unfollow accounts you choose. No subscription, payment account, or app-imposed usage quota.

## Install

1. Download this repository as ZIP and extract it.
2. Open `chrome://extensions` in Chrome and enable Developer mode.
3. Choose **Load unpacked**, then select the extracted folder containing `manifest.json`.
4. Open FollowTidy from the Extensions menu. Disable older FollowTidy copies before running a queue.

## Use

Sign in to the correct Instagram account in the same browser and use Instagram in English. Import your recent all-time followers and following JSON export (include every followers part), or add usernames manually. Tick accounts, review the list, acknowledge the correct account, then start.

Checked means selected to unfollow; unchecked means keep following. The nonfollower comparison reflects the imported export, not live follower status.

- Unavailable pages and accounts already not followed are skipped.
- Login prompts, restrictions, changed controls and uncertain outcomes stop the queue.
- Successful actions wait 30 seconds; skipped profiles wait 2 seconds.
- Keep the dashboard open. Stop prevents later clicks; a request already sent may finish. There is no automatic retry or resume.

Instagram's own restrictions still apply. This is a beta: layout changes can break detection. Automated tests use simulated pages, not live Instagram accounts. This project is not affiliated with Instagram or Meta.

## Development

No dependencies or compilation are required. Run `npm test` with Node.js 20 or newer. Source and regression tests are in this folder.

For a store upload ZIP, zip the extension files with `manifest.json` at the ZIP root. Do not include tests, exports or credentials.

See [Privacy](PRIVACY.md). This release contains no billing service or paid tier. Chrome Web Store publication is a separate step; this repository does not imply store approval.
