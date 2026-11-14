# club-website
club website design

## Play-Cricket fixtures and results

The site starts with an empty feed and links to Play-Cricket. A club administrator can [request Play-Cricket API access](https://play-cricket.ecb.co.uk/hc/en-us/articles/115004270145-Do-You-Have-an-API-to-Access-Play-Cricket-Data) and configure these in GitHub under **Settings → Secrets and variables → Actions**.

- Set the repository secret `PLAY_CRICKET_API_TOKEN` to the API token.
- Set the repository variable `PLAY_CRICKET_SITE_ID` to the Play-Cricket site ID.
- Set `PLAY_CRICKET_CLUB_ID` if the sync cannot identify the club automatically.

After merging, run **Sync Play-Cricket fixtures** from the Actions tab on `main`. The daily run checks the current and next UK seasons at 05:15 UTC. It commits changed fixture data and explicitly requests a GitHub Pages build. For branch-based publishing, Pages should serve the repository root on `main`. If a build request fails after the data commit, rerun the workflow manually to request the build again. The repository must allow the workflow to push to `main` for the sync to update the feed.
