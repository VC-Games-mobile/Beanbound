# Beanbound Discord analytics

Daily aggregate Apple reports for Beanbound (app ID 6818844668) are posted to the owner-authorized Discord channel 1561540654096580649. A native macOS LaunchAgent, `com.brent.beanbound-analytics`, runs daily at 10:00 AM America/Detroit on the Mac mini. Codex is not required. The former Codex heartbeat `beanbound-daily-discord-analytics` is PAUSED. The Mac must be powered on with Brent logged in; a scheduled run missed during sleep runs on wake. RunAtLoad also checks for a missed daily report at login. This is a Mac task, not an independent NAS service.

Installed command:

```
/Users/brent/.config/beanbound-analytics/.venv/bin/python /Users/brent/.local/share/beanbound-analytics/report.py --send
```

Run without `--send` to preview. A private file lock and daily receipt prevent concurrent or duplicate posts on the same local date. Failed deliveries are not marked sent. Errors deliberately omit credentials and signed URLs. Output and errors are logged under `~/Library/Logs/beanbound-analytics/`. Failures exit nonzero and are not marked delivered. There are no Codex runs or chat notifications.

Private configuration lives in `~/.config/beanbound-analytics/` (directory mode 700, credential files 600): `apple.json` with issuer_id/key_id/private_key_path/app_id; `report-request.json` with app_id/request_id; `discord.json` with webhook_url/channel_id; and the Apple private key. None is included in the repository. Install the requirements in a private virtual environment, and copy report.py to the installed path when modifying it.

The reporting-only key uses Sales and Reports. The temporary Admin key used to create an ONGOING report request was revoked and verified to return HTTP 401; reporting-only access returned HTTP 200 after revocation. Do not recreate Admin access for daily downloads.

The job reads Standard daily App Downloads, App Store Discovery and Engagement, and App Sessions reports. It downloads all segments of the latest processing instance, avoiding double counting overlapping older snapshots. Each metric displays its own latest event date, and downloads are broken out by type (including first-time, redownloads, updates when present). It does not sum unique devices across dimensions. Usage covers eligible users who opted to share analytics. Missing or suppressed reports are marked unavailable rather than zero. Recent figures are provisional and different reports can have different event dates.

Apple says initial ONGOING report files arrive approximately 24–48 hours after activation. Report generation was enabled October 18, 2026. First Discord delivery succeeded with pending-data labels; duplicate suppression and four aggregation tests passed. The download/parser path is implemented but cannot be validated with real report rows until Apple produces the first files.

Validation:

```
/Users/brent/.config/beanbound-analytics/.venv/bin/python -m unittest discover -s analytics
```

Sources:
- https://developer.apple.com/help/app-store-connect-analytics/overview/analytics-reports-api
- https://developer.apple.com/documentation/analytics-reports/data-completeness-corrections
- https://developer.apple.com/documentation/analytics-reports/app-store-discovery-and-engagement
- https://developer.apple.com/documentation/analytics-reports/app-sessions

## Native Mac schedule

LaunchAgent: `~/Library/LaunchAgents/com.brent.beanbound-analytics.plist`. A credential-free copy is included here for backup. The native task was loaded and its first run exited 0, skipping the already-delivered daily report.

Inspect with `launchctl print gui/$(id -u)/com.brent.beanbound-analytics`. Run now with `launchctl kickstart gui/$(id -u)/com.brent.beanbound-analytics`. To install on this Mac after recovery, copy the plist to ~/Library/LaunchAgents and load it with `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.brent.beanbound-analytics.plist`. The Python environment, installed script, and private credentials must also be present.
